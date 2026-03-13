# Omni-Connect V2: Decentralized Multimedia Hub 📡

Omni-Connect is a browser-based tool that makes **you** the server. Host a secure, private group chat session directly from your browser, share a public link or a simple 6-digit code, and start chatting with your friends instantly—no installation required for them.

## 🚀 Features (V2 Upgrade)

### 📡 1. The Connection Logic (Zero-Password Overhaul)
- **SSH Tunneling**: Replaced localtunnel with a robust SSH tunnel (Pinggy/Serveo) to bypass password/IP check blocks.
- **Header Injection**: Automatically injects `bypass-tunnel-reminder` to skip provider landing pages.
- **6-Digit Easy Codes**: Shows a short code (e.g., `Z9-X21`) for easy manual connection.
- **Custom Domain "Direct-Host"**: Integrate with Cloudflare API to point your own domain directly to your active tunnel.

### 👥 2. Multimedia & P2P
- **WebRTC Streams**: Real-time voice, video, and screen sharing via PeerJS.
- **Synchronized YouTube**: Embed the YouTube IFrame API and sync playback across the group.
- **P2P File Transfer**: High-speed, direct browser-to-browser transfer for large files (>5MB) using WebRTC DataChannels.
- **Voice Messaging**: Record and send voice notes with local Blob persistence.

### 💾 3. Persistence & Privacy
- **IndexedDB Storage**: Uses `Dexie.js` for high-capacity local message and media storage.
- **Silent Guardian (Privacy Scrubber)**: Automatic regex-based redaction of phone numbers and addresses.
- **EXIF Metadata Stripper**: Wipes GPS coordinates and device info from images before sharing.
- **AFK Recovery**: 30-minute session "warmth" for disconnected users.

---

## 🏗️ Tech Stack
- **Frontend**: React (Vite), Socket.io-client, Dexie.js (IndexedDB), PeerJS, YouTube IFrame API, Lucide-React.
- **Backend**: Node.js, Express, Socket.io, Pinggy (via SSH).

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
