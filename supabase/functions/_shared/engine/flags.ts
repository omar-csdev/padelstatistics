// VENDORED from src/engine/* — do not edit here.
// Keep byte-identical to the canonical version in the RN app.
import type { Flag, Flags, MatchState, Team } from './types.ts';

function other(t: Team): Team {
  return t === 'top' ? 'bot' : 'top';
}

/**
 * Detect contextual flags: BREAK PT, SET PT, MATCH PT for each team given the
 * current state. Both scoring variants supported.
 */
export function matchFlags(state: MatchState): Flags {
  const flags: Flags = { top: [], bot: [] };
  const sides: Team[] = ['top', 'bot'];
  const variant = state.config.scoring;
  const bestOf = state.config.bestOf;
  const target = Math.ceil(bestOf / 2);

  for (const side of sides) {
    const opp = other(side);
    const p = state.points[side];
    const op = state.points[opp];

    // "One point away from winning this game" predicate, variant-aware.
    let oneAway: boolean;
    if (variant === 'golden') {
      // 3-? with op<3 OR 3-3 sudden death.
      oneAway = (p === 3 && op < 3) || (p === 3 && op === 3);
    } else {
      oneAway = (p === 3 && op < 3) || (p === 4 && op === 3);
    }

    // Break point: receiver one point from winning game on opponent's serve.
    if (state.serving === opp && oneAway) {
      flags[side].push({ label: 'BREAK PT', kind: 'warn' });
    }

    if (oneAway) {
      const myG = state.games[side] + 1;
      const oG = state.games[opp];
      const wouldWinSet = (myG >= 6 && myG - oG >= 2) || myG === 7;
      if (wouldWinSet) {
        const setsWonAfter = state.sets.filter((s) => s[side] > s[opp]).length + 1;
        if (setsWonAfter >= target) {
          flags[side].push({ label: 'MATCH PT', kind: 'hot' });
        } else {
          flags[side].push({ label: 'SET PT', kind: 'set' });
        }
      }
    }
  }

  return flags;
}

export type { Flag, Flags };
