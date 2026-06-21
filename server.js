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
        }
      });
    } catch {}
  }
}
ensureProxmoxSection();

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

setInterval(runAllChecks, 10000);
setTimeout(runAllChecks, 1000);

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

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
    res.json(db.getSections());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sections', (req, res) => {
  try {
    const { name, logo } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    res.json({ id: db.createSection(name, logo) });
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

app.get('/api/sections/slug/:slug', (req, res) => {
  try {
    const sections = db.getSections();
    const section = sections.find(s => slugify(s.name) === req.params.slug);
    if (!section) return res.status(404).json({ error: 'Section not found' });
    res.json(section);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sections/:id/monitors', (req, res) => {
  try {
    res.json(db.getSectionMonitors(parseInt(req.params.id)));
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
    res.json({ id: db.createMonitor(section_id, name, type, target, expected) });
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
    res.json({ globalDown: db.hasAnyDown(), sections });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/proxmox', async (req, res) => {
  try {
    res.json(await proxmox.getStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/proxmox/debug', async (req, res) => {
  try {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    const rawVMs = await execAsync('qm list 2>&1', { timeout: 15000 }).catch(e => ({ stdout: '', stderr: e.message }));
    const rawLXCs = await execAsync('pct list 2>&1', { timeout: 15000 }).catch(e => ({ stdout: '', stderr: e.message }));
    const whichQm = await execAsync('which qm', { timeout: 5000 }).catch(e => ({ stdout: '', stderr: e.message }));
    const whichPct = await execAsync('which pct', { timeout: 5000 }).catch(e => ({ stdout: '', stderr: e.message }));
    res.json({
      which: { qm: whichQm.stdout || whichQm.stderr, pct: whichPct.stdout || whichPct.stderr },
      vms_raw: rawVMs.stdout || rawVMs.stderr,
      lxcs_raw: rawLXCs.stdout || rawLXCs.stderr,
      cache: proxmox.getStatus()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/dash/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/status/:slug', (req, res) => {
  if (req.params.slug === 'proxmox') {
    return res.sendFile(path.join(__dirname, 'public', 'proxmox.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'status.html'));
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Nemea Monitoring running on port ${PORT}`);
});
