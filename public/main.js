const state = {
  sections: [],
  downIds: new Set(),
  prevDownIds: new Set(),
  audioCtx: null
};

function getAudioCtx() {
  if (!state.audioCtx) {
    state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return state.audioCtx;
}

function playBeep() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'square';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 660;
      osc2.type = 'square';
      gain2.gain.setValueAtTime(0.15, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.3);
    }, 150);
  } catch {}
}

function statusColor(status) {
  switch (status) {
    case 'up': return 'green';
    case 'degraded': return 'orange';
    case 'down': return 'red';
    default: return 'unknown';
  }
}

function monitorIcon(type) {
  const icons = {
    'url-unavailable': '\u{1F310}',
    'url-no-keyword': '\u{1F50D}',
    'url-has-keyword': '\u{1F50E}',
    'url-non-200': '\u{1F4F7}',
    'ping-no-response': '\u{1F4E1}',
    'tcp-no-response': '\u{1F4F6}',
    'udp-no-response': '\u{1F4F5}',
    'smtp-no-response': '\u{2709}',
    'pop3-no-response': '\u{1F4E8}',
    'imap-no-response': '\u{1F4EC}',
    'dns-no-response': '\u{1F30D}',
    'playwright-fails': '\u{1F3AC}'
  };
  return icons[type] || '\u{1F4A1}';
}

function sectionLogo(logo) {
  const logos = {
    'server': '\u{1F5A5}',
    'cloud': '\u{2601}',
    'database': '\u{1F4BE}',
    'globe': '\u{1F310}',
    'shield': '\u{1F6E1}',
    'proxmox': `
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="25" width="80" height="55" rx="6" fill="none" stroke="currentColor" stroke-width="4"/>
        <rect x="40" y="10" width="20" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="3"/>
        <circle cx="35" cy="52" r="4" fill="currentColor"/>
        <circle cx="65" cy="52" r="4" fill="currentColor"/>
        <line x1="35" y1="52" x2="65" y2="52" stroke="currentColor" stroke-width="2"/>
      </svg>`
  };
  if (!logo) return '';
  if (logos[logo]) return logos[logo];
  return logo;
}

function renderSections(sections) {
  const container = document.getElementById('sectionsContainer');
  let html = '';

  for (const section of sections) {
    const color = statusColor(section.status);
    const downCount = section.monitors.filter(m => m.status === 'down').length;

    html += `
      <div class="section-card">
        <div class="section-header status-${color}" onclick="toggleSection(this)">
          <div class="section-logo">${sectionLogo(section.logo)}</div>
          <div class="section-name">${section.name}</div>
          <span class="section-status ${color}">${section.status}${downCount > 0 ? ` (${downCount})` : ''}</span>
          <span class="section-arrow">&#9660;</span>
        </div>
        <div class="section-body">
          <div class="section-body-inner">
            ${renderProxmoxContent(section)}
            ${section.monitors.map(m => `
              <div class="monitor-row">
                <div class="monitor-icon ${m.status}">${monitorIcon(m.type)}</div>
                <div class="monitor-info">
                  <div class="monitor-name">${m.name}</div>
                  <div class="monitor-type">${typeLabel(m.type)}</div>
                </div>
                <div class="monitor-status ${m.status}">${m.status === 'up' ? 'Operational' : m.status === 'down' ? 'Down' : 'Pending'}</div>
                ${m.message ? `<div class="monitor-message">${m.message}</div>` : ''}
              </div>
            `).join('')}
            ${section.monitors.length === 0 ? '<div class="empty-state"><p>No monitors configured</p></div>' : ''}
          </div>
        </div>
      </div>`;
  }

  container.innerHTML = html;

  if (sections.length === 0) {
    container.innerHTML = '<div class="empty-state"><div style="font-size:40px;margin-bottom:12px">\u{1F4CA}</div><p>No sections yet</p><p>Go to Settings to add your first section and monitors</p></div>';
  }
}

function typeLabel(type) {
  const labels = {
    'url-unavailable': 'URL Availability',
    'url-no-keyword': 'URL Missing Keyword',
    'url-has-keyword': 'URL Contains Keyword',
    'url-non-200': 'HTTP Status Check',
    'ping-no-response': 'Ping',
    'tcp-no-response': 'TCP Port',
    'udp-no-response': 'UDP Port',
    'smtp-no-response': 'SMTP',
    'pop3-no-response': 'POP3',
    'imap-no-response': 'IMAP',
    'dns-no-response': 'DNS',
    'playwright-fails': 'Playwright'
  };
  return labels[type] || type;
}

