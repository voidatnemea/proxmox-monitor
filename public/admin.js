let sections = [];
let editingSectionId = null;
let editingMonitorId = null;
let editingSectionForMonitor = null;

function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

async function loadAdmin() {
  try {
    const res = await fetch('/api/sections');
    if (!res.ok) throw new Error(res.statusText);
    sections = await res.json();
    renderAdmin();
  } catch (e) {
    document.getElementById('adminContent').innerHTML =
      '<div class="empty-state"><p style="color:var(--red)">Failed to load configuration: ' + e.message + '</p></div>';
  }
}

function renderAdmin() {
  const container = document.getElementById('adminContent');

  if (sections.length === 0) {
    container.innerHTML = '<div class="empty-state"><div style="font-size:40px;margin-bottom:12px">&#9881;</div><p>No sections configured</p><p>Create your first section to get started</p></div>';
    return;
  }

  let html = '';
  for (const section of sections) {
    const monitors = section.monitors || [];

    html += `
      <div class="admin-section">
        <div class="admin-section-header">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:20px">${getLogoPreview(section.logo)}</span>
            <h2>${section.name}</h2>
          </div>
          <div class="admin-actions">
            <button class="btn btn-sm" onclick="openMonitorModal(${section.id})">+ Monitor</button>
            <button class="btn btn-sm" onclick="editSection(${section.id})">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteSection(${section.id})">Delete</button>
          </div>
        </div>
        ${monitors.length === 0 ? '<div class="empty-state" style="padding:16px"><p>No monitors in this section</p></div>' :
          monitors.map(m => `
            <div class="admin-monitor-item">
              <span class="status-dot ${m.status === 'up' ? 'green' : m.status === 'down' ? 'red' : ''}"></span>
              <div class="admin-monitor-name">${m.name}</div>
              <span class="admin-monitor-type">${typeLabel(m.type)}</span>
              <div class="admin-actions">
                <button class="btn btn-sm" onclick="editMonitor(${m.id}, ${section.id})">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteMonitor(${m.id})">Delete</button>
              </div>
            </div>
          `).join('')}
      </div>`;
  }

  container.innerHTML = html;
}

function getLogoPreview(logo) {
  const logos = {
    'server': '\u{1F5A5}',
    'cloud': '\u{2601}',
    'database': '\u{1F4BE}',
    'globe': '\u{1F310}',
    'shield': '\u{1F6E1}',
    'proxmox': '\u{1F5A5}'
  };
  return logos[logo] || logo || '';
}

