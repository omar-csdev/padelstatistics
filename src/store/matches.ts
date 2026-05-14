import * as Crypto from 'expo-crypto';
import type { MatchConfig, ScoringVariant, Team } from '@/src/engine/types';
import { getDb } from './db';

export type MatchStatus = 'in_progress' | 'finished';
export type SyncStatus = 'pending' | 'synced';

export interface MatchRow {
  id: string;
  userId: string | null;
  createdAt: number;
  finishedAt: number | null;
  status: MatchStatus;
  config: MatchConfig;
  syncStatus: SyncStatus;
}

interface RawRow {
  id: string;
  user_id: string | null;
  created_at: number;
  finished_at: number | null;
  status: MatchStatus;
  team_a_name: string;
  team_b_name: string;
  p_tl: string;
  p_tr: string;
  p_bl: string;
  p_br: string;
  best_of: number;
  scoring: ScoringVariant;
  first_server: Team;
  sync_status: SyncStatus;
}

function toRow(r: RawRow): MatchRow {
  return {
    id: r.id,
    userId: r.user_id,
    createdAt: r.created_at,
    finishedAt: r.finished_at,
    status: r.status,
    syncStatus: r.sync_status,
    config: {
      teamNames: [r.team_a_name, r.team_b_name],
      positions: { tl: r.p_tl, tr: r.p_tr, bl: r.p_bl, br: r.p_br },
      bestOf: r.best_of as 3 | 5,
      scoring: r.scoring,
      firstServer: r.first_server,
    },
  };
}

export function createMatch(config: MatchConfig, opts?: { userId?: string | null }): string {
  const db = getDb();
  const id = Crypto.randomUUID();
  const now = Date.now();
  db.runSync(
    `INSERT INTO matches (id, user_id, created_at, status, team_a_name, team_b_name,
                          p_tl, p_tr, p_bl, p_br, best_of, scoring, first_server, sync_status)
     VALUES (?, ?, ?, 'in_progress', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
      opts?.userId ?? null,
      now,
      config.teamNames[0],
      config.teamNames[1],
      config.positions.tl,
      config.positions.tr,
      config.positions.bl,
      config.positions.br,
      config.bestOf,
      config.scoring,
      config.firstServer,
    ],
  );
  return id;
}

export function getMatch(id: string): MatchRow | null {
  const db = getDb();
  const row = db.getFirstSync<RawRow>(`SELECT * FROM matches WHERE id = ?`, [id]);
  return row ? toRow(row) : null;
}

export function listMatches(): MatchRow[] {
  const db = getDb();
  const rows = db.getAllSync<RawRow>(`SELECT * FROM matches ORDER BY created_at DESC`);
  return rows.map(toRow);
}

export function finishMatch(id: string, finishedAt: number = Date.now()): void {
  const db = getDb();
  // Flip sync_status back to 'pending' so the status change replicates.
  db.runSync(
    `UPDATE matches SET status = 'finished', finished_at = ?, sync_status = 'pending' WHERE id = ?`,
    [finishedAt, id],
  );
}

export function deleteMatch(id: string): void {
  const db = getDb();
  db.runSync(`DELETE FROM events WHERE match_id = ?`, [id]);
  db.runSync(`DELETE FROM matches WHERE id = ?`, [id]);
}

export function markSynced(id: string): void {
  const db = getDb();
  db.runSync(`UPDATE matches SET sync_status = 'synced' WHERE id = ?`, [id]);
}

export function listPendingMatches(): MatchRow[] {
  const db = getDb();
  const rows = db.getAllSync<RawRow>(
    `SELECT * FROM matches WHERE sync_status = 'pending' ORDER BY created_at ASC`,
  );
  return rows.map(toRow);
}

export interface RemoteMatch {
  id: string;
  user_id: string | null;
  created_at: string;
  finished_at: string | null;
  status: MatchStatus;
  team_a_name: string;
  team_b_name: string;
  p_tl: string;
  p_tr: string;
  p_bl: string;
  p_br: string;
  best_of: number;
  scoring: ScoringVariant;
  first_server: Team;
}

export function upsertFromRemote(row: RemoteMatch): void {
  const db = getDb();
  const createdAt = Date.parse(row.created_at);
  const finishedAt = row.finished_at ? Date.parse(row.finished_at) : null;
  db.runSync(
    `INSERT INTO matches (id, user_id, created_at, finished_at, status, team_a_name, team_b_name,
                          p_tl, p_tr, p_bl, p_br, best_of, scoring, first_server, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
     ON CONFLICT(id) DO UPDATE SET
       user_id = excluded.user_id,
       created_at = excluded.created_at,
       finished_at = excluded.finished_at,
       status = excluded.status,
       team_a_name = excluded.team_a_name,
       team_b_name = excluded.team_b_name,
       p_tl = excluded.p_tl, p_tr = excluded.p_tr,
       p_bl = excluded.p_bl, p_br = excluded.p_br,
       best_of = excluded.best_of,
       scoring = excluded.scoring,
       first_server = excluded.first_server,
       sync_status = 'synced'
     WHERE matches.sync_status = 'synced'`,
    [
      row.id,
      row.user_id,
      createdAt,
      finishedAt,
      row.status,
      row.team_a_name,
      row.team_b_name,
      row.p_tl,
      row.p_tr,
      row.p_bl,
      row.p_br,
      row.best_of,
      row.scoring,
      row.first_server,
    ],
  );
}
