import type { MatchConfig, MatchState, PointEvent, Team } from './types';

const POINT_LABELS = ['0', '15', '30', '40'] as const;

export function emptyState(config: MatchConfig, startTime: number = Date.now()): MatchState {
  return {
    config,
    sets: [],
    games: { top: 0, bot: 0 },
    points: { top: 0, bot: 0 },
    serving: config.firstServer,
    history: [],
    startTime,
    finished: false,
    winner: null,
  };
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function other(t: Team): Team {
  return t === 'top' ? 'bot' : 'top';
}

function setsTarget(bestOf: number): number {
  return Math.ceil(bestOf / 2);
}

export function isMatchOver(state: MatchState): boolean {
  const target = setsTarget(state.config.bestOf);
  const setsTop = state.sets.filter((s) => s.top > s.bot).length;
  const setsBot = state.sets.filter((s) => s.bot > s.top).length;
  return setsTop >= target || setsBot >= target;
}

export function matchWinner(state: MatchState): Team | null {
  const setsTop = state.sets.filter((s) => s.top > s.bot).length;
  const setsBot = state.sets.filter((s) => s.bot > s.top).length;
  const target = setsTarget(state.config.bestOf);
  if (setsTop >= target) return 'top';
  if (setsBot >= target) return 'bot';
  return null;
}

function gameWon(s: MatchState, w: Team): void {
  s.games[w] += 1;
  s.points = { top: 0, bot: 0 };
  // Toggle serve at start of next game.
  s.serving = other(s.serving);

  const gw = s.games[w];
  const gl = s.games[other(w)];
  // Set won: win by 2 from 6+, or hit 7 (covers 7-5 and 7-6 abstracted tiebreak).
  if ((gw >= 6 && gw - gl >= 2) || gw === 7) {
    s.sets.push({ top: s.games.top, bot: s.games.bot });
    s.games = { top: 0, bot: 0 };
  }
}

/**
 * Apply one point won by `winner` and return the next state.
 * Pure: never mutates input.
 */
export function nextScore(state: MatchState, winner: Team): MatchState {
  if (state.finished) return state;
  const s = clone(state);
  const w = winner;
  const l = other(w);
  const t = s.points;
  const variant = s.config.scoring;

  if (variant === 'golden') {
    // Sudden death at 40-40: next point wins the game.
    if (t[w] >= 3 && t[l] >= 3) {
      gameWon(s, w);
    } else if (t[w] === 3) {
      gameWon(s, w);
    } else {
      t[w] += 1;
    }
  } else {
    // Advantage scoring with deuce/AD.
    if (t[w] >= 3 && t[l] >= 3) {
      if (t[w] === t[l]) {
        // Deuce → advantage to winner.
        t[w] = 4;
      } else if (t[w] > t[l]) {
        // Winner had advantage → wins game.
        gameWon(s, w);
      } else {
        // Loser had advantage → back to deuce.
        t[l] = 3;
      }
    } else if (t[w] === 3) {
      gameWon(s, w);
    } else {
      t[w] += 1;
    }
  }

  // Settle finished flag.
  if (isMatchOver(s)) {
    s.finished = true;
    s.winner = matchWinner(s);
  }

  return s;
}

/**
 * Append an event and advance the score.
 */
export function applyEvent(state: MatchState, ev: PointEvent): MatchState {
  const next = nextScore(state, ev.winner);
  next.history = [...state.history, ev];
  return next;
}

/**
 * Fold a list of events into a state by replaying them through the engine.
 * Used for loading a match from storage and for undo (drop last + refold).
 */
export function fold(config: MatchConfig, events: PointEvent[], startTime: number): MatchState {
  let s = emptyState(config, startTime);
  for (const ev of events) {
    s = applyEvent(s, ev);
  }
  return s;
}

export function pointLabel(p: number, otherP: number, variant: 'advantage' | 'golden'): string {
  if (variant === 'golden') {
    if (p >= 3 && otherP >= 3) {
      // 40-40 sudden death; receiver chooses side. UI just shows GP.
      return 'GP';
    }
    return POINT_LABELS[Math.min(p, 3)];
  }
  if (p >= 3 && otherP >= 3) {
    if (p === otherP) return 'DEUCE';
    if (p > otherP) return 'AD';
    return '—';
  }
  return POINT_LABELS[Math.min(p, 3)];
}

/**
 * Determine which team would win the team-A vs team-B point given which player
 * touched the ball last. Coach taps a player → wheel picks won/lost shot/error.
 * - Winner: that player's team wins.
 * - Error: the opposing team wins.
 */
export function deriveWinner(byPos: 'tl' | 'tr' | 'bl' | 'br', result: 'won' | 'lost'): Team {
  const isTopPlayer = byPos === 'tl' || byPos === 'tr';
  if (result === 'won') return isTopPlayer ? 'top' : 'bot';
  return isTopPlayer ? 'bot' : 'top';
}
