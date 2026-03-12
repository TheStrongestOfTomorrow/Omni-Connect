import Dexie from 'dexie';

export const db = new Dexie('OmniConnectDB');

db.version(2).stores({
  messages: '++id, fromUuid, toUuid, text, timestamp, private, mediaKey',
  media: 'id, blob, type'
});