function renderProxmoxContent(section) {
  if (section.name.toLowerCase() !== 'proxmox') return '';
  const hasMonitors = section.monitors && section.monitors.length > 0;
  return `<div class="proxmox-card" id="proxmoxCard">
    <div class="proxmox-loading" id="proxmoxLoading"><div class="spinner"></div><p style="margin-top:8px">Loading Proxmox data...</p></div>
    <div id="proxmoxData" style="display:none"></div>
  </div>`;
}

function renderProxmoxData(data) {
  const el = document.getElementById('proxmoxData');
  const loading = document.getElementById('proxmoxLoading');
  if (!el) return;

  let html = `<div style="margin-top:8px;font-size:12px;color:var(--text-secondary)">Host: ${data.host}</div>`;
  if (data.localIPs && data.localIPs.length) {
    html += `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">IPs: ${data.localIPs.join(', ')}</div>`;
  }

  html += '<div class="proxmox-grid">';

  const all = [...(data.vms || []), ...(data.lxcs || [])];
  if (all.length === 0) {
    html += '<div style="grid-column:1/-1;color:var(--text-secondary);font-size:13px">No VMs or LXCs found</div>';
  } else {
    if (data.vms && data.vms.length) {
      html += '<div class="proxmox-group"><h3>Virtual Machines</h3>';
      for (const vm of data.vms) {
        html += `<div class="proxmox-item">
          <span class="status-dot ${vm.status === 'running' ? 'green' : 'red'}"></span>
          <span class="proxmox-id">VM ${vm.id}</span>
          <span class="proxmox-name">${vm.name}</span>
          <span class="proxmox-ips">${(vm.ips || []).join(', ')}</span>
        </div>`;
      }
      html += '</div>';
    }
    if (data.lxcs && data.lxcs.length) {
      html += '<div class="proxmox-group"><h3>Containers</h3>';
      for (const lxc of data.lxcs) {
        html += `<div class="proxmox-item">
          <span class="status-dot ${lxc.status === 'running' ? 'green' : 'red'}"></span>
          <span class="proxmox-id">LXC ${lxc.id}</span>
          <span class="proxmox-name">${lxc.name}</span>
          <span class="proxmox-ips">${(lxc.ips || []).join(', ')}</span>
        </div>`;
      }
      html += '</div>';
    }
  }

  html += '</div>';
  html += `<div style="font-size:11px;color:var(--text-secondary);margin-top:8px">Last updated: ${new Date(data.timestamp).toLocaleTimeString()}</div>`;

  el.innerHTML = html;
  el.style.display = 'block';
  if (loading) loading.style.display = 'none';
}

function toggleSection(header) {
  const body = header.nextElementSibling;
  const arrow = header.querySelector('.section-arrow');
  const isOpen = body.classList.contains('open');

  if (isOpen) {
    body.classList.remove('open');
    header.classList.remove('expanded');
    arrow.classList.remove('open');
  } else {
    body.classList.add('open');
    header.classList.add('expanded');
    arrow.classList.add('open');

    const proxmoxCard = header.parentElement.querySelector('.proxmox-card');
    if (proxmoxCard && !proxmoxCard.dataset.loaded) {
      proxmoxCard.dataset.loaded = 'true';
      fetchProxmoxData();
    }
  }
}

async function fetchProxmoxData() {
  try {
    const res = await fetch('/api/proxmox');
    const data = await res.json();
    renderProxmoxData(data);
  } catch {
    const loading = document.getElementById('proxmoxLoading');
    if (loading) {
      loading.innerHTML = '<p style="color:var(--red)">Failed to load Proxmox data</p>';
    }
  }
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    state.prevDownIds = new Set(state.downIds);
    state.downIds = new Set();

    for (const section of data.sections) {
      for (const mon of section.monitors) {
        if (mon.status === 'down') {
          state.downIds.add(mon.id);
        }
      }
    }

    renderSections(data.sections);
    updateGlobalStatus(data.globalDown);

    const hasNew = state.downIds.size > 0 && [...state.downIds].some(id => !state.prevDownIds.has(id));
    if (hasNew) {
      playBeep();
    }
  } catch {}
}

function updateGlobalStatus(globalDown) {
  const badge = document.getElementById('statusBadge');
  const bar = document.getElementById('statusBar');

  if (globalDown) {
    badge.textContent = 'Issues Detected';
    badge.className = 'header-badge warning';
    bar.classList.add('visible', 'down');
  } else {
    badge.textContent = 'All Systems Operational';
    badge.className = 'header-badge';
    bar.classList.remove('visible', 'down');
  }
}

fetchStatus();
setInterval(fetchStatus, 10000);
