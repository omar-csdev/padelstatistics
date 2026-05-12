import type { ErrorKind, MatchStats, PlayerStats, PointEvent, Position, Positions, Shot } from './types';

const POSITIONS: Position[] = ['tl', 'tr', 'bl', 'br'];

function emptyPlayer(name: string, pos: Position): PlayerStats {
  return { name, pos, winners: 0, forced: 0, unforced: 0, shotCounts: {}, errorCounts: {} };
}

export function aggregate(events: PointEvent[], positions: Positions): MatchStats {
  const perPlayer = {} as Record<Position, PlayerStats>;
  for (const pos of POSITIONS) {
    perPlayer[pos] = emptyPlayer(positions[pos] ?? '', pos);
  }

  const totals = {
    topW: 0,
    botW: 0,
    topUnforced: 0,
    botUnforced: 0,
    topForced: 0,
    botForced: 0,
    topPoints: 0,
    botPoints: 0,
  };
  const byShot: Partial<Record<Shot, number>> = {};
  const byError: Partial<Record<ErrorKind, number>> = {};

  for (const ev of events) {
    const p = perPlayer[ev.byPos];
    if (!p) continue;
    const isTop = ev.byPos === 'tl' || ev.byPos === 'tr';

    if (ev.winner === 'top') totals.topPoints += 1;
    else totals.botPoints += 1;

    if (ev.result === 'won') {
      p.winners += 1;
      if (ev.shot) {
        p.shotCounts[ev.shot] = (p.shotCounts[ev.shot] ?? 0) + 1;
        byShot[ev.shot] = (byShot[ev.shot] ?? 0) + 1;
      }
      if (isTop) totals.topW += 1;
      else totals.botW += 1;
    } else {
      const kind: ErrorKind = ev.error ?? 'unforced';
      if (kind === 'forced') p.forced += 1;
      else p.unforced += 1;
      p.errorCounts[kind] = (p.errorCounts[kind] ?? 0) + 1;
      byError[kind] = (byError[kind] ?? 0) + 1;
      if (isTop) {
        if (kind === 'forced') totals.topForced += 1;
        else totals.topUnforced += 1;
      } else {
        if (kind === 'forced') totals.botForced += 1;
        else totals.botUnforced += 1;
      }
    }
  }

  const dominantShot = pickMax(byShot);
  // "Weakest shot" = shot type the player hits most into errors.
  // Simple heuristic: shot with lowest winner count among shots that were attempted.
  // For MVP we leave null unless we can compute meaningful — set to least-used winner shot.
  const weakestShot = pickMin(byShot);

  return { perPlayer, totals, dominantShot, weakestShot };
}

function pickMax<K extends string>(m: Partial<Record<K, number>>): K | null {
  let best: K | null = null;
  let bestN = -1;
  for (const [k, v] of Object.entries(m) as [K, number][]) {
    if (v > bestN) {
      bestN = v;
      best = k;
    }
  }
  return best;
}

function pickMin<K extends string>(m: Partial<Record<K, number>>): K | null {
  let worst: K | null = null;
  let worstN = Infinity;
  for (const [k, v] of Object.entries(m) as [K, number][]) {
    if (v < worstN) {
      worstN = v;
      worst = k;
    }
  }
  return worst;
}
