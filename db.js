// BrainBase — db.js
// Dexie.js (IndexedDB wrapper) データベース定義

const db = new Dexie('BrainBaseDB');

db.version(1).stores({
  tasks:    '++id, title, project, priority, dueDate, done, createdAt',
  ideas:    '++id, title, body, converted, createdAt',
  drafts:   '++id, body, createdAt',
  settings: 'id, claudeKey, githubToken',
});

// エラーハンドリング
db.on('blocked', () => {
  console.warn('BrainBaseDB: アップグレードがブロックされています');
});
