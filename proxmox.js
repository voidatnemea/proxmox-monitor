const { exec } = require('child_process');
const util = require('util');
const os = require('os');
const db = require('./db');

const execAsync = util.promisify(exec);

async function runCmd(cmd) {
  try {
    const { stdout } = await execAsync(cmd, { timeout: 15000 });
    return stdout;
  } catch {
    return '';
  }
}

// Parse pct list / qm list output using multiple strategies
function parseListOutput(output, type) {
  const lines = output.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];

  const items = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    let id = '', name = '', status = '';

    // Strategy 1: split by 2+ spaces (fixed-width columns)
    const wide = line.trim().split(/\s{2,}/);
    if (wide.length >= 3) {
      const s = wide[2].trim().toLowerCase();
      if (s === 'running' || s === 'stopped') {
        id = wide[0].trim();
        name = wide[1].trim();
        status = s;
      }
    }

    // Strategy 2: find 'running'/'stopped' in whitespace-split parts
    if (!id) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        let si = -1;
        for (let j = parts.length - 1; j >= 0; j--) {
          const v = parts[j].toLowerCase();
          if (v === 'running' || v === 'stopped') { si = j; break; }
        }
        if (si >= 2) {
          id = parts[0];
          name = parts.slice(1, si).join(' ');
          status = parts[si].toLowerCase();
        }
      }
    }

    // Strategy 3: column positions from header
    if (!id) {
      const head = lines[0];
      const cSTATUS = head.indexOf('STATUS');
      const cNAME = head.indexOf('NAME');
      const cVMID = head.indexOf('VMID');
      if (cSTATUS > 0 && cNAME > 0 && cVMID >= 0 && line.length > cSTATUS) {
        const rawStatus = line.substring(cSTATUS).trim().split(/\s+/)[0].toLowerCase();
        if (rawStatus === 'running' || rawStatus === 'stopped') {
          id = line.substring(cVMID, cNAME).trim();
          name = line.substring(cNAME, cSTATUS).trim();
          status = rawStatus;
        }
      }
    }

    if (id && status) {
      items.push({ id, name, status, type });
    }
  }
  return items;
}

async function getVMConfig(vmId) {
  return await runCmd(`qm config ${vmId} 2>/dev/null`);
}

async function getLXCConfig(lxcId) {
  return await runCmd(`pct config ${lxcId} 2>/dev/null`);
}

function parseName(config, type) {
  const key = type === 'vm' ? 'name' : 'hostname';
  for (const line of config.split('\n')) {
    if (line.toLowerCase().startsWith(key + ':')) {
      return line.split(':')[1].trim();
    }
  }
  return '';
}

function parseIPs(config) {
  const ips = [];
  for (const line of config.split('\n')) {
    const m = line.match(/^net\d+:/);
    if (m) {
      const ipm = line.match(/ip=([^,\s]+)/);
      if (ipm) {
        const val = ipm[1];
        if (val && val !== 'dhcp') ips.push(val);
      }
    }
  }
  return ips;
}

async function getRuntimeIPs(id, type) {
  if (type !== 'lxc') return [];
  const out = await runCmd(`pct exec ${id} -- hostname -I 2>/dev/null`);
  return out.trim().split(/\s+/).filter(Boolean);
}

async function getVMName(vmId) {
  return parseName(await getVMConfig(vmId), 'vm');
}

async function getLXCName(lxcId) {
  return parseName(await getLXCConfig(lxcId), 'lxc');
}

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

async function refresh() {
  try {
    const rawVMs = await runCmd('qm list 2>/dev/null');
    const rawLXCs = await runCmd('pct list 2>/dev/null');
    const vms = parseListOutput(rawVMs, 'vm');
    const lxcs = parseListOutput(rawLXCs, 'lxc');
    const found = new Set();

    // Process all found items
    for (const item of [...vms, ...lxcs]) {
      found.add(item.id);
      const cached = db.getProxmoxCache().find(c => c.id === item.id);

      if (cached) {
        // Update status only
        db.updateProxmoxStatus(item.id, item.status);
      } else {
        // New item - get name from config if missing, and get IPs
        let name = item.name;
        let ips = [];

        if (!name) {
          name = item.type === 'vm' ? await getVMName(item.id) : await getLXCName(item.id);
        }

        if (item.status === 'running') {
          const config = item.type === 'vm' ? await getVMConfig(item.id) : await getLXCConfig(item.id);
          ips = parseIPs(config);
          if (ips.length === 0 && item.type === 'lxc') {
            const runtime = await getRuntimeIPs(item.id, item.type);
            if (runtime.length) ips = runtime;
          }
        }

        db.upsertProxmoxCache(item.id, name || item.id, item.type, item.status, ips.join(','));
      }
    }

    // Fill in config names for cached items with empty names
    const allCached = db.getProxmoxCache();
    for (const c of allCached) {
      if (found.has(c.id)) continue;
      // Remove items no longer in Proxmox
      db.deleteProxmoxCache(c.id);
    }

    // For existing items with empty names, try config
    for (const c of db.getProxmoxCache()) {
      if (!c.name || c.name === c.id) {
        const realName = c.type === 'vm' ? await getVMName(c.id) : await getLXCName(c.id);
        if (realName) {
          const old = db.getProxmoxCache().find(x => x.id === c.id);
          const ips = old ? old.ips : '';
          db.upsertProxmoxCache(c.id, realName, c.type, c.status, ips);
        }
      }
    }

    // For running LXCs with only DHCP IPs, try runtime IP
    for (const c of db.getProxmoxCache()) {
      if (c.status === 'running' && c.type === 'lxc' && (!c.ips || c.ips === 'dhcp')) {
        const runtime = await getRuntimeIPs(c.id, 'lxc');
        if (runtime.length) {
          db.upsertProxmoxCache(c.id, c.name, 'lxc', 'running', runtime.join(','));
        }
      }
    }

  } catch {}
}

function buildResponse() {
  const rows = db.getProxmoxCache();
  const vms = [];
  const lxcs = [];

  for (const row of rows) {
    const ips = row.ips ? row.ips.split(',').filter(Boolean) : [];
    const item = { id: row.id, name: row.name, type: row.type, status: row.status, ips };
    if (row.type === 'vm') vms.push(item);
    else lxcs.push(item);
  }

  return {
    host: os.hostname(),
    localIPs: getLocalIPs(),
    vms,
    lxcs,
    timestamp: new Date().toISOString()
  };
}

function getStatus() {
  return buildResponse();
}

setInterval(refresh, 10000);
refresh();

module.exports = { getStatus };
