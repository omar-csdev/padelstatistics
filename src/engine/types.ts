export type Position = 'tl' | 'tr' | 'bl' | 'br';
export type Team = 'top' | 'bot';
export type ScoringVariant = 'advantage' | 'golden';
export type Result = 'won' | 'lost';
export type Shot = 'lob' | 'vibora' | 'smash' | 'bandeja' | 'volley' | 'other';
export type ErrorKind = 'forced' | 'unforced';

export type Positions = Record<Position, string>;

export interface MatchConfig {
  positions: Positions;
  teamNames: [string, string];
  bestOf: 3 | 5;
  scoring: ScoringVariant;
  firstServer: Team;
}

export interface PointEvent {
  seq: number;
  ts: number;
  byPos: Position;
  byPlayer: string;
  result: Result;
  shot?: Shot;
  error?: ErrorKind;
  winner: Team; // derived: result + byPos -> winning team, persisted for query speed
}

export interface SetScore {
  top: number;
  bot: number;
}

export interface MatchState {
  config: MatchConfig;
  sets: SetScore[];
  games: { top: number; bot: number };
  points: { top: number; bot: number };
  serving: Team;
  history: PointEvent[];
  startTime: number;
  finished: boolean;
  winner: Team | null;
}

export interface Flag {
  label: string;
  kind: 'warn' | 'set' | 'hot';
}

export interface Flags {
  top: Flag[];
  bot: Flag[];
}

export interface PlayerStats {
  name: string;
  pos: Position;
  winners: number;
  forced: number;
  unforced: number;
  shotCounts: Partial<Record<Shot, number>>;
  errorCounts: Partial<Record<ErrorKind, number>>;
}

export interface MatchStats {
  perPlayer: Record<Position, PlayerStats>;
  totals: {
    topW: number;
    botW: number;
    topUnforced: number;
    botUnforced: number;
    topForced: number;
    botForced: number;
    topPoints: number;
    botPoints: number;
  };
  dominantShot: Shot | null;
  weakestShot: Shot | null; // player+shot combo with most errors — kept simple as global "shot type with most errors"
}
