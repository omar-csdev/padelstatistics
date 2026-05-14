import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (_db) return _db;
  _db = SQLite.openDatabaseSync('padelstatistics.db');
  initSchema(_db);
  return _db;
}

function initSchema(db: SQLite.SQLiteDatabase): void {
  // Phase 1 used INTEGER PKs without sync_status. Drop the legacy tables on
  // dev devices before creating the Phase-2 schema — no released users yet.
  const legacy = db.getFirstSync<{ name: string }>(
    `SELECT name FROM pragma_table_info('matches') WHERE name = 'id' AND type = 'INTEGER'`,
  );
  if (legacy) {
    db.execSync('DROP TABLE IF EXISTS events; DROP TABLE IF EXISTS matches;');
  }

  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      user_id TEXT,
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
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      ts INTEGER NOT NULL,
      winner_team TEXT NOT NULL,
      by_pos TEXT NOT NULL,
      by_player TEXT NOT NULL,
      result TEXT NOT NULL,
      shot TEXT,
      error_kind TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_events_match ON events(match_id, seq);
    CREATE INDEX IF NOT EXISTS idx_matches_sync ON matches(sync_status);
    CREATE INDEX IF NOT EXISTS idx_events_sync ON events(sync_status);
  `);
}

export function wipe(): void {
  const db = getDb();
  db.execSync('DELETE FROM events; DELETE FROM matches;');
}
