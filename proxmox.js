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

async function getVMs() {
  const out = await runCmd('qm list 2>/dev/null');
  const lines = out.trim().split('\n').filter(Boolean);
  const vms = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts.length >= 3) {
      vms.push({
        id: parts[0],
        name: parts[1],
        status: parts[2],
        type: 'vm'
      });
    }
  }
  return vms;
}

async function getLXCs() {
  const out = await runCmd('pct list 2>/dev/null');
  const lines = out.trim().split('\n').filter(Boolean);
  const lxcs = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].trim().split(/\s+/);
    if (parts.length >= 3) {
      lxcs.push({
        id: parts[0],
        name: parts[1],
        status: parts[2],
        type: 'lxc'
      });
    }
  }
  return lxcs;
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
      if (vm.status === 'running') {
        vm.ips = await getVMIPs(vm.id);
      } else {
        vm.ips = [];
      }
    }

    for (const lxc of lxcs) {
      if (lxc.status === 'running') {
        lxc.ips = await getLXCIPs(lxc.id);
      } else {
        lxc.ips = [];
      }
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
