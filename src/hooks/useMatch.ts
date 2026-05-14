import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyEvent, deriveWinner, fold } from '@/src/engine/scoring';
import type { ErrorKind, MatchState, PointEvent, Position, Result, Shot, Team } from '@/src/engine/types';
import { appendEvent, getEvents, popLastEvent } from '@/src/store/events';
import { finishMatch, getMatch } from '@/src/store/matches';

interface PointInput {
  byPos: Position;
  result: Result;
  shot?: Shot;
  error?: ErrorKind;
}

interface UseMatchResult {
  state: MatchState | null;
  loading: boolean;
  logPoint: (input: PointInput) => MatchState | null;
  undoLast: () => void;
  switchSides: () => void;
  finish: () => void;
}

export function useMatch(matchId: string): UseMatchResult {
  const [state, setState] = useState<MatchState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const row = getMatch(matchId);
    if (!row) {
      setState(null);
      setLoading(false);
      return;
    }
    const events = getEvents(matchId);
    const folded = fold(row.config, events, row.createdAt);
    setState(folded);
    setLoading(false);
  }, [matchId]);

  const logPoint = useCallback(
    (input: PointInput): MatchState | null => {
      if (!state || state.finished) return state;
      const winner: Team = deriveWinner(input.byPos, input.result);
      const ev: PointEvent = {
        seq: state.history.length + 1,
        ts: Date.now(),
        winner,
        byPos: input.byPos,
        byPlayer: state.config.positions[input.byPos] ?? '',
        result: input.result,
        shot: input.shot,
        error: input.error,
      };
      appendEvent(matchId, ev);
      const next = applyEvent(state, ev);
      if (next.finished) {
        finishMatch(matchId);
      }
      setState(next);
      return next;
    },
    [matchId, state],
  );

  const undoLast = useCallback(() => {
    if (!state || state.history.length === 0) return;
    popLastEvent(matchId);
    const remaining = state.history.slice(0, -1);
    const refolded = fold(state.config, remaining, state.startTime);
    setState(refolded);
  }, [matchId, state]);

  const switchSides = useCallback(() => {
    if (!state) return;
    const p = state.config.positions;
    setState({
      ...state,
      config: {
        ...state.config,
        positions: { tl: p.bl, tr: p.br, bl: p.tl, br: p.tr },
      },
    });
  }, [state]);

  const finish = useCallback(() => {
    if (!state) return;
    finishMatch(matchId);
    setState({ ...state, finished: true });
  }, [matchId, state]);

  return useMemo(
    () => ({ state, loading, logPoint, undoLast, switchSides, finish }),
    [state, loading, logPoint, undoLast, switchSides, finish],
  );
}
