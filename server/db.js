'use strict';

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'tasks.db');
const db = new Database(DB_PATH);

// WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// ===== スキーマ作成 =====
db.exec(`
  CREATE TABLE IF NOT EXISTS businesses (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    icon      TEXT NOT NULL DEFAULT '🏢',
    color     TEXT NOT NULL DEFAULT '#7C5CFC',
    createdAt TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS goals (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    businessId INTEGER NOT NULL,
    progress   INTEGER NOT NULL DEFAULT 0,
    status     TEXT NOT NULL DEFAULT 'active',
    targetDate TEXT,
    createdAt  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    title          TEXT NOT NULL,
    businessId     INTEGER,
    goalId         INTEGER,
    project        TEXT,
    priority       TEXT NOT NULL DEFAULT 'normal',
    dueDate        TEXT,
    done           INTEGER NOT NULL DEFAULT 0,
    source         TEXT NOT NULL DEFAULT 'manual',
    claudeToolName TEXT,
    createdAt      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    completedAt    TEXT
  );

  CREATE TABLE IF NOT EXISTS ideas (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    title     TEXT NOT NULL,
    body      TEXT,
    converted INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS drafts (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    body      TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS settings (
    id          INTEGER PRIMARY KEY,
    githubToken TEXT
  );
`);

// ===== 初期データ投入（事業が0件のときのみ） =====
const bizCount = db.prepare('SELECT COUNT(*) as cnt FROM businesses').get();
if (bizCount.cnt === 0) {
  const insert = db.prepare(
    'INSERT INTO businesses (name, icon, color) VALUES (?, ?, ?)'
  );
  insert.run('住まいセレクト',     '🏠', '#FF6B47');
  insert.run('不動産広告代理',     '📢', '#F59E0B');
  insert.run('AI導入支援',         '🤖', '#7C5CFC');
  insert.run('BrainBase',         '🧠', '#22C55E');
}

module.exports = db;
