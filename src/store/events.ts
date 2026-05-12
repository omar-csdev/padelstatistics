import type { PointEvent } from '@/src/engine/types';
import { getDb } from './db';

interface RawEvent {
  seq: number;
  ts: number;
  winner_team: 'top' | 'bot';
  by_pos: 'tl' | 'tr' | 'bl' | 'br';
  by_player: string;
  result: 'won' | 'lost';
  shot: string | null;
  error_kind: string | null;
}

export function getEvents(matchId: number): PointEvent[] {
  const db = getDb();
  const rows = db.getAllSync<RawEvent>(
    `SELECT seq, ts, winner_team, by_pos, by_player, result, shot, error_kind
     FROM events WHERE match_id = ? ORDER BY seq ASC`,
    [matchId],
  );
  return rows.map((r) => ({
    seq: r.seq,
    ts: r.ts,
    winner: r.winner_team,
    byPos: r.by_pos,
    byPlayer: r.by_player,
    result: r.result,
    shot: (r.shot as PointEvent['shot']) ?? undefined,
    error: (r.error_kind as PointEvent['error']) ?? undefined,
  }));
}

export function appendEvent(matchId: number, ev: PointEvent): void {
  const db = getDb();
  db.runSync(
    `INSERT INTO events (match_id, seq, ts, winner_team, by_pos, by_player, result, shot, error_kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      matchId,
      ev.seq,
      ev.ts,
      ev.winner,
      ev.byPos,
      ev.byPlayer,
      ev.result,
      ev.shot ?? null,
      ev.error ?? null,
    ],
  );
}

export function popLastEvent(matchId: number): void {
  const db = getDb();
  db.runSync(
    `DELETE FROM events WHERE id = (
       SELECT id FROM events WHERE match_id = ? ORDER BY seq DESC LIMIT 1
     )`,
    [matchId],
  );
}

export function clearEvents(matchId: number): void {
  const db = getDb();
  db.runSync(`DELETE FROM events WHERE match_id = ?`, [matchId]);
}