function typeLabel(type) {
  const labels = {
    'url-unavailable': 'URL Availability',
    'url-no-keyword': 'URL Missing Keyword',
    'url-has-keyword': 'URL Contains Keyword',
    'url-non-200': 'HTTP Status',
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

// --- Sections ---
function openSectionModal(sectionId) {
  editingSectionId = sectionId || null;
  document.getElementById('sectionModalTitle').textContent = editingSectionId ? 'Edit Section' : 'New Section';
  document.getElementById('sectionNameInput').value = '';
  document.getElementById('sectionLogoInput').value = '';

  if (editingSectionId) {
    const section = sections.find(s => s.id === editingSectionId);
    if (section) {
      document.getElementById('sectionNameInput').value = section.name;
      document.getElementById('sectionLogoInput').value = section.logo || '';
    }
  }

  openModal('sectionModal');
}

async function saveSection() {
  const name = document.getElementById('sectionNameInput').value.trim();
  const logo = document.getElementById('sectionLogoInput').value;

  if (!name) {
    document.getElementById('sectionNameInput').style.borderColor = 'rgba(255,23,68,0.5)';
    setTimeout(() => document.getElementById('sectionNameInput').style.borderColor = '', 2000);
    return;
  }

  const btn = document.getElementById('sectionSaveBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    if (editingSectionId) {
      await fetch(`/api/sections/${editingSectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, logo })
      });
    } else {
      await fetch('/api/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, logo })
      });
    }
    closeModal('sectionModal');
    await loadAdmin();
  } catch {}

  btn.disabled = false;
  btn.textContent = 'Save';
}

async function deleteSection(id) {
  if (!confirm('Delete this section and all its monitors?')) return;
  try {
    await fetch(`/api/sections/${id}`, { method: 'DELETE' });
    await loadAdmin();
  } catch {}
}

function editSection(id) {
  openSectionModal(id);
}

// --- Monitors ---
function openMonitorModal(sectionId, monitorId) {
  editingMonitorId = monitorId || null;
  editingSectionForMonitor = sectionId;
  document.getElementById('monitorModalTitle').textContent = editingMonitorId ? 'Edit Monitor' : 'New Monitor';
  document.getElementById('monitorNameInput').value = '';
  document.getElementById('monitorTypeInput').value = 'url-non-200';
  document.getElementById('monitorTargetInput').value = '';
  document.getElementById('monitorExpectedInput').value = '';
  updateTargetLabel('url-non-200');

  if (editingMonitorId) {
    for (const section of sections) {
      const mon = (section.monitors || []).find(m => m.id === editingMonitorId);
      if (mon) {
        document.getElementById('monitorNameInput').value = mon.name;
        document.getElementById('monitorTypeInput').value = mon.type;
        document.getElementById('monitorTargetInput').value = mon.target;
        document.getElementById('monitorExpectedInput').value = mon.expected || '';
        updateTargetLabel(mon.type);
        break;
      }
    }
  }

  openModal('monitorModal');
}

function updateTargetLabel(type) {
  const targetLabel = document.getElementById('targetLabel');
  const expectedGroup = document.getElementById('expectedGroup');
  const expectedLabel = document.getElementById('expectedLabel');
  const expectedHelp = document.getElementById('expectedHelp');

  const needsExpected = ['url-no-keyword', 'url-has-keyword', 'tcp-no-response', 'udp-no-response', 'dns-no-response', 'playwright-fails'];

  if (type === 'url-unavailable' || type === 'url-no-keyword' || type === 'url-has-keyword' || type === 'url-non-200' || type === 'playwright-fails') {
    targetLabel.textContent = 'URL';
    document.getElementById('monitorTargetInput').placeholder = 'https://example.com';
  } else if (type === 'ping-no-response') {
    targetLabel.textContent = 'Hostname / IP';
    document.getElementById('monitorTargetInput').placeholder = '192.168.1.1 or example.com';
  } else if (type === 'tcp-no-response' || type === 'udp-no-response') {
    targetLabel.textContent = 'Hostname / IP';
    document.getElementById('monitorTargetInput').placeholder = '192.168.1.1';
  } else if (type === 'smtp-no-response' || type === 'pop3-no-response' || type === 'imap-no-response') {
    targetLabel.textContent = 'Mail Server Hostname / IP';
    document.getElementById('monitorTargetInput').placeholder = 'mail.example.com';
  } else if (type === 'dns-no-response') {
    targetLabel.textContent = 'DNS Server IP';
    document.getElementById('monitorTargetInput').placeholder = '8.8.8.8';
  }

  if (needsExpected.includes(type)) {
    expectedGroup.style.display = 'block';
    if (type === 'url-no-keyword' || type === 'url-has-keyword') {
      expectedLabel.textContent = 'Keyword';
      document.getElementById('monitorExpectedInput').placeholder = 'keyword to check';
      expectedHelp.textContent = 'The text content to search for in the page';
    } else if (type === 'tcp-no-response' || type === 'udp-no-response') {
      expectedLabel.textContent = 'Port Number';
      document.getElementById('monitorExpectedInput').placeholder = 'e.g. 80, 443, 22';
      expectedHelp.textContent = 'The port number to check';
    } else if (type === 'dns-no-response') {
      expectedLabel.textContent = 'Domain to Resolve';
      document.getElementById('monitorExpectedInput').placeholder = 'google.com';
      expectedHelp.textContent = 'The domain name that should be resolvable';
    } else if (type === 'playwright-fails') {
      expectedLabel.textContent = 'CSS Selector (optional)';
      document.getElementById('monitorExpectedInput').placeholder = 'body .main-content';
      expectedHelp.textContent = 'Wait for this element to appear on the page (optional)';
    }
  } else {
    expectedGroup.style.display = 'none';
  }
}

async function saveMonitor() {
  const name = document.getElementById('monitorNameInput').value.trim();
  const type = document.getElementById('monitorTypeInput').value;
  const target = document.getElementById('monitorTargetInput').value.trim();
  const expected = document.getElementById('monitorExpectedInput').value.trim();

  if (!name || !target) {
    if (!name) {
      document.getElementById('monitorNameInput').style.borderColor = 'rgba(255,23,68,0.5)';
      setTimeout(() => document.getElementById('monitorNameInput').style.borderColor = '', 2000);
    }
    if (!target) {
      document.getElementById('monitorTargetInput').style.borderColor = 'rgba(255,23,68,0.5)';
      setTimeout(() => document.getElementById('monitorTargetInput').style.borderColor = '', 2000);
    }
    return;
  }

  const btn = document.getElementById('monitorSaveBtn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    if (editingMonitorId) {
      await fetch(`/api/monitors/${editingMonitorId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, target, expected })
      });
    } else {
      await fetch('/api/monitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_id: editingSectionForMonitor, name, type, target, expected })
      });
    }
    closeModal('monitorModal');
    await loadAdmin();
  } catch {}

  btn.disabled = false;
  btn.textContent = 'Save';
}

function editMonitor(id, sectionId) {
  openMonitorModal(sectionId, id);
}

async function deleteMonitor(id) {
  if (!confirm('Delete this monitor?')) return;
  try {
    await fetch(`/api/monitors/${id}`, { method: 'DELETE' });
    await loadAdmin();
  } catch {}
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('monitorTypeInput').addEventListener('change', function() {
    updateTargetLabel(this.value);
  });
  loadAdmin();
  setInterval(loadAdmin, 30000);
});
