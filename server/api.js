'use strict';

const express = require('express');
const cors    = require('cors');
const db      = require('./db');

const app  = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ===== GET /api/health =====
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// ===== GET /api/businesses =====
app.get('/api/businesses', (_req, res) => {
  const rows = db.prepare('SELECT * FROM businesses ORDER BY id').all();
  res.json(rows);
});

// ===== GET /api/tasks =====
// クエリ: ?date=YYYY-MM-DD  ?done=false
app.get('/api/tasks', (req, res) => {
  let sql    = 'SELECT * FROM tasks WHERE 1=1';
  const params = [];

  if (req.query.date) {
    sql += ' AND dueDate = ?';
    params.push(req.query.date);
  }
  if (req.query.done === 'false') {
    sql += ' AND done = 0';
  } else if (req.query.done === 'true') {
    sql += ' AND done = 1';
  }

  sql += ' ORDER BY createdAt DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// ===== POST /api/tasks =====
app.post('/api/tasks', (req, res) => {
  const { title, businessId, goalId, project, priority, dueDate, source, claudeToolName } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const stmt = db.prepare(`
    INSERT INTO tasks (title, businessId, goalId, project, priority, dueDate, source, claudeToolName)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    title,
    businessId  || null,
    goalId      || null,
    project     || null,
    priority    || 'normal',
    dueDate     || null,
    source      || 'manual',
    claudeToolName || null
  );
  const created = db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

// ===== PUT /api/tasks/:id/complete =====
app.put('/api/tasks/:id/complete', (req, res) => {
  const { id } = req.params;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!task) return res.status(404).json({ error: 'not found' });

  db.prepare('UPDATE tasks SET done = 1, completedAt = datetime(\'now\',\'localtime\') WHERE id = ?').run(id);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json(updated);
});

// ===== DELETE /api/tasks/:id =====
app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ===== GET /api/ideas =====
app.get('/api/ideas', (_req, res) => {
  const rows = db.prepare('SELECT * FROM ideas ORDER BY createdAt DESC').all();
  res.json(rows);
});

// ===== POST /api/ideas =====
app.post('/api/ideas', (req, res) => {
  const { title, body } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const info = db.prepare('INSERT INTO ideas (title, body) VALUES (?, ?)').run(title, body || null);
  const created = db.prepare('SELECT * FROM ideas WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

// ===== GET /api/goals =====
app.get('/api/goals', (_req, res) => {
  const rows = db.prepare('SELECT * FROM goals ORDER BY createdAt DESC').all();
  res.json(rows);
});

// ===== POST /api/goals =====
app.post('/api/goals', (req, res) => {
  const { title, businessId, targetDate } = req.body;
  if (!title || !businessId) return res.status(400).json({ error: 'title and businessId are required' });
  const info = db.prepare(
    'INSERT INTO goals (title, businessId, targetDate) VALUES (?, ?, ?)'
  ).run(title, businessId, targetDate || null);
  const created = db.prepare('SELECT * FROM goals WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(created);
});

// ===== GET /api/stats =====
app.get('/api/stats', (_req, res) => {
  const totalTasks  = db.prepare('SELECT COUNT(*) as cnt FROM tasks').get().cnt;
  const doneTasks   = db.prepare('SELECT COUNT(*) as cnt FROM tasks WHERE done = 1').get().cnt;
  const ideas       = db.prepare('SELECT COUNT(*) as cnt FROM ideas').get().cnt;
  const claudeTasks = db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE source = 'claude'").get().cnt;
  res.json({ totalTasks, doneTasks, ideas, claudeTasks });
});

// ===== 起動 =====
app.listen(PORT, () => {
  console.log(`BrainBase API server running on http://localhost:${PORT}`);
  console.log('Health check: http://localhost:' + PORT + '/api/health');
});
