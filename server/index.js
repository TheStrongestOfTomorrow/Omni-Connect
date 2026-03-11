const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const localtunnel = require('localtunnel');

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
  try {
    const tunnel = await localtunnel({ port: PORT });
    tunnelUrl = tunnel.url;
    shortCode = generateShortCode();
    codeMap.set(shortCode, tunnelUrl);

    console.log(`Public URL: ${tunnelUrl}`);
    console.log(`Easy Code: ${shortCode}`);

    tunnel.on('close', () => {
      console.log('Tunnel closed');
    });
  } catch (err) {
    console.error('Error starting localtunnel:', err);
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
