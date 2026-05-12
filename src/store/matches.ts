import type { MatchConfig } from '@/src/engine/types';
import { getDb } from './db';

export type MatchStatus = 'in_progress' | 'finished';

export interface MatchRow {
  id: number;
  createdAt: number;
  finishedAt: number | null;
  status: MatchStatus;
  config: MatchConfig;
  tag: string | null;
}

interface RawRow {
  id: number;
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
  scoring: 'advantage' | 'golden';
  first_server: 'top' | 'bot';
  tag: string | null;
}

function toRow(r: RawRow): MatchRow {
  return {
    id: r.id,
    createdAt: r.created_at,
    finishedAt: r.finished_at,
    status: r.status,
    tag: r.tag,
    config: {
      teamNames: [r.team_a_name, r.team_b_name],
      positions: { tl: r.p_tl, tr: r.p_tr, bl: r.p_bl, br: r.p_br },
      bestOf: r.best_of as 3 | 5,
      scoring: r.scoring,
      firstServer: r.first_server,
    },
  };
}

export function createMatch(config: MatchConfig, tag: string | null = null): number {
  const db = getDb();
  const now = Date.now();
  const res = db.runSync(
    `INSERT INTO matches (created_at, status, team_a_name, team_b_name, p_tl, p_tr, p_bl, p_br, best_of, scoring, first_server, tag)
     VALUES (?, 'in_progress', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
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
      tag,
    ],
  );
  return res.lastInsertRowId as number;
}

export function getMatch(id: number): MatchRow | null {
  const db = getDb();
  const row = db.getFirstSync<RawRow>(`SELECT * FROM matches WHERE id = ?`, [id]);
  return row ? toRow(row) : null;
}

export function listMatches(): MatchRow[] {
  const db = getDb();
  const rows = db.getAllSync<RawRow>(`SELECT * FROM matches ORDER BY created_at DESC`);
  return rows.map(toRow);
}

export function finishMatch(id: number, finishedAt: number = Date.now()): void {
  const db = getDb();
  db.runSync(`UPDATE matches SET status = 'finished', finished_at = ? WHERE id = ?`, [finishedAt, id]);
}

export function deleteMatch(id: number): void {
  const db = getDb();
  db.runSync(`DELETE FROM events WHERE match_id = ?`, [id]);
  db.runSync(`DELETE FROM matches WHERE id = ?`, [id]);
}
