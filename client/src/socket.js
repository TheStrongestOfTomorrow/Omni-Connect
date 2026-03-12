import { io } from 'socket.io-client';

let socket;

export const initiateSocket = (url, { uuid, name }) => {
  socket = io(url);
  console.log(`Connecting to ${url}...`);

  if (socket && uuid && name) {
    socket.emit('join', { uuid, name });
  }

  return socket;
};

export const disconnectSocket = () => {
  console.log('Disconnecting socket...');
  if (socket) socket.disconnect();
};

export const subscribeToGroupMessages = (cb) => {
  if (!socket) return;
  socket.on('group-message', msg => {
    return cb(null, msg);
  });
};

export const subscribeToPrivateMessages = (cb) => {
  if (!socket) return;
  socket.on('private-message', msg => {
    return cb(null, msg);
  });
};

export const subscribeToUserEvents = (cb) => {
    if (!socket) return;
    socket.on('user-joined', data => cb(null, { type: 'joined', ...data }));
    socket.on('user-left', data => cb(null, { type: 'left', ...data }));
};

export const subscribeToCatchUp = (cb) => {
    if (!socket) return;
    socket.on('catch-up', messages => cb(null, messages));
};

export const sendGroupMessage = (text) => {
  if (socket) socket.emit('group-message', { text });
};

export const sendPrivateMessage = (toUuid, text) => {
  if (socket) socket.emit('private-message', { toUuid, text });
};

export const getSocket = () => socket;
