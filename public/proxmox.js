function renderVMList(containerId, items, typeLabel) {
  const container = document.getElementById(containerId);

  if (!items || items.length === 0) {
    container.innerHTML = '<div class="section-empty">No items found</div>';
    return;
  }

  const running = items.filter(i => i.status === 'running');
  const stopped = items.filter(i => i.status !== 'running');

  let html = '<div class="proxmox-grid">';
  for (const item of running) {
    html += `
      <div class="proxmox-vm">
        <div class="proxmox-vm-icon ${typeLabel.toLowerCase()}">${typeLabel === 'VM' ? 'VM' : 'CT'}</div>
        <div class="proxmox-vm-info">
          <div class="proxmox-vm-name">
            <span class="status-dot green" style="display:inline-block;vertical-align:middle;margin-right:6px"></span>
            ${item.name || item.id}
            <span style="color:var(--text-secondary);font-weight:400;font-size:12px">(${item.id})</span>
          </div>
          <div class="proxmox-vm-ips">${(item.ips || []).length ? item.ips.join(', ') : 'No IP data'}</div>
        </div>
        <span style="font-size:12px;color:var(--green);font-weight:500">Running</span>
      </div>`;
  }
  for (const item of stopped) {
    html += `
      <div class="proxmox-vm">
        <div class="proxmox-vm-icon ${typeLabel.toLowerCase()}" style="opacity:0.5">${typeLabel === 'VM' ? 'VM' : 'CT'}</div>
        <div class="proxmox-vm-info" style="opacity:0.5">
          <div class="proxmox-vm-name">
            <span class="status-dot red" style="display:inline-block;vertical-align:middle;margin-right:6px"></span>
            ${item.name || item.id}
            <span style="color:var(--text-secondary);font-weight:400;font-size:12px">(${item.id})</span>
          </div>
          <div class="proxmox-vm-ips">${(item.ips || []).length ? item.ips.join(', ') : 'No IP data'}</div>
        </div>
        <span style="font-size:12px;color:var(--red);font-weight:500">Offline</span>
      </div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

async function loadProxmox() {
  try {
    const res = await fetch('/api/proxmox');
    const data = await res.json();

    const subtitle = document.getElementById('proxmoxSubtitle');
    const pill = document.getElementById('proxmoxPill');

    const totalVMs = (data.vms || []).length;
    const runningVMs = (data.vms || []).filter(v => v.status === 'running').length;
    const totalLXCs = (data.lxcs || []).length;
    const runningLXCs = (data.lxcs || []).filter(l => l.status === 'running').length;

    const allRunning = runningVMs + runningLXCs;
    const allTotal = totalVMs + totalLXCs;

    subtitle.textContent = `${data.host} \u00B7 ${allRunning}/${allTotal} running \u00B7 ${data.localIPs ? data.localIPs.join(', ') : ''}`;

    if (allRunning === allTotal) {
      pill.textContent = 'All Running';
      pill.className = 'status-pill up';
    } else if (allRunning === 0) {
      pill.textContent = 'All Offline';
      pill.className = 'status-pill down';
    } else {
      pill.textContent = `${allTotal - allRunning} Offline`;
      pill.className = 'status-pill degraded';
    }

    renderVMList('vmList', data.vms, 'VM');
    renderVMList('lxcList', data.lxcs, 'LXC');
  } catch {
    document.getElementById('vmList').innerHTML =
      '<div class="section-empty" style="color:var(--red)">Failed to load Proxmox data</div>';
    document.getElementById('lxcList').innerHTML = '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('fade-in');
  loadProxmox();
  setInterval(loadProxmox, 10000);
});
