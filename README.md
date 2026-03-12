# Omni-Connect 📡

Omni-Connect is a browser-based tool that makes **you** the server. Host a secure, private group chat session directly from your browser, share a public link or a simple 6-digit code, and start chatting with your friends instantly—no installation required for them.

## 🚀 Features

### 📡 1. The Connection Logic
- **Public URL Generation**: Automatically creates a public link using `localtunnel` (e.g., `https://strongest-tomorrow.loca.lt`).
- **URL Invites**: Anyone with the link is automatically connected to your session via URL parameters.
- **6-Digit Easy Codes**: Shows a short, human-friendly code (e.g., `Z9-X21`) that friends can type in to look up your tunnel URL and connect.

### 👥 2. Chat & Groups
- **The Relay**: The host acts as the "brain," broadcasting messages from any participant to the entire group instantly.
- **Direct Messages (DMs)**: Private routing system allows "whispering" to specific users so the rest of the group doesn't see.

### 💾 3. Persistence (The "Clutch" Save)
- **IndexedDB Storage**: Uses `Dexie.js` to save every message locally in the browser's database, bypassing the 5MB limit of `localStorage`.
- **UUID Handshake**: Apps swap Unique IDs to recognize returning friends and instantly restore chat history.
- **AFK Recovery**: If a friend closes their tab, the server keeps their spot "warm" for 30 minutes. If they return within that window, they are "caught up" with missed messages.

---

## 🏗️ Tech Stack
- **Frontend**: React (Vite), Socket.io-client, Dexie.js (IndexedDB), Lucide-React.
- **Backend**: Node.js, Express, Socket.io, Localtunnel.

---

## 🛠️ How to Self-Host

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 1. Clone the Repository
```bash
git clone https://github.com/thestrongestoftomorrow/omni-connect.git
cd omni-connect
```

### 2. Set up the Server
```bash
cd server
npm install
node index.js
```
The server will start on port `8080`. It will log the **Public URL** and **Easy Code** to the console.

### 3. Set up the Client
In a new terminal:
```bash
cd client
npm install
npm run dev
```
The client will usually start on `http://localhost:5173`.

---

## 📖 Usage
1. Open the client in your browser.
2. Enter your name and click **"Host / Join Local"** to start your own session.
3. Share the **Public URL** logged by the server with your friends.
4. Alternatively, tell them the **6-Digit Code**. They can enter it on the join screen to connect to you.
5. Chat away! Switch between the **Group Chat** and **Direct Messages** in the sidebar.

---

## 🧪 Running Tests
To run the integration tests:
```bash
npm install --save-dev mocha chai socket.io-client
NODE_ENV=test ./node_modules/.bin/mocha tests/integration.test.js --exit
```
