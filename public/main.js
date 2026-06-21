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
    return `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <path fill="#E57000" d="M6.573 2.432c-1.453.74-1.453.854-.094 2.375 7.536 8.391 9.339 10.375 9.474 10.375.188.021 10.63-11.391 10.745-11.734.047-.094-.276-.417-.693-.714-.552-.417-1.151-.578-2.281-.625-2.12-.135-2.859.323-5.49 3.276-1.198 1.333-2.214 2.443-2.214 2.443-.021 0-1.01-1.083-2.188-2.396s-2.536-2.63-2.995-2.885c-1.063-.599-3.229-.646-4.271-.115zM1.729 5.823C.599 6.261 0 6.677 0 6.995c0 .161 1.776 2.24 3.922 4.615 2.167 2.375 3.917 4.359 3.917 4.401 0 .047-1.776 2.031-3.922 4.406C1.75 22.813.021 24.912.047 25.094c.115.625 2.005 1.411 3.385 1.411 2.24-.026 2.745-.417 7.474-5.604 2.375-2.604 4.307-4.818 4.307-4.891 0-.089-1.911-2.255-4.26-4.839-3.068-3.344-4.568-4.844-5.281-5.167-1.083-.531-2.833-.62-3.943-.182zm24.625.161c-.672.344-2.354 2.005-5.26 5.188-2.349 2.583-4.266 4.75-4.266 4.839 0 .094 1.938 2.286 4.313 4.891 4.724 5.188 5.234 5.578 7.469 5.604 1.385 0 3.276-.786 3.391-1.411.021-.208-1.708-2.281-3.875-4.656-2.141-2.37-3.917-4.38-3.917-4.427 0-.042 1.776-2.052 3.917-4.427 2.167-2.37 3.896-4.448 3.875-4.63-.115-.599-1.823-1.292-3.297-1.385-1.063-.047-1.615.047-2.349.417zM10.604 22.63c-2.859 3.161-5.208 5.833-5.255 5.948-.047.094.276.417.693.714.552.417 1.151.578 2.281.625 2.099.135 2.88-.349 5.531-3.344 1.156-1.292 2.146-2.375 2.167-2.375.026 0 1.016 1.083 2.193 2.396 2.698 3 3.411 3.438 5.51 3.323 1.13-.047 1.729-.208 2.281-.625.417-.297.74-.62.693-.714-.115-.344-10.563-11.76-10.745-11.734-.094 0-2.49 2.604-5.349 5.786"/>
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
