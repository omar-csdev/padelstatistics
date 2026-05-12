import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (_db) return _db;
  _db = SQLite.openDatabaseSync('padelstatistics.db');
  initSchema(_db);
  return _db;
}

function initSchema(db: SQLite.SQLiteDatabase): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL,
      finished_at INTEGER,
      status TEXT NOT NULL,
      team_a_name TEXT NOT NULL,
      team_b_name TEXT NOT NULL,
      p_tl TEXT NOT NULL,
      p_tr TEXT NOT NULL,
      p_bl TEXT NOT NULL,
      p_br TEXT NOT NULL,
      best_of INTEGER NOT NULL,
      scoring TEXT NOT NULL,
      first_server TEXT NOT NULL,
      tag TEXT
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      ts INTEGER NOT NULL,
      winner_team TEXT NOT NULL,
      by_pos TEXT NOT NULL,
      by_player TEXT NOT NULL,
      result TEXT NOT NULL,
      shot TEXT,
      error_kind TEXT,
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_events_match ON events(match_id, seq);
  `);
}
