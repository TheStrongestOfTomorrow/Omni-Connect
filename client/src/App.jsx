import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import * as socketService from './socket';
import { Send, User, MessageCircle, Shield } from 'lucide-react';
import './App.css';

function App() {
  const [uuid] = useState(() => {
    const saved = localStorage.getItem('omni-connect-uuid');
    if (saved) return saved;
    const newUuid = uuidv4();
    localStorage.setItem('omni-connect-uuid', newUuid);
    return newUuid;
  });

  const [name, setName] = useState(() => localStorage.getItem('omni-connect-name') || '');
  const [isJoined, setIsJoined] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [activeTab, setActiveTab] = useState('group');
  const [targetUuid, setTargetUuid] = useState('');
  const [code, setCode] = useState('');
  const [users, setUsers] = useState({});

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hostUrl = urlParams.get('host');
    if (hostUrl && name) {
      handleJoin(hostUrl);
    }
  }, []);

  useEffect(() => {
    if (isJoined) {
      db.messages.toArray().then(setMessages);

      socketService.subscribeToGroupMessages((err, msg) => {
        setMessages(prev => [...prev, msg]);
        db.messages.add(msg);
      });

      socketService.subscribeToPrivateMessages((err, msg) => {
        setMessages(prev => [...prev, msg]);
        db.messages.add(msg);
      });

      socketService.subscribeToUserEvents((err, data) => {
          if (data.type === 'joined') {
            setUsers(prev => ({ ...prev, [data.uuid]: data.name }));
          } else {
            setUsers(prev => {
                const newUsers = { ...prev };
                delete newUsers[data.uuid];
                return newUsers;
            });
          }
      });

      socketService.subscribeToCatchUp((err, msgs) => {
          msgs.forEach(msg => {
              setMessages(prev => [...prev, msg]);
              db.messages.add(msg);
          });
      });
    }
    return () => {
      socketService.disconnectSocket();
    };
  }, [isJoined]);

  const handleJoin = async (url) => {
    if (!name) return alert('Please enter your name');
    localStorage.setItem('omni-connect-name', name);
    socketService.initiateSocket(url || 'http://localhost:8080', { uuid, name });
    setIsJoined(true);
  };

  const handleLookup = async () => {
      if (!code) return;
      try {
          const res = await fetch(`http://localhost:8080/lookup/${code}`);
          const data = await res.json();
          if (data.url) {
              handleJoin(data.url);
          } else {
              alert('Code not found');
          }
      } catch (err) {
          alert('Error looking up code');
      }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    if (activeTab === 'group') {
      socketService.sendGroupMessage(inputMsg);
    } else if (targetUuid) {
      socketService.sendPrivateMessage(targetUuid, inputMsg);
    }
    setInputMsg('');
  };

  if (!isJoined) {
    return (
      <div className="join-container">
        <h1>Omni-Connect</h1>
        <div className="card">
          <label>Your Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="John Doe"
          />

          <div className="join-actions">
            <button onClick={() => handleJoin()}>Host / Join Local</button>
            <div className="divider">OR</div>
            <div className="code-input">
                <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter 6-digit code (e.g. Z9-X21)"
                />
                <button onClick={handleLookup}>Connect by Code</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-app">
      <header>
        <div className="brand">Omni-Connect</div>
        <div className="user-info">
          <User size={18} />
          <span>{name}</span>
        </div>
      </header>

      <div className="main-content">
        <aside className="sidebar">
          <div
            className={`sidebar-item ${activeTab === 'group' ? 'active' : ''}`}
            onClick={() => setActiveTab('group')}
          >
            <MessageCircle size={20} />
            <span>Group Chat</span>
          </div>
          <div className="sidebar-section">Direct Messages</div>
          {Object.entries(users).map(([uId, uName]) => (
              uId !== uuid && (
                <div
                    key={uId}
                    className={`sidebar-item ${activeTab === 'private' && targetUuid === uId ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('private');
                        setTargetUuid(uId);
                    }}
                >
                    <Shield size={16} />
                    <span>{uName}</span>
                </div>
              )
          ))}
        </aside>

        <main className="chat-area">
          <div className="messages-list">
            {messages
              .filter(m => {
                if (activeTab === 'group') return !m.private;
                return m.private && (m.fromUuid === targetUuid || (m.fromUuid === uuid && m.toUuid === targetUuid));
              })
              .map((m, i) => (
                <div key={i} className={`message ${m.fromUuid === uuid ? 'own' : ''}`}>
                  <div className="message-header">
                    <span className="sender">{m.from}</span>
                    <span className="time">{new Date(m.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text">{m.text}</div>
                </div>
              ))}
          </div>

          <form className="input-area" onSubmit={sendMessage}>
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              placeholder={activeTab === 'group' ? "Message group..." : `Message ${users[targetUuid]}...`}
            />
            <button type="submit"><Send size={20} /></button>
          </form>
        </main>
      </div>
    </div>
  );
}

export default App;
