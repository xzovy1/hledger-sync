import React, { useState, useEffect } from 'react';
import './App.css';

const URL = "https://hledger.docsnetwork.duckdns.org";

// Unified Mobile Autocomplete Text Input Component
function AutocompleteInput({ placeholder, value, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const allAccounts = JSON.parse(localStorage.getItem('hledger_accounts') || '[]');

  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange(val);

    if (val.trim().length > 0) {
      const filtered = allAccounts.filter(acc => 
        acc.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 5);
      setSuggestions(filtered);
      setShowDropdown(true);
    } else {
      setSuggestions([]);
    }
  };

  return (
    <div className="autocomplete-wrapper">
      <input 
        type="text" 
        placeholder={placeholder} 
        value={value} 
        onChange={handleInputChange}
        onFocus={() => value && handleInputChange({ target: { value } })}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
        required 
        className="mobile-input"
      />
      {showDropdown && suggestions.length > 0 && (
        <ul className="autocomplete-dropdown">
          {suggestions.map((acc, index) => (
            <li 
              key={index}
              onMouseDown={() => { onChange(acc); setShowDropdown(false); }}
              onTouchEnd={() => { onChange(acc); setShowDropdown(false); }}
              className="autocomplete-row"
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
  const [description, setDescription] = useState('');
  const [account1, setAccount1] = useState('');
  const [amount, setAmount] = useState('');
  const [account2, setAccount2] = useState('');
  const [queue, setQueue] = useState(() => JSON.parse(localStorage.getItem('tx_queue') || '[]'));
  const [syncing, setSyncing] = useState(false);
  
  const [showQueueList, setShowQueueList] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  
  const [notification, setNotification] = useState({ message: '', isError: false });

  useEffect(() => {
    localStorage.setItem('tx_queue', JSON.stringify(queue));
  }, [queue]);

  const showToast = (message, isError = false) => {
    setNotification({ message, isError });
  };

  useEffect(() => {
    if (!notification.message) return;
    
    const timer = setTimeout(() => {
      setNotification({ message: '', isError: false });
    }, 3000);

    return () => clearTimeout(timer);
  }, [notification]);

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`${URL}/api/accounts`);
      const data = await res.json();
      localStorage.setItem('hledger_accounts', JSON.stringify(data));
    } catch (e) {
      console.log("Device network context offline. Leveraging cached accounts schema.");
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleDescriptionBlur = async () => {
    if (!description.trim() || editingIndex !== null) return;
    try {
      const res = await fetch(`${URL}/api/suggest-accounts?desc=${encodeURIComponent(description)}`);
      const suggestions = await res.json();
      if (suggestions.account1 && !account1) setAccount1(suggestions.account1);
      if (suggestions.account2 && !account2) setAccount2(suggestions.account2);
    } catch (e) {
      console.log("Unable to trace parameters while disconnected.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description || !account1) return;

    const formattedAmount = amount ? (amount.startsWith('\$') ? amount : `-$${amount}`) : '';

    const newTx = {
      date: editingIndex !== null ? queue[editingIndex].date : new Date().toISOString().split('T')[0],
      description,
      postings: [
        { account: account1, amount: formattedAmount },
        { account: account2, amount: '' }
      ]
    };

    if (editingIndex !== null) {
      const updatedQueue = [...queue];
      updatedQueue[editingIndex] = newTx;
      setQueue(updatedQueue);
      setEditingIndex(null);
      showToast('Changes saved to queue.');
    } else {
      try {
        const response = await fetch(`${URL}/api/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTx)
        });

        if (response.ok) {
          showToast('Directly saved to ledger!');
          fetchAccounts(); 
        } else {
          setQueue([...queue, newTx]);
          showToast('Saved locally (Server error).');
        }
      } catch (err) {
        setQueue([...queue, newTx]);
        showToast('Saved locally (Offline).');
      }
    }

    setDescription('');
    setAmount('');
    setAccount1('');
    setAccount2('');
  };

  const startEdit = (index) => {
    const tx = queue[index];
    setEditingIndex(index);
    setDescription(tx.description);
    setAccount1(tx.postings[0].account);
    setAmount(tx.postings[0].amount.replace('\$', '').replace('-', ''));
    setAccount2(tx.postings[1].account);
    setShowQueueList(false);
  };

  const removeEntry = (index, e) => {
    e.stopPropagation();
    const filteredQueue = queue.filter((_, i) => i !== index);
    setQueue(filteredQueue);
    if (editingIndex === index) cancelEdit();
    showToast('Removed from queue.');
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setDescription('');
    setAmount('');
    setAccount1('');
    setAccount2('');
  };

  const handleSync = async () => {
    if (queue.length === 0) return;
    setSyncing(true);

    try {
      for (const tx of queue) {
        await fetch(`${URL}/api/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tx)
        });
      }
      setQueue([]);
      await fetchAccounts();
      showToast('All transactions processed into ledger!');
    } catch (err) {
      showToast('Sync execution failed. Verify connection.', true);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="ledger-container">
      <h2 className="ledger-title">Hledger Entry</h2>
      <p className="ledger-subtitle">Queues offline, processes over home network.</p>
      
      <div className="queue-panel">
        <div className="queue-header-row">
          <div 
            onClick={() => queue.length > 0 && setShowQueueList(!showQueueList)} 
            className={`queue-trigger ${queue.length > 0 ? 'active-list' : ''}`}
          >
            <span className="queue-label">Pending Queue: </span>
            <strong className="queue-count">{queue.length}</strong>
            {queue.length > 0 && <span className="queue-toggle-hint">{showQueueList ? ' ▲ Hide' : ' ▼ View'}</span>}
          </div>
          {queue.length > 0 && !showQueueList && (
            <button onClick={handleSync} disabled={syncing} className="sync-btn">
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>

        {showQueueList && queue.length > 0 && (
          <div className="expanded-list-container">
            {queue.map((tx, idx) => (
              <div key={idx} onClick={() => startEdit(idx)} className="queue-item-card">
                <div className="queue-item-details">
                  <span className="queue-item-desc">{tx.description}</span>
                  <span className="queue-item-path">
                    {tx.postings[0].account.split(':').pop()} → {tx.postings[1].account.split(':').pop() || 'auto'}
                  </span>
                </div>
                <div className="queue-item-meta">
                  <strong className="queue-item-val">{tx.postings[0].amount || '—'}</strong>
                  <button onClick={(e) => removeEntry(idx, e)} className="delete-item-btn">×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="form-layout">
        {editingIndex !== null && (
          <div className="editing-status-banner">
            <span>Editing Item #{editingIndex + 1}</span>
            <button type="button" onClick={cancelEdit} className="cancel-edit-btn">Cancel</button>
          </div>
        )}

        <input 
          type="text" 
          placeholder="Description (e.g., Starbucks)" 
          value={description} 
          onChange={e => setDescription(e.target.value)} 
          onBlur={handleDescriptionBlur}
          required 
          className="mobile-input"
        />
        
        <AutocompleteInput placeholder="From Account (e.g., assets:chequing)" value={account1} onChange={setAccount1} />
        
        <input 
          type="number" 
          step="0.01" 
          placeholder="Amount ($)" 
          value={amount} 
          onChange={e => setAmount(e.target.value)} 
          className="mobile-input"
          required
        />
        
        <AutocompleteInput placeholder="To Account (e.g., expenses:food:groceries)" value={account2} onChange={setAccount2} />
        
        <button 
          type="submit" 
          className={`submit-btn ${editingIndex !== null ? 'editing-mode' : ''}`}
        >
          {editingIndex !== null ? 'Apply Changes to Queue' : 'Save Entry'}
        </button>
      </form>

      {notification.message && (
        <div className={`toast-notification ${notification.isError ? 'error-toast' : ''}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}