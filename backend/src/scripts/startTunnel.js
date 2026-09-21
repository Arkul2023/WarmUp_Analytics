const { Client } = require('ssh2');
const net = require('net');

function startTunnel() {
  console.log('[SSH Tunnel] Connecting to MailWizz server (15.235.163.118:22)...');
  const sshClient = new Client();

  sshClient.on('ready', () => {
    console.log('[SSH Tunnel] SSH connection ready. Starting local port forwarder on 127.0.0.1:3307...');

    const server = net.createServer((socket) => {
      sshClient.forwardOut(
        socket.remoteAddress || '127.0.0.1',
        socket.remotePort || 0,
        '127.0.0.1',
        3306,
        (err, stream) => {
          if (err) {
            socket.destroy(err);
            return;
          }
          socket.pipe(stream);
          stream.pipe(socket);
          stream.on('error', () => socket.destroy());
          socket.on('error', () => stream.destroy());
        }
      );
    });

    server.on('error', (err) => {
      console.error('[SSH Tunnel] Forwarder server error:', err.message);
    });

    server.listen(3307, '127.0.0.1', () => {
      console.log('[SSH Tunnel] ✓ Active: 127.0.0.1:3307 -> 15.235.163.118:3306 (MailWizz MariaDB)');
    });

    sshClient.on('close', () => {
      console.warn('[SSH Tunnel] SSH closed. Reconnecting in 5s...');
      server.close();
      setTimeout(startTunnel, 5000);
    });
  }).on('error', (err) => {
    console.error('[SSH Tunnel] SSH error:', err.message, '- retrying in 5s...');
    setTimeout(startTunnel, 5000);
  }).connect({
    host: '15.235.163.118',
    port: 22,
    username: 'ubuntu',
    password: 'Warje@130779',
    keepaliveInterval: 15000,
    readyTimeout: 30000,
  });
}

startTunnel();
