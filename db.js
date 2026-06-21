const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'monitor.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    logo TEXT DEFAULT '',
    position INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS monitors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    section_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    target TEXT NOT NULL,
    expected TEXT DEFAULT '',
    position INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS monitor_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    monitor_id INTEGER NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'unknown',
    message TEXT DEFAULT '',
    checked_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS proxmox_cache (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'lxc',
    status TEXT NOT NULL DEFAULT 'stopped',
    ips TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

function getSections() {
  const sections = db.prepare('SELECT * FROM sections ORDER BY position, id').all();
  const getMonitors = db.prepare('SELECT * FROM monitors WHERE section_id = ? ORDER BY position, id');
  const getStatus = db.prepare('SELECT status, message, checked_at FROM monitor_status WHERE monitor_id = ?');
  const allUp = db.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN ms.status = 'up' THEN 1 ELSE 0 END) as up_count
    FROM monitors m LEFT JOIN monitor_status ms ON m.id = ms.monitor_id WHERE m.section_id = ?`);

  for (const section of sections) {
    const monitors = getMonitors.all(section.id);
    const row = allUp.get(section.id);
    const total = row.total || 0;
    const up = row.up_count || 0;

    if (total === 0) {
      section.status = 'up';
    } else if (up === total) {
      section.status = 'up';
    } else if (up === 0) {
      section.status = 'down';
    } else {
      section.status = 'degraded';
    }

    section.monitors = monitors.map(m => {
      const s = getStatus.get(m.id);
      return {
        ...m,
        status: s ? s.status : 'unknown',
        message: s ? s.message : '',
        checked_at: s ? s.checked_at : null
      };
    });
  }

  return sections;
}

function getSection(id) {
  return db.prepare('SELECT * FROM sections WHERE id = ?').get(id);
}

function createSection(name, logo) {
  const stmt = db.prepare('INSERT INTO sections (name, logo) VALUES (?, ?)');
  return stmt.run(name, logo || '').lastInsertRowid;
}

function updateSection(id, name, logo) {
  db.prepare('UPDATE sections SET name = ?, logo = ? WHERE id = ?').run(name, logo || '', id);
}

function deleteSection(id) {
  db.prepare('DELETE FROM sections WHERE id = ?').run(id);
}

function getMonitors() {
  return db.prepare('SELECT * FROM monitors ORDER BY section_id, position, id').all();
}

function getMonitor(id) {
  return db.prepare('SELECT * FROM monitors WHERE id = ?').get(id);
}

function getSectionMonitors(sectionId) {
  return db.prepare('SELECT * FROM monitors WHERE section_id = ? ORDER BY position, id').all(sectionId);
}

function createMonitor(sectionId, name, type, target, expected) {
  const stmt = db.prepare('INSERT INTO monitors (section_id, name, type, target, expected) VALUES (?, ?, ?, ?, ?)');
  const id = stmt.run(sectionId, name, type, target, expected || '').lastInsertRowid;
  db.prepare('INSERT OR IGNORE INTO monitor_status (monitor_id, status, message) VALUES (?, ?, ?)').run(id, 'unknown', 'Pending first check');
  return id;
}

function updateMonitor(id, name, type, target, expected) {
  db.prepare('UPDATE monitors SET name = ?, type = ?, target = ?, expected = ? WHERE id = ?').run(name, type, target, expected || '', id);
}

function deleteMonitor(id) {
  db.prepare('DELETE FROM monitors WHERE id = ?').run(id);
}

function getStatus(monitorId) {
  return db.prepare('SELECT * FROM monitor_status WHERE monitor_id = ?').get(monitorId);
}

function updateStatus(monitorId, status, message) {
  db.prepare(`INSERT INTO monitor_status (monitor_id, status, message, checked_at) VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(monitor_id) DO UPDATE SET status = excluded.status, message = excluded.message, checked_at = excluded.checked_at`)
    .run(monitorId, status, message || '');
}

function getAllStatus() {
  return db.prepare(`SELECT m.*, ms.status as monitor_status, ms.message, ms.checked_at
    FROM monitors m LEFT JOIN monitor_status ms ON m.id = ms.monitor_id ORDER BY m.section_id, m.position, m.id`).all();
}

function getPrevStatus(id) {
  return db.prepare('SELECT status FROM monitor_status WHERE monitor_id = ?').get(id);
}

function hasAnyDown() {
  const row = db.prepare("SELECT COUNT(*) as cnt FROM monitor_status WHERE status = 'down'").get();
  return row.cnt > 0;
}

// --- Proxmox cache ---

function getProxmoxCache() {
  return db.prepare('SELECT * FROM proxmox_cache ORDER BY type, id').all();
}

function upsertProxmoxCache(id, name, type, status, ips) {
  db.prepare(`INSERT INTO proxmox_cache (id, name, type, status, ips, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, status = excluded.status, ips = excluded.ips, updated_at = excluded.updated_at`)
    .run(id, name, type, status, ips || '');
}

function updateProxmoxStatus(id, status) {
  db.prepare("UPDATE proxmox_cache SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
}

function deleteProxmoxCache(id) {
  db.prepare('DELETE FROM proxmox_cache WHERE id = ?').run(id);
}

function clearProxmoxCache() {
  db.prepare('DELETE FROM proxmox_cache').run();
}

module.exports = {
  getSections, getSection, createSection, updateSection, deleteSection,
  getMonitors, getMonitor, getSectionMonitors,
  createMonitor, updateMonitor, deleteMonitor,
  getStatus, updateStatus, getAllStatus, getPrevStatus, hasAnyDown,
  getProxmoxCache, upsertProxmoxCache, updateProxmoxStatus, deleteProxmoxCache, clearProxmoxCache
};
