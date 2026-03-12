const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { spawn } = require('child_process');
const axios = require('axios');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = 8080;
let tunnelUrl = null;
let shortCode = null;

const codeMap = new Map();
const domainMap = new Map(); // domain -> active_tunnel_url
const sessions = new Map();

function generateShortCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 2; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  code += '-';
  for (let i = 0; i < 3; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

async function startTunnel() {
  console.log('Starting Pinggy SSH Tunnel...');
  // ssh -p 443 -R0:localhost:8080 a.pinggy.io
  const ssh = spawn('ssh', ['-o', 'StrictHostKeyChecking=no', '-p', '443', '-R0:localhost:' + PORT, 'a.pinggy.io']);

  ssh.stdout.on('data', (data) => {
    const output = data.toString();
    console.log('SSH Output:', output);

    // Extract https URL from Pinggy output
    const match = output.match(/https:\/\/[a-z0-9-]+\.pinggy\.link/);
    if (match) {
        tunnelUrl = match[0];
        shortCode = generateShortCode();
        codeMap.set(shortCode, tunnelUrl);
        console.log(`\n🚀 TUNNEL ACTIVE: ${tunnelUrl}`);
        console.log(`🔑 EASY CODE: ${shortCode}\n`);
    }
  });

  ssh.stderr.on('data', (data) => {
    console.error(`SSH Error: ${data}`);
  });

  ssh.on('close', (code) => {
    console.log(`SSH Tunnel closed with code ${code}`);
  });
}

// Cloudflare API integration (Placeholder)
async function updateCloudflareDNS(domain, tunnelUrl) {
    const CF_API_TOKEN = process.env.CF_API_TOKEN;
    const CF_ZONE_ID = process.env.CF_ZONE_ID;

    if (!CF_API_TOKEN || !CF_ZONE_ID) {
        console.warn('Cloudflare API Token or Zone ID missing. Skipping DNS update.');
        return;
    }

    try {
        console.log(`Updating Cloudflare DNS for ${domain} to point to ${tunnelUrl}`);

        // 1. Get Record ID for the domain
        const recordsRes = await axios.get(
            `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records?name=${domain}`,
            { headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` } }
        );

        const record = recordsRes.data.result[0];
        const tunnelHostname = new URL(tunnelUrl).hostname;

        if (record) {
            // Update existing record
            await axios.put(
                `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${record.id}`,
                { type: 'CNAME', name: domain, content: tunnelHostname, proxied: true },
                { headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` } }
            );
        } else {
            // Create new record
            await axios.post(
                `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records`,
                { type: 'CNAME', name: domain, content: tunnelHostname, proxied: true },
                { headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` } }
            );
        }
        console.log(`Cloudflare DNS successfully updated for ${domain}`);
    } catch (err) {
        console.error('Error updating Cloudflare DNS:', err);
    }
}

app.get('/lookup/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const url = codeMap.get(code);
  if (url) {
    res.json({ url });
  } else {
    res.status(404).json({ error: 'Code not found' });
  }
});

app.post('/domain/heartbeat', express.json(), (req, res) => {
    const { domain, tunnelUrl } = req.body;
    domainMap.set(domain, tunnelUrl);
    console.log(`Heartbeat received: ${domain} -> ${tunnelUrl}`);
    res.sendStatus(200);
});

app.get('/resolve-domain', (req, res) => {
    const { host } = req.query;
    const url = domainMap.get(host);
    if (url) {
        res.json({ url });
    } else {
        res.status(404).json({ error: 'Domain not found' });
    }
});

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('join', ({ uuid, name }) => {
    socket.uuid = uuid;
    socket.name = name;

    if (sessions.has(uuid)) {
      const session = sessions.get(uuid);
      socket.emit('catch-up', session.missedMessages || []);
      session.missedMessages = [];
      session.active = true;
      if (session.timer) clearTimeout(session.timer);
    } else {
      sessions.set(uuid, { name, active: true, missedMessages: [] });
    }

    socket.broadcast.emit('user-joined', { uuid, name });
    console.log(`${name} (${uuid}) joined`);
  });

  socket.on('group-message', (msg) => {
    const messageData = { ...msg, from: socket.name, fromUuid: socket.uuid, timestamp: Date.now() };
    io.emit('group-message', messageData);

    sessions.forEach((session, uuid) => {
      if (!session.active && uuid !== socket.uuid) {
        session.missedMessages.push(messageData);
      }
    });
  });

  socket.on('media-sync', (data) => {
    socket.broadcast.emit('media-sync', data);
  });

  socket.on('private-message', ({ toUuid, text }) => {
    const messageData = { text, from: socket.name, fromUuid: socket.uuid, timestamp: Date.now(), private: true };
    let found = false;
    for (const [id, s] of io.sockets.sockets) {
      if (s.uuid === toUuid) {
        s.emit('private-message', messageData);
        found = true;
        break;
      }
    }
    socket.emit('private-message', messageData);

    if (!found) {
        const session = sessions.get(toUuid);
        if (session) {
            session.missedMessages.push(messageData);
        }
    }
  });

  socket.on('disconnect', () => {
    if (socket.uuid) {
      const session = sessions.get(socket.uuid);
      if (session) {
        session.active = false;
        session.timer = setTimeout(() => {
          sessions.delete(socket.uuid);
        }, 30 * 60 * 1000);
      }
      socket.broadcast.emit('user-left', { uuid: socket.uuid, name: socket.name });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  if (process.env.NODE_ENV !== 'test') {
      startTunnel();
  }
});

module.exports = { server, io, sessions };
