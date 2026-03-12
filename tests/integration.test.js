const { io } = require('socket.io-client');
const { expect } = require('chai');
const { server, sessions } = require('../server/index');

describe('Omni-Connect Integration Tests', () => {
  let client1, client2;
  const PORT = 8080;
  const URL = `http://localhost:${PORT}`;

  before((done) => {
    if (!server.listening) {
      server.listen(PORT, done);
    } else {
      done();
    }
  });

  after(() => {
    server.close();
  });

  beforeEach((done) => {
    client1 = io(URL);
    client2 = io(URL);
    let connectedCount = 0;
    const checkDone = () => {
      connectedCount++;
      if (connectedCount === 2) done();
    };
    client1.on('connect', checkDone);
    client2.on('connect', checkDone);
  });

  afterEach(() => {
    client1.disconnect();
    client2.disconnect();
    sessions.clear();
  });

  it('should allow users to join and broadcast join event', (done) => {
    const uuid1 = 'user-1';
    const name1 = 'Alice';
    const uuid2 = 'user-2';
    const name2 = 'Bob';

    client2.on('user-joined', (data) => {
      expect(data.uuid).to.equal(uuid1);
      expect(data.name).to.equal(name1);
      done();
    });

    client2.emit('join', { uuid: uuid2, name: name2 });
    client1.emit('join', { uuid: uuid1, name: name1 });
  });

  it('should broadcast group messages', (done) => {
    const uuid1 = 'user-1';
    const name1 = 'Alice';
    const msgText = 'Hello Group';

    client2.on('group-message', (msg) => {
      expect(msg.text).to.equal(msgText);
      expect(msg.from).to.equal(name1);
      done();
    });

    client1.emit('join', { uuid: uuid1, name: name1 });
    client1.emit('group-message', { text: msgText });
  });

  it('should send private messages', (done) => {
    const uuid1 = 'user-1';
    const name1 = 'Alice';
    const uuid2 = 'user-2';
    const name2 = 'Bob';
    const privMsg = 'Secret message';

    client2.on('private-message', (msg) => {
      expect(msg.text).to.equal(privMsg);
      expect(msg.private).to.be.true;
      done();
    });

    client1.emit('join', { uuid: uuid1, name: name1 });
    client2.emit('join', { uuid: uuid2, name: name2 });

    setTimeout(() => {
        client1.emit('private-message', { toUuid: uuid2, text: privMsg });
    }, 100);
  });

  it('should recover missed messages for AFK users', (done) => {
      const uuid1 = 'user-1';
      const name1 = 'Alice';
      const uuid2 = 'user-2';
      const name2 = 'Bob';
      const missedMsg = 'Where are you?';

      client1.emit('join', { uuid: uuid1, name: name1 });
      client2.emit('join', { uuid: uuid2, name: name2 });

      setTimeout(() => {
          client2.disconnect();

          setTimeout(() => {
              client1.emit('group-message', { text: missedMsg });

              setTimeout(() => {
                  const newClient2 = io(URL);
                  newClient2.on('catch-up', (msgs) => {
                      expect(msgs).to.have.lengthOf(1);
                      expect(msgs[0].text).to.equal(missedMsg);
                      newClient2.disconnect();
                      done();
                  });
                  newClient2.emit('join', { uuid: uuid2, name: name2 });
              }, 100);
          }, 100);
      }, 100);
  });
});
