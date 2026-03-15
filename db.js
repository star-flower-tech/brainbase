// BrainBase — db.js v2
// Dexie.js IndexedDB スキーマ定義

const db = new Dexie('BrainBaseDB');

// v1 (互換性のために残す)
db.version(1).stores({
  tasks:    '++id, title, project, priority, dueDate, done, createdAt',
  ideas:    '++id, title, body, converted, createdAt',
  drafts:   '++id, body, createdAt',
  settings: 'id, claudeKey, githubToken',
});

// v2 (businesses + goals 追加)
db.version(2).stores({
  businesses: '++id, name',
  goals:      '++id, title, businessId, status, targetDate',
  tasks:      '++id, title, goalId, businessId, project, priority, dueDate, done, createdAt',
  ideas:      '++id, title, body, converted, createdAt',
  drafts:     '++id, body, createdAt',
  settings:   'id, claudeKey, githubToken',
});

db.on('blocked', () => console.warn('BrainBaseDB: upgrade blocked'));
