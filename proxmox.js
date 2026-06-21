const { exec } = require('child_process');
const util = require('util');
const os = require('os');

const execAsync = util.promisify(exec);

async function runCmd(cmd) {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 15000 });
    return stdout;
  } catch {
    return '';
  }
}

function parseListOutput(output, type) {
  const lines = output.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts.length < 3) continue;

    let statusIdx = -1;
    for (let j = 0; j < parts.length; j++) {
      const v = parts[j].toLowerCase();
      if (v === 'running' || v === 'stopped') {
        statusIdx = j;
        break;
      }
    }
    if (statusIdx < 1) continue;

    items.push({
      id: parts[0],
      name: parts.slice(1, statusIdx).join(' '),
      status: parts[statusIdx].toLowerCase(),
      type
    });
  }
  return items;
}

async function getVMIPs(vmId) {
  const out = await runCmd(`qm config ${vmId} 2>/dev/null | grep -E '^net[0-9]+:' | grep -oE 'ip=[^,]+' | cut -d= -f2`);
  return out.trim().split('\n').filter(Boolean);
}

async function getLXCIPs(lxcId) {
  const out = await runCmd(`pct config ${lxcId} 2>/dev/null | grep -E '^net[0-9]+:' | grep -oE 'ip=[^,]+' | cut -d= -f2`);
  return out.trim().split('\n').filter(Boolean);
}

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

// Persistent caches
const nameCache = {};
const ipCache = {};
let statusCache = {};
let cachedResponse = null;

async function refresh() {
  try {
    const [vms, lxcs] = await Promise.all([
      parseListOutput(await runCmd('qm list 2>/dev/null'), 'vm'),
      parseListOutput(await runCmd('pct list 2>/dev/null'), 'lxc')
    ]);

    statusCache = {};

    for (const item of vms) {
      nameCache[item.id] = { name: item.name, type: 'vm' };
      statusCache[item.id] = item.status;
    }

    for (const item of lxcs) {
      nameCache[item.id] = { name: item.name, type: 'lxc' };
      statusCache[item.id] = item.status;
    }

    // Fetch IPs once per VM/LXC when first seen running
    for (const [id, info] of Object.entries(nameCache)) {
      if (statusCache[id] === 'running' && !ipCache[id]) {
        ipCache[id] = await (info.type === 'vm' ? getVMIPs(id) : getLXCIPs(id));
      }
    }

    buildResponse();
  } catch {
    if (!cachedResponse) buildResponse();
  }
}

function buildResponse() {
  const vms = [];
  const lxcs = [];

  for (const [id, info] of Object.entries(nameCache)) {
    const item = {
      id,
      name: info.name,
      type: info.type,
      status: statusCache[id] || 'stopped',
      ips: ipCache[id] || []
    };
    if (info.type === 'vm') vms.push(item);
    else lxcs.push(item);
  }

  cachedResponse = {
    host: os.hostname(),
    localIPs: getLocalIPs(),
    vms,
    lxcs,
    timestamp: new Date().toISOString()
  };
}

function getStatus() {
  return cachedResponse || {
    host: os.hostname(),
    localIPs: getLocalIPs(),
    vms: [],
    lxcs: [],
    timestamp: new Date().toISOString()
  };
}

setInterval(refresh, 10000);
refresh();

module.exports = { getStatus };
