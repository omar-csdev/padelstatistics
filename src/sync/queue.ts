// Outbox queue — pure SQLite helpers. No React, no Supabase. The useSync hook
// pulls from these queries, ships rows to Supabase, and flips sync_status.
import { getDb } from '@/src/store/db';

export {
  listPendingMatches,
  markSynced as markMatchSynced,
} from '@/src/store/matches';
export type { MatchRow as PendingMatch } from '@/src/store/matches';

export {
  listPendingEvents,
  markEventSynced,
} from '@/src/store/events';
export type { PendingEvent } from '@/src/store/events';

// After sign-in we stamp the new user_id onto any local matches created
// while signed out (no other coach is going to claim them — single-device,
// just-signed-in case).
export function setUserIdOnLocalMatches(userId: string): void {
  const db = getDb();
  db.runSync(
    `UPDATE matches SET user_id = ?, sync_status = 'pending' WHERE user_id IS NULL`,
    [userId],
  );
}
