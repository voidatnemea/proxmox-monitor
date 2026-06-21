let prevDownIds = new Set();
let audioCtx = null;

function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playBeep() {
  try {
    const ctx = getAudio();
    const play = (freq, start, dur) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = freq;
      o.type = 'square';
      g.gain.setValueAtTime(0.12, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + dur);
      o.start(start); o.stop(start + dur);
    };
    play(880, ctx.currentTime, 0.35);
    play(660, ctx.currentTime + 0.15, 0.25);
  } catch {}
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function statusColor(s) {
  return s === 'up' ? 'green' : s === 'degraded' ? 'orange' : 'red';
}

function sectionLogoHTML(logo) {
  if (!logo) return '';
  const emojis = {
    server: '\u{1F5A5}',
    cloud: '\u{2601}\u{FE0F}',
    database: '\u{1F4BE}',
    globe: '\u{1F310}',
    shield: '\u{1F6E1}\u{FE0F}',
  };
  if (emojis[logo]) return `<span class="emoji-logo">${emojis[logo]}</span>`;
  if (logo === 'proxmox') {
    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="10" width="100" height="100" rx="20" fill="none" stroke="currentColor" stroke-width="3"/>
      <rect x="25" y="32" width="70" height="52" rx="6" fill="none" stroke="currentColor" stroke-width="2.5"/>
      <line x1="35" y1="32" x2="35" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="60" y1="32" x2="60" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="85" y1="32" x2="85" y2="18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="40" cy="63" r="3.5" fill="currentColor"/>
      <circle cx="55" cy="55" r="3.5" fill="currentColor"/>
      <circle cx="70" cy="63" r="3.5" fill="currentColor"/>
      <line x1="40" y1="63" x2="55" y2="55" stroke="currentColor" stroke-width="1.5"/>
      <line x1="55" y1="55" x2="70" y2="63" stroke="currentColor" stroke-width="1.5"/>
      <text x="60" y="100" font-family="Arial,sans-serif" font-weight="700" font-size="14" fill="currentColor" text-anchor="middle" opacity="0.7">PROXMOX</text>
    </svg>`;
  }
  return `<span class="emoji-logo">${logo}</span>`;
}

function renderSections(sections) {
  const container = document.getElementById('sectionsContainer');

  if (!sections.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="icon">\u{1F4CA}</div>
      <p>No sections configured yet</p>
      <p style="margin-top:4px;opacity:0.6">Go to Settings to add your first section and monitors</p>
    </div>`;
    return;
  }

  let html = '';
  for (const s of sections) {
    const color = statusColor(s.status);
    const up = s.monitors.filter(m => m.status === 'up').length;
    const total = s.monitors.length;
    const slug = slugify(s.name);

    html += `
      <div class="section-card" onclick="navigateTo('/status/${slug}')">
        <div class="section-card-bg status-${color}"></div>
        <div class="section-card-content">
          <div class="section-card-top">
            <div class="section-card-logo">${sectionLogoHTML(s.logo)}</div>
            <span class="status-dot ${color}"></span>
          </div>
          <div class="section-card-name">${s.name}</div>
          <div class="section-card-meta">
            <span class="status-pill ${color}">${s.status}${s.status === 'degraded' ? ` (${total - up})` : ''}</span>
            <span>${up}/${total} operational</span>
          </div>
          <span class="section-card-arrow">\u{2192}</span>
        </div>
      </div>`;
  }

  container.innerHTML = html;
}

function navigateTo(url) {
  const page = document.getElementById('page');
  page.style.opacity = '0';
  page.style.transform = 'scale(0.98)';
  page.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
  setTimeout(() => { window.location.href = url; }, 250);
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    const newDown = new Set();
    for (const section of data.sections) {
      for (const m of section.monitors) {
        if (m.status === 'down') newDown.add(m.id);
      }
    }

    const hasNew = [...newDown].some(id => !prevDownIds.has(id));
    if (hasNew) playBeep();
    prevDownIds = newDown;

    const badge = document.getElementById('statusBadge');
    const bar = document.getElementById('statusBar');
    if (data.globalDown) {
      badge.textContent = 'Issues Detected';
      badge.className = 'header-badge warning';
      bar.classList.add('visible', 'down');
    } else {
      badge.textContent = 'All Systems Operational';
      badge.className = 'header-badge';
      bar.classList.remove('visible', 'down');
    }

    renderSections(data.sections);
  } catch {}
}

document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('fade-in');
  fetchStatus();
  setInterval(fetchStatus, 10000);
});
