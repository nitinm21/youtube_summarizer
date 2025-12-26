import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { createTablesSQL } from './schema';

const DB_PATH = process.env.DATABASE_PATH || './data/youtube_summarizer.db';

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    // Ensure data directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Initialize tables
    db.exec(createTablesSQL);
  }
  return db;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
