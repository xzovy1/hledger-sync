import React, { useState, useEffect } from "react";
const URL = "https://finances.docsnetwork.duckdns.org:3000";
// Unified Mobile Autocomplete Text Input Component
function AutocompleteInput({ placeholder, value, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const allAccounts = JSON.parse(
    localStorage.getItem("hledger_accounts") || "[]",
  );

  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange(val);

    if (val.trim().length > 0) {
      const filtered = allAccounts
        .filter((acc) => acc.toLowerCase().includes(val.toLowerCase()))
        .slice(0, 5); // Keep dropdown height minimal for iPhone viewports
      setSuggestions(filtered);
      setShowDropdown(true);
    } else {
      setSuggestions([]);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onFocus={() => value && handleInputChange({ target: { value } })}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        required
        style={{
          padding: "14px",
          fontSize: "16px",
          width: "100%",
          boxSizing: "border-box",
          borderRadius: "8px",
          border: "1px solid #ccc",
          backgroundColor: "#fff",
          WebkitAppearance: "none",
        }}
      />
      {showDropdown && suggestions.length > 0 && (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #ccc",
            margin: "4px 0 0 0",
            padding: 0,
            listStyle: "none",
            zIndex: 1000,
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {suggestions.map((acc, index) => (
            <li
              key={index}
              onMouseDown={() => {
                onChange(acc);
                setShowDropdown(false);
              }}
              style={{
                padding: "14px",
                borderBottom:
                  index === suggestions.length - 1 ? "none" : "1px solid #eee",
                cursor: "pointer",
                fontSize: "14px",
                color: "#333",
              }}
            >
              {acc}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Master Mobile Application Workspace
export default function App() {
  const [description, setDescription] = useState("");
  const [account1, setAccount1] = useState("");
  const [amount, setAmount] = useState("");
  const [account2, setAccount2] = useState("");
  const [queue, setQueue] = useState(() =>
    JSON.parse(localStorage.getItem("tx_queue") || "[]"),
  );
  const [syncing, setSyncing] = useState(false);

  // Sync state mutation tracking across native storage spaces
  useEffect(() => {
    localStorage.setItem("tx_queue", JSON.stringify(queue));
  }, [queue]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`${URL}/api/accounts`);
      const data = await res.json();
      localStorage.setItem("hledger_accounts", JSON.stringify(data));
    } catch (e) {
      console.log(
        "Device network context offline. Leveraging cached accounts schema.",
      );
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleDescriptionBlur = async () => {
    if (!description.trim()) return;
    try {
      const res = await fetch(
        `${URL}/api/suggest-accounts?desc=${encodeURIComponent(description)}`,
      );
      const suggestions = await res.json();
      if (suggestions.account1 && !account1) setAccount1(suggestions.account1);
      if (suggestions.account2 && !account2) setAccount2(suggestions.account2);
    } catch (e) {
      console.log(
        "Unable to trace transactional parameters while disconnected.",
      );
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description || !account1) return;

    const newTx = {
      date: new Date().toISOString().split("T")[0], // Standard clean ISO timeline template
      description,
      postings: [
        { account: account1, amount: amount ? `$${amount}` : "" },
        { account: account2, amount: "" }, // Leave un-calculated for core auto-balancing runtime engines
      ],
    };

    setQueue([...queue, newTx]);
    setDescription("");
    setAmount("");
    setAccount1("");
    setAccount2("");
  };

  const handleSync = async () => {
    if (queue.length === 0) return;
    setSyncing(true);

    try {
      for (const tx of queue) {
        await fetch(`${URL}/api/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(tx),
        });
      }
      setQueue([]);
      await fetchAccounts();
      alert("All stored transactions processed into master ledger!");
    } catch (err) {
      alert(
        "Sync runtime execution failed. Confirm your local Wi-Fi connectivity context.",
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div
      style={{
        padding: "24px 16px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        maxWidth: "400px",
        margin: "0 auto",
        backgroundColor: "#fff",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <h2
        style={{
          fontSize: "24px",
          fontWeight: "700",
          letterSpacing: "-0.5px",
          marginBottom: "4px",
          color: "#1d1d1f",
        }}
      >
        Fast Ledger Entry
      </h2>
      <p
        style={{
          color: "#86868b",
          fontSize: "14px",
          marginTop: "0",
          marginBottom: "24px",
        }}
      >
        Queues offline, processes over home network pools.
      </p>

      <div
        style={{
          backgroundColor: "#f5f5f7",
          padding: "16px",
          borderRadius: "12px",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <span style={{ fontSize: "15px", color: "#515154" }}>
            Pending Queue:{" "}
          </span>
          <strong style={{ fontSize: "20px", color: "#1d1d1f" }}>
            {queue.length}
          </strong>
        </div>
        {queue.length > 0 && (
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              backgroundColor: "#0071e3",
              color: "#fff",
              border: "none",
              borderRadius: "20px",
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <input
          type="text"
          placeholder="Description (e.g., Coffee Shop)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          required
          style={{
            padding: "14px",
            fontSize: "16px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            backgroundColor: "#fff",
            WebkitAppearance: "none",
          }}
        />

        <AutocompleteInput
          placeholder="To Account (e.g., assets:chequing)"
          value={account1}
          onChange={setAccount1}
        />

        <input
          type="number"
          step="0.01"
          placeholder="Amount (\$)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{
            padding: "14px",
            fontSize: "16px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            backgroundColor: "#fff",
            WebkitAppearance: "none",
          }}
        />

        <AutocompleteInput
          placeholder="From Account (e.g., expenses:food)"
          value={account2}
          onChange={setAccount2}
        />

        <button
          type="submit"
          style={{
            padding: "16px",
            backgroundColor: "#1d1d1f",
            color: "#fff",
            fontSize: "16px",
            fontWeight: "600",
            border: "none",
            borderRadius: "12px",
            cursor: "pointer",
            marginTop: "12px",
            WebkitAppearance: "none",
          }}
        >
          Save Locally
        </button>
      </form>
    </div>
  );
}
