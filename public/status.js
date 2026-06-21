function monitorIcon(type) {
  const icons = {
    'url-unavailable': '\u{1F310}',
    'url-no-keyword': '\u{1F50D}',
    'url-has-keyword': '\u{1F50E}',
    'url-non-200': '\u{1F4F7}',
    'ping-no-response': '\u{1F4E1}',
    'tcp-no-response': '\u{1F4F6}',
    'udp-no-response': '\u{1F4F5}',
    'smtp-no-response': '\u{2709}\u{FE0F}',
    'pop3-no-response': '\u{1F4E8}',
    'imap-no-response': '\u{1F4EC}',
    'dns-no-response': '\u{1F30D}',
    'playwright-fails': '\u{1F3AC}'
  };
  return icons[type] || '\u{1F4A1}';
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

function renderMonitors(section) {
  const container = document.getElementById('monitorList');
  const title = document.getElementById('sectionTitle');
  const subtitle = document.getElementById('sectionSubtitle');
  const pill = document.getElementById('sectionPill');

  const up = section.monitors.filter(m => m.status === 'up').length;
  const total = section.monitors.length;
  const color = section.status === 'up' ? 'green' : section.status === 'degraded' ? 'orange' : 'red';

  title.textContent = section.name;
  subtitle.textContent = `${up}/${total} monitors operational`;
  pill.textContent = section.status;
  pill.className = `status-pill ${section.status}`;

  if (!section.monitors.length) {
    container.innerHTML = '<div class="section-empty">No monitors configured in this section</div>';
    return;
  }

  let html = '<div class="monitor-list">';
  for (const m of section.monitors) {
    const ic = m.status === 'up' ? 'up' : m.status === 'down' ? 'down' : 'unknown';
    html += `
      <div class="monitor-item">
        <div class="monitor-icon ${ic}">${monitorIcon(m.type)}</div>
        <div class="monitor-info">
          <div class="monitor-name">${m.name}</div>
          <div class="monitor-type-label">${typeLabel(m.type)} &middot; ${m.target}</div>
        </div>
        <div class="monitor-right">
          <div class="monitor-status-text ${ic}">${m.status === 'up' ? 'Operational' : m.status === 'down' ? 'Down' : 'Pending'}</div>
          ${m.message ? `<div class="monitor-message">${m.message}</div>` : ''}
        </div>
      </div>`;
  }
  html += '</div>';
  container.innerHTML = html;
}

async function loadSection() {
  const slug = window.location.pathname.replace('/status/', '');
  if (!slug) return;

  try {
    const res = await fetch(`/api/sections/slug/${slug}`);
    if (!res.ok) throw new Error('Not found');
    const section = await res.json();
    renderMonitors(section);
  } catch {
    document.getElementById('monitorList').innerHTML =
      '<div class="section-empty" style="color:var(--red)">Section not found</div>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('fade-in');
  loadSection();
  setInterval(loadSection, 10000);
});
