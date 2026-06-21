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

  const head = lines[0];
  const colVMID = head.indexOf('VMID');
  const colNAME = head.indexOf('NAME');
  const colSTATUS = head.indexOf('STATUS');
  if (colVMID < 0 || colNAME < 0 || colSTATUS < 0) return [];

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.length <= colSTATUS) continue;

    const id = line.substring(colVMID, colNAME).trim();
    const name = line.substring(colNAME, colSTATUS).trim();
    const status = line.substring(colSTATUS).trim().split(/\s+/)[0].toLowerCase();

    if (id && (status === 'running' || status === 'stopped')) {
      items.push({ id, name, status, type });
    }
  }
  return items;
}

async function getVMName(vmId) {
  const out = await runCmd(`qm config ${vmId} 2>/dev/null | grep -i '^name:' | head -1 | awk '{print $2}'`);
  return out.trim();
}

async function getLXCName(lxcId) {
  const out = await runCmd(`pct config ${lxcId} 2>/dev/null | grep -i '^hostname:' | head -1 | awk '{print $2}'`);
  return out.trim();
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

    // Don't wipe existing data if Proxmox commands return nothing
    if (vms.length === 0 && lxcs.length === 0 && Object.keys(nameCache).length > 0) {
      return;
    }

    statusCache = {};

    for (const item of vms) {
      nameCache[item.id] = { name: item.name, type: 'vm' };
      statusCache[item.id] = item.status;
    }

    for (const item of lxcs) {
      nameCache[item.id] = { name: item.name, type: 'lxc' };
      statusCache[item.id] = item.status;
    }

    // Fill in missing names from config, and fetch IPs
    for (const [id, info] of Object.entries(nameCache)) {
      if (!info.name) {
        const configName = info.type === 'vm' ? await getVMName(id) : await getLXCName(id);
        if (configName) {
          info.name = configName;
          nameCache[id] = { ...info, name: configName };
        }
      }
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
