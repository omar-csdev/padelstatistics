import * as Crypto from 'expo-crypto';
import type { ErrorKind, PointEvent, Position, Result, Shot, Team } from '@/src/engine/types';
import { getDb } from './db';

type SyncStatus = 'pending' | 'synced';

interface RawEvent {
  id: string;
  match_id: string;
  seq: number;
  ts: number;
  winner_team: Team;
  by_pos: Position;
  by_player: string;
  result: Result;
  shot: string | null;
  error_kind: string | null;
  sync_status: SyncStatus;
}

function toPoint(r: RawEvent): PointEvent {
  return {
    seq: r.seq,
    ts: r.ts,
    winner: r.winner_team,
    byPos: r.by_pos,
    byPlayer: r.by_player,
    result: r.result,
    shot: (r.shot as Shot) ?? undefined,
    error: (r.error_kind as ErrorKind) ?? undefined,
  };
}

export function getEvents(matchId: string): PointEvent[] {
  const db = getDb();
  const rows = db.getAllSync<RawEvent>(
    `SELECT id, match_id, seq, ts, winner_team, by_pos, by_player, result, shot, error_kind, sync_status
     FROM events WHERE match_id = ? ORDER BY seq ASC`,
    [matchId],
  );
  return rows.map(toPoint);
}

export function appendEvent(matchId: string, ev: PointEvent): string {
  const db = getDb();
  const id = Crypto.randomUUID();
  db.runSync(
    `INSERT INTO events (id, match_id, seq, ts, winner_team, by_pos, by_player, result, shot, error_kind, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      id,
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
  return id;
}

export function popLastEvent(matchId: string): void {
  const db = getDb();
  // popLastEvent deletes the row outright — including from the outbox — so an
  // event that hasn't synced yet never gets pushed. If it did sync, the
  // server-side row stays orphan-deleted until a future hard-delete API
  // (out of scope for Phase 2).
  db.runSync(
    `DELETE FROM events WHERE id = (
       SELECT id FROM events WHERE match_id = ? ORDER BY seq DESC LIMIT 1
     )`,
    [matchId],
  );
}

export function clearEvents(matchId: string): void {
  const db = getDb();
  db.runSync(`DELETE FROM events WHERE match_id = ?`, [matchId]);
}

export interface PendingEvent {
  id: string;
  matchId: string;
  seq: number;
  ts: number;
  winner: Team;
  byPos: Position;
  byPlayer: string;
  result: Result;
  shot: Shot | null;
  error: ErrorKind | null;
}

export function listPendingEvents(): PendingEvent[] {
  const db = getDb();
  const rows = db.getAllSync<RawEvent>(
    `SELECT id, match_id, seq, ts, winner_team, by_pos, by_player, result, shot, error_kind, sync_status
     FROM events WHERE sync_status = 'pending' ORDER BY match_id, seq`,
  );
  return rows.map((r) => ({
    id: r.id,
    matchId: r.match_id,
    seq: r.seq,
    ts: r.ts,
    winner: r.winner_team,
    byPos: r.by_pos,
    byPlayer: r.by_player,
    result: r.result,
    shot: (r.shot as Shot) ?? null,
    error: (r.error_kind as ErrorKind) ?? null,
  }));
}

export function markEventSynced(id: string): void {
  const db = getDb();
  db.runSync(`UPDATE events SET sync_status = 'synced' WHERE id = ?`, [id]);
}

export interface RemoteEvent {
  id: string;
  match_id: string;
  seq: number;
  ts: string;
  winner_team: Team;
  by_pos: Position;
  by_player: string;
  result: Result;
  shot: string | null;
  error_kind: string | null;
}

export function upsertFromRemote(ev: RemoteEvent): void {
  const db = getDb();
  const ts = Date.parse(ev.ts);
  db.runSync(
    `INSERT INTO events (id, match_id, seq, ts, winner_team, by_pos, by_player, result, shot, error_kind, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
     ON CONFLICT(id) DO UPDATE SET
       match_id = excluded.match_id,
       seq = excluded.seq,
       ts = excluded.ts,
       winner_team = excluded.winner_team,
       by_pos = excluded.by_pos,
       by_player = excluded.by_player,
       result = excluded.result,
       shot = excluded.shot,
       error_kind = excluded.error_kind,
       sync_status = 'synced'
     WHERE events.sync_status = 'synced'`,
    [
      ev.id,
      ev.match_id,
      ev.seq,
      ts,
      ev.winner_team,
      ev.by_pos,
      ev.by_player,
      ev.result,
      ev.shot,
      ev.error_kind,
    ],
  );
}
