const { exec } = require('child_process');
const net = require('net');
const dgram = require('dgram');

function ping(host) {
  return new Promise((resolve, reject) => {
    const plat = process.platform;
    const cmd = plat === 'win32' ? `ping -n 1 -w 5000 ${host}` : `ping -c 1 -W 5 ${host}`;
    exec(cmd, { timeout: 10000 }, (err) => {
      resolve(!err);
    });
  });
}

function tcpCheck(host, port, timeout = 8000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
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

function udpCheck(host, port, timeout = 5000) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    const msg = Buffer.from('ping');
    socket.send(msg, 0, msg.length, port, host, (err) => {
      socket.close();
      resolve(!err);
    });
    socket.on('error', () => {
      socket.close();
      resolve(false);
    });
    setTimeout(() => {
      socket.close();
      resolve(false);
    }, timeout);
  });
}

async function run(monitor) {
  switch (monitor.type) {
    case 'ping-no-response': {
      const alive = await ping(monitor.target);
      if (alive) return { status: 'up', message: 'Responding' };
      return { status: 'down', message: 'No response' };
    }

    case 'tcp-no-response': {
      const port = parseInt(monitor.expected) || 80;
      const open = await tcpCheck(monitor.target, port);
      if (open) return { status: 'up', message: `Port ${port} open` };
      return { status: 'down', message: `Port ${port} closed` };
    }

    case 'udp-no-response': {
      const port = parseInt(monitor.expected) || 53;
      const ok = await udpCheck(monitor.target, port);
      if (ok) return { status: 'up', message: `UDP ${port} reachable` };
      return { status: 'down', message: `UDP ${port} unreachable` };
    }

    default:
      return { status: 'down', message: `Unknown type: ${monitor.type}` };
  }
}

module.exports = { run };
