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
    return `<svg viewBox="0 0 384 64" xmlns="http://www.w3.org/2000/svg">
      <g transform="matrix(.65882 0 0 .65882 -12.696 -13.986)">
        <g id="_x31_">
          <path fill="#E57000" d="m100.6 69.8 24.9 27.3c-2.7 2.8-6.6 4.6-10.7 4.6s-8.4-1.9-11.1-4.9l-13.7-15.1-10.7-11.8 10.7-11.7 13.7-15.1c2.7-3 6.6-4.9 11.1-4.9s8 1.7 10.7 4.5l-24.9 27.3z"/>
          <path fill="#E57000" d="m52.1 69.8-24.9 27.3c2.7 2.8 6.6 4.6 10.7 4.6s8.4-1.9 11.1-4.9l13.7-15.1 10.7-11.8-10.7-11.7-13.7-15.1c-2.7-3-6.6-4.9-11.1-4.9s-8 1.7-10.7 4.5l24.9 27.3z"/>
          <path d="m86.2 83.3-9.8-10.8-9.8 10.8-22.7 24.9c2.5 2.5 6 4.1 9.8 4.1s7.5-1.7 10.1-4.5l12.6-13.8 12.5 13.8c2.5 2.7 6.1 4.5 10.1 4.5s7.3-1.6 9.8-4.1l-22.7-24.9z"/>
          <path d="m86.2 56.3-9.8 10.8-9.8-10.8-22.7-24.9c2.5-2.5 6-4.1 9.8-4.1s7.5 1.7 10.1 4.5l12.6 13.8 12.5-13.8c2.5-2.7 6.1-4.5 10.1-4.5s7.3 1.6 9.8 4.1l-22.7 24.9z"/>
          <path d="m176.5 71.5c3.4 0 3.4-3.4 3.4-3.4v-8.5c0-3.4-3.4-3.4-3.4-3.4h-23.9v15.3zm17.1-15.3v13.6c0 7.6-6.2 13.6-13.7 13.6h-27.3c0 7.6-6.1 13.6-13.6 13.6v-49.4c0-2.8 2.3-5.1 5.1-5.1h35.8c7.6 0 13.7 6.2 13.7 13.7"/>
          <path d="m238.9 68.1c3.4 0 3.4-3.4 3.4-3.4v-5.1c0-3.4-3.4-3.4-3.4-3.4h-23.8v11.8zm6.1 11.8 11 15.7c-1.9 1-4.1 1.6-6.3 1.6-4.7 0-8.7-2.3-11.2-5.8l-7.9-11.2h-15.5v3.4c0 7.6-6.2 13.6-13.7 13.6v-49.4c0-2.8 2.3-5.1 5.1-5.1h35.8c7.6 0 13.7 6.2 13.7 13.7v10.2c0 6.6-4.8 12.2-11 13.3"/>
          <path d="m304.6 59.6c0-3.4-3.4-3.4-3.4-3.4h-20.4c-3.4 0-3.4 3.4-3.4 3.4v20.4c0 3.4 3.4 3.4 3.4 3.4h20.4c3.4 0 3.4-3.4 3.4-3.4zm13.7-3.4v27.2c0 7.6-6.1 13.6-13.7 13.6h-27.2c-7.6 0-13.7-6.1-13.7-13.6v-27.2c0-7.6 6.1-13.7 13.7-13.7h27.2c7.6 0 13.7 6.2 13.7 13.7"/>
          <path fill="#E57000" d="m365.8 69.8 21.3 23.4c-2.3 2.4-5.6 3.9-9.2 3.9s-7.2-1.6-9.5-4.2l-11.8-12.9-11.8 12.9c-2.3 2.6-5.8 4.2-9.5 4.2s-6.9-1.5-9.2-3.9l21.3-23.4-21.3-23.4c2.3-2.3 5.6-3.8 9.2-3.8s7 1.6 9.4 4.2l11.9 12.9 11.8-12.9c2.3-2.6 5.7-4.2 9.5-4.2s6.9 1.5 9.2 3.8z"/>
          <path d="m463.1 47.7v49.4c-7.5 0-13.7-6.1-13.7-13.6v-26.1c0-0.7-0.5-1.2-1.1-1.2s-0.9 0.3-1.1 0.6l-15.1 33.4c-0.6 1.2-1.8 1.9-3.1 1.9s-2.6-0.9-3.1-2l-15.1-33.4c-0.2-0.3-0.6-0.6-1-0.6-0.7 0-1.2 0.5-1.2 1.2v26.1c0 7.6-6.2 13.6-13.7 13.6v-49.4c0-2.8 2.3-5.1 5.1-5.1h8.5c5.5 0 10.4 3.4 12.5 8.2v-0.2l8 17.6 8-17.6v0.2c2.1-4.8 6.9-8.2 12.4-8.2h8.6c2.8 0 5.1 2.3 5.1 5.2"/>
          <path d="m511.7 59.6c0-3.4-3.4-3.4-3.4-3.4h-20.4c-3.4 0-3.4 3.4-3.4 3.4v20.4c0 3.4 3.4 3.4 3.4 3.4h20.4c3.4 0 3.4-3.4 3.4-3.4zm13.7-3.4v27.2c0 7.6-6.1 13.6-13.7 13.6h-27.2c-7.6 0-13.7-6.1-13.7-13.6v-27.2c0-7.6 6.1-13.7 13.7-13.7h27.2c7.6 0 13.7 6.2 13.7 13.7"/>
          <path fill="#E57000" d="m572.9 69.8 21.3 23.4c-2.3 2.4-5.6 3.9-9.2 3.9s-7.2-1.6-9.5-4.2l-11.8-12.9-11.8 12.9c-2.3 2.6-5.8 4.2-9.5 4.2s-6.9-1.5-9.2-3.9l21.3-23.4-21.3-23.4c2.3-2.3 5.6-3.8 9.2-3.8s7 1.6 9.4 4.2l11.9 12.9 11.8-12.9c2.3-2.6 5.7-4.2 9.5-4.2s6.9 1.5 9.2 3.8z"/>
        </g>
      </g>
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
