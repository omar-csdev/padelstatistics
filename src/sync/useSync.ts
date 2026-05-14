import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { supabase } from '@/src/api/supabase';
import { useAuth } from '@/src/auth/useAuth';
import { wipe } from '@/src/store/db';
import { upsertFromRemote as upsertEventFromRemote, type RemoteEvent } from '@/src/store/events';
import { upsertFromRemote as upsertMatchFromRemote, type RemoteMatch } from '@/src/store/matches';
import {
  listPendingEvents,
  listPendingMatches,
  markEventSynced,
  markMatchSynced,
  setUserIdOnLocalMatches,
} from './queue';

export interface UseSyncResult {
  pending: number;
  flushNow: () => Promise<void>;
  pullNow: () => Promise<void>;
}

export function useSync(): UseSyncResult {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [pending, setPending] = useState<number>(() =>
    listPendingMatches().length + listPendingEvents().length,
  );

  const inFlight = useRef(false);
  const prevUserId = useRef<string | null>(userId);

  const recomputePending = useCallback(() => {
    setPending(listPendingMatches().length + listPendingEvents().length);
  }, []);

  const flushNow = useCallback(async () => {
    if (!userId) return;
    setUserIdOnLocalMatches(userId);
    const matches = listPendingMatches();
    for (const m of matches) {
      const { error } = await supabase.from('matches').upsert(
        {
          id: m.id,
          user_id: userId,
          created_at: new Date(m.createdAt).toISOString(),
          finished_at: m.finishedAt ? new Date(m.finishedAt).toISOString() : null,
          status: m.status,
          team_a_name: m.config.teamNames[0],
          team_b_name: m.config.teamNames[1],
          p_tl: m.config.positions.tl,
          p_tr: m.config.positions.tr,
          p_bl: m.config.positions.bl,
          p_br: m.config.positions.br,
          best_of: m.config.bestOf,
          scoring: m.config.scoring,
          first_server: m.config.firstServer,
        },
        { onConflict: 'id' },
      );
      if (!error) markMatchSynced(m.id);
    }
    const events = listPendingEvents();
    for (const e of events) {
      const { error } = await supabase.from('events').upsert(
        {
          id: e.id,
          match_id: e.matchId,
          seq: e.seq,
          ts: new Date(e.ts).toISOString(),
          winner_team: e.winner,
          by_pos: e.byPos,
          by_player: e.byPlayer,
          result: e.result,
          shot: e.shot,
          error_kind: e.error,
        },
        { onConflict: 'id' },
      );
      if (!error) markEventSynced(e.id);
    }
    recomputePending();
  }, [userId, recomputePending]);

  const pullNow = useCallback(async () => {
    if (!userId) return;
    const { data: matchRows } = await supabase
      .from('matches')
      .select('*')
      .eq('user_id', userId);
    const remoteMatches: RemoteMatch[] = (matchRows as RemoteMatch[] | null) ?? [];
    for (const row of remoteMatches) {
      upsertMatchFromRemote(row);
    }
    const matchIds = remoteMatches.map((m) => m.id);
    if (matchIds.length > 0) {
      const { data: eventRows } = await supabase
        .from('events')
        .select('*')
        .in('match_id', matchIds);
      const remoteEvents: RemoteEvent[] = (eventRows as RemoteEvent[] | null) ?? [];
      for (const ev of remoteEvents) {
        upsertEventFromRemote(ev);
      }
    }
    recomputePending();
  }, [userId, recomputePending]);

  const fire = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await flushNow();
      await pullNow();
    } finally {
      inFlight.current = false;
    }
  }, [flushNow, pullNow]);

  useEffect(() => {
    // Detect a true sign-out (previously had a session, now don't) and wipe
    // the local cache so the next coach doesn't inherit yesterday's matches.
    // Skip on initial render when auth is still loading.
    if (prevUserId.current && userId === null) {
      wipe();
      recomputePending();
    }
    prevUserId.current = userId;
  }, [userId, recomputePending]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      void fire();
    };
    run();
    const appSub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') run();
    });
    const netUnsub = NetInfo.addEventListener((n) => {
      if (n.isConnected) run();
    });
    return () => {
      cancelled = true;
      appSub.remove();
      netUnsub();
    };
  }, [userId, fire]);

  return { pending, flushNow, pullNow };
}
