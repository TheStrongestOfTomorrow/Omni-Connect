import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import * as socketService from './socket';
import { Send, User, MessageCircle, Shield, Video, Music } from 'lucide-react';
import Peer from 'peerjs';
import StreamHandler from './components/StreamHandler';
import YouTubeSync from './components/YouTubeSync';
import { useVoiceRecorder } from './hooks/useVoiceRecorder';
import AudioPlayer from './components/AudioPlayer';
import { redactSensitiveInfo, stripExifAndRedraw } from './utils/privacy';
import ImagePreview from './components/ImagePreview';
import { Camera, FileUp } from 'lucide-react';
import { sendFile, CHUNK_SIZE } from './utils/p2p';
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
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('group');
  const [targetUuid, setTargetUuid] = useState('');
  const [code, setCode] = useState('');
  const [customDomain, setCustomDomain] = useState('');
  const [users, setUsers] = useState({});
  const [peer, setPeer] = useState(null);
  const [showMedia, setShowMedia] = useState(false);
  const [showYoutube, setShowYoutube] = useState(false);
  const { isRecording, startRecording, stopRecording } = useVoiceRecorder();

  useEffect(() => {
    if (isJoined) {
      const newPeer = new Peer(uuid);
      setPeer(newPeer);
      return () => newPeer.destroy();
    }
  }, [isJoined, uuid]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hostParam = urlParams.get('host');

    if (hostParam) {
        // Switchboard Redirector Logic
        const resolveHost = async () => {
            try {
                // If it looks like a code (2 chars, dash, 3 chars), handle as code
                if (/^[A-Z0-9]{2}-[A-Z0-9]{3}$/.test(hostParam.toUpperCase())) {
                    const res = await fetch(`http://localhost:8080/lookup/${hostParam.toUpperCase()}`, {
                        headers: { "bypass-tunnel-reminder": "true" }
                    });
                    const data = await res.json();
                    if (data.url) handleJoin(data.url);
                } else {
                    // Otherwise assume it's a custom domain/host from signaling server
                    const res = await fetch(`http://localhost:8080/resolve-domain?host=${hostParam}`, {
                        headers: { "bypass-tunnel-reminder": "true" }
                    });
                    const data = await res.json();
                    if (data.url) {
                        window.location.replace(data.url); // Immediate redirect to active tunnel
                    }
                }
            } catch (err) {
                console.error('Redirect error:', err);
            }
        };
        resolveHost();
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
          const res = await fetch(`http://localhost:8080/lookup/${code}`, {
              headers: { "bypass-tunnel-reminder": "true" }
          });
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

  const sendVoiceMessage = async () => {
    const blob = await stopRecording();
    const mediaKey = uuidv4();
    await db.media.add({ id: mediaKey, blob, type: 'audio' });

    const msgData = { mediaKey, from: name, fromUuid: uuid, timestamp: Date.now() };
    if (activeTab === 'group') {
        socketService.sendGroupMessage(msgData);
    } else {
        socketService.sendPrivateMessage(targetUuid, msgData);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const redactedText = redactSensitiveInfo(inputMsg);

    if (activeTab === 'group') {
      socketService.sendGroupMessage({ text: redactedText });
    } else if (targetUuid) {
      socketService.sendPrivateMessage(targetUuid, { text: redactedText });
    }
    setInputMsg('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024 && peer && targetUuid) {
        // P2P for > 5MB
        const conn = peer.connect(targetUuid);
        conn.on('open', () => {
            sendFile(conn, file);
        });
    } else {
        // Fallback or smaller files - for simplicity we just handle as media for now
        const mediaKey = uuidv4();
        await db.media.add({ id: mediaKey, blob: file, type: 'file' });
        const msgData = { mediaKey, from: name, fromUuid: uuid, timestamp: Date.now(), isFile: true, fileName: file.name };
        if (activeTab === 'group') socketService.sendGroupMessage(msgData);
        else socketService.sendPrivateMessage(targetUuid, msgData);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const cleanBlob = await stripExifAndRedraw(file);
    const mediaKey = uuidv4();
    await db.media.add({ id: mediaKey, blob: cleanBlob, type: 'image' });

    const msgData = { mediaKey, from: name, fromUuid: uuid, timestamp: Date.now(), isImage: true };
    if (activeTab === 'group') {
        socketService.sendGroupMessage(msgData);
    } else {
        socketService.sendPrivateMessage(targetUuid, msgData);
    }
    setUploading(false);
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
            <div className="divider">OR</div>
            <div className="domain-input">
                <input
                    type="text"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="Go Live with Custom Domain"
                />
                <button onClick={async () => {
                    if (!customDomain) return;
                    await fetch('http://localhost:8080/domain/heartbeat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ domain: customDomain, tunnelUrl: 'http://localhost:8080' }) // In real usage, use active tunnel
                    });
                    alert('Custom domain live! Redirecting...');
                }}>Go Live</button>
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
        <div className="header-actions">
          <button onClick={() => setShowMedia(!showMedia)}><Video size={18} /></button>
          <button onClick={() => setShowYoutube(!showYoutube)}><Music size={18} /></button>
        </div>
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
          {showMedia && <StreamHandler peer={peer} targetUuid={activeTab === 'private' ? targetUuid : null} isHost={true} />}
          {showYoutube && <YouTubeSync socket={socketService.getSocket()} isHost={true} />}
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
                  <div className="text">
                    {m.text}
                    {m.mediaKey && (
                        m.isImage ? <ImagePreview mediaKey={m.mediaKey} /> :
                        m.isFile ? <a href="#" onClick={async (e) => {
                            e.preventDefault();
                            const mData = await db.media.get(m.mediaKey);
                            if (mData) {
                                const url = URL.createObjectURL(mData.blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = m.fileName;
                                a.click();
                                URL.revokeObjectURL(url);
                            }
                        }}>{m.fileName}</a> :
                        <AudioPlayer mediaKey={m.mediaKey} />
                    )}
                  </div>
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
            <label className="upload-btn">
                <input type="file" accept="image/*" onChange={handleImageUpload} hidden disabled={uploading} />
                <Camera size={20} className={uploading ? 'anim-pulse' : ''} />
            </label>
            <label className="upload-btn">
                <input type="file" onChange={handleFileUpload} hidden />
                <FileUp size={20} />
            </label>
            <button
                type="button"
                onMouseDown={startRecording}
                onMouseUp={sendVoiceMessage}
                className={isRecording ? 'recording' : ''}
            >
                <Mic size={20} />
            </button>
            <button type="submit"><Send size={20} /></button>
          </form>
        </main>
      </div>
    </div>
  );
}

export default App;
