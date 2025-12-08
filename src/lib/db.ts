import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

function ensureDatabase(): Database.Database | null {
  if (db) return db;

  try {
    const dataDir = path.join(__dirname, '..', '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = process.env.SQLITE_PATH || path.join(dataDir, 'jeeves.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.prepare(
      `CREATE TABLE IF NOT EXISTS mod_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        user_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        reason TEXT,
        created_at INTEGER NOT NULL,
        context TEXT
      );`,
    ).run();
    return db;
  } catch (error) {
    console.warn('SQLite unavailable, continuing without DB logging', error);
    db = null;
    return null;
  }
}

export function getDb(): Database.Database | null {
  return ensureDatabase();
}
