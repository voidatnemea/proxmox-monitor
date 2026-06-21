const express = require('express');
const path = require('path');
const db = require('./db');
const proxmox = require('./proxmox');
const checks = require('./checks/index');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function ensureProxmoxSection() {
  const sections = db.getSections();
  const hasProxmox = sections.some(s => s.name.toLowerCase() === 'proxmox');
  if (!hasProxmox) {
    try {
      exec('which qm pct 2>/dev/null', (err) => {
        if (!err) {
          db.createSection('Proxmox', 'proxmox');
          console.log('Auto-created Proxmox section');
        }
      });
    } catch {}
  }
}

ensureProxmoxSection();

// --- Status Checks ---
let prevStatuses = {};

async function runAllChecks() {
  const monitors = db.getMonitors();
  for (const mon of monitors) {
    try {
      const prev = db.getPrevStatus(mon.id);
      const result = await checks.run(mon);
      db.updateStatus(mon.id, result.status, result.message);

      const prevStatus = prev ? prev.status : 'unknown';
      if (prevStatus !== 'down' && result.status === 'down') {
        prevStatuses[mon.id] = { justWentDown: true };
      }
    } catch (err) {
      db.updateStatus(mon.id, 'down', err.message);
    }
  }
}

const CHECK_INTERVAL = 10000;
setInterval(runAllChecks, CHECK_INTERVAL);
setTimeout(runAllChecks, 1000);

// --- API Routes ---

app.get('/api/alerts', (req, res) => {
  const justDown = {};
  for (const [id, val] of Object.entries(prevStatuses)) {
    if (val.justWentDown) {
      justDown[id] = true;
      prevStatuses[id].justWentDown = false;
    }
  }
  res.json({ alerts: justDown, hasDown: db.hasAnyDown() });
});

app.get('/api/sections', (req, res) => {
  try {
    const sections = db.getSections();
    res.json(sections);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sections', (req, res) => {
  try {
    const { name, logo } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const id = db.createSection(name, logo);
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/sections/:id', (req, res) => {
  try {
    const { name, logo } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    db.updateSection(parseInt(req.params.id), name, logo);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sections/:id', (req, res) => {
  try {
    db.deleteSection(parseInt(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sections/:id/monitors', (req, res) => {
  try {
    const monitors = db.getSectionMonitors(parseInt(req.params.id));
    res.json(monitors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/monitors', (req, res) => {
  try {
    const { section_id, name, type, target, expected } = req.body;
    if (!section_id || !name || !type || !target) {
      return res.status(400).json({ error: 'section_id, name, type, target required' });
    }
    const id = db.createMonitor(section_id, name, type, target, expected);
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/monitors/:id', (req, res) => {
  try {
    const { name, type, target, expected } = req.body;
    if (!name || !type || !target) {
      return res.status(400).json({ error: 'name, type, target required' });
    }
    db.updateMonitor(parseInt(req.params.id), name, type, target, expected);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/monitors/:id', (req, res) => {
  try {
    db.deleteMonitor(parseInt(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/status', (req, res) => {
  try {
    const sections = db.getSections();
    res.json({
      globalDown: db.hasAnyDown(),
      sections
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/proxmox', async (req, res) => {
  try {
    const data = await proxmox.getStatus();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NmaMonitor running on port ${PORT}`);
});
