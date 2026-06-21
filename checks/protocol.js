const net = require('net');
const dns = require('dns');

function connect(host, port, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', (e) => {
      socket.destroy();
      resolve(false);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

function checkDns(hostname, resolver) {
  return new Promise((resolve) => {
    dns.resolve(hostname, (err) => {
      resolve(!err);
    });
  });
}

async function run(monitor) {
  switch (monitor.type) {
    case 'smtp-no-response': {
      const ok = await connect(monitor.target, 25);
      if (ok) return { status: 'up', message: 'SMTP responding' };
      return { status: 'down', message: 'SMTP not responding' };
    }

    case 'pop3-no-response': {
      const ok = await connect(monitor.target, 110);
      if (ok) return { status: 'up', message: 'POP3 responding' };
      return { status: 'down', message: 'POP3 not responding' };
    }

    case 'imap-no-response': {
      const ok = await connect(monitor.target, 143);
      if (ok) return { status: 'up', message: 'IMAP responding' };
      return { status: 'down', message: 'IMAP not responding' };
    }

    case 'dns-no-response': {
      const hostname = monitor.expected || 'google.com';
      const ok = await checkDns(hostname, monitor.target);
      if (ok) return { status: 'up', message: 'DNS resolving' };
      return { status: 'down', message: 'DNS not resolving' };
    }

    default:
      return { status: 'down', message: `Unknown type: ${monitor.type}` };
  }
}

module.exports = { run };
