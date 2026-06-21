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
    const line = lines[i];
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;

    // Find the status field by known value
    let statusIdx = -1;
    for (let j = 0; j < parts.length; j++) {
      const v = parts[j].toLowerCase();
      if (v === 'running' || v === 'stopped') {
        statusIdx = j;
        break;
      }
    }

    if (statusIdx < 1) continue;

    const id = parts[0];
    // Name is everything between ID and status
    const name = parts.slice(1, statusIdx).join(' ');
    const status = parts[statusIdx].toLowerCase();

    if (id) {
      items.push({ id, name, status, type });
    }
  }
  return items;
}

async function getVMs() {
  return parseListOutput(await runCmd('qm list 2>/dev/null'), 'vm');
}

async function getLXCs() {
  return parseListOutput(await runCmd('pct list 2>/dev/null'), 'lxc');
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

async function getStatus() {
  try {
    const [vms, lxcs] = await Promise.all([getVMs(), getLXCs()]);
    const localIPs = getLocalIPs();

    for (const vm of vms) {
      vm.ips = vm.status === 'running' ? await getVMIPs(vm.id) : [];
    }

    for (const lxc of lxcs) {
      lxc.ips = lxc.status === 'running' ? await getLXCIPs(lxc.id) : [];
    }

    return {
      host: os.hostname(),
      localIPs,
      vms,
      lxcs,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return { error: err.message, host: os.hostname(), localIPs: getLocalIPs(), vms: [], lxcs: [] };
  }
}

module.exports = { getStatus };
