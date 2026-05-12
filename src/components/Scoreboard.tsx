import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Chip } from './Chip';
import { matchFlags } from '@/src/engine/flags';
import { pointLabel } from '@/src/engine/scoring';
import type { Flag, MatchState } from '@/src/engine/types';
import { colors, fonts } from '@/src/theme/tokens';

interface Props {
  state: MatchState;
  clock?: string;
}

export function Scoreboard({ state, clock = '' }: Props) {
  const flags = matchFlags(state);
  const teamNames = state.config.teamNames;
  const setColumns = Array.from(
    { length: Math.min(state.sets.length + 1, state.config.bestOf) },
    (_, i) => i,
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Chip label="LIVE" kind="live" />
          <Chip label={`SET ${state.sets.length + 1}`} />
        </View>
        <Text style={styles.headerMeta}>
          {clock ? `${clock} · ` : ''}BO{state.config.bestOf}
        </Text>
      </View>

      <View style={styles.columnLabels}>
        <Text style={styles.colLabel}>TEAM</Text>
        <View style={styles.setHeader}>
          {setColumns.map((i) => (
            <Text key={i} style={styles.setHeaderLabel}>
              S{i + 1}
            </Text>
          ))}
          <Text style={[styles.setHeaderLabel, styles.gmLabel]}>GM</Text>
        </View>
        <Text style={[styles.colLabel, styles.ptsLabel]}>PTS</Text>
      </View>

      <TeamRow
        name={teamNames[0]}
        serving={state.serving === 'top'}
        flags={flags.top}
        sets={setColumns.map((i) =>
          i < state.sets.length ? String(state.sets[i].top) : String(state.games.top),
        )}
        opps={setColumns.map((i) =>
          i < state.sets.length ? state.sets[i].bot : state.games.bot,
        )}
        ownVals={setColumns.map((i) =>
          i < state.sets.length ? state.sets[i].top : state.games.top,
        )}
        games={state.games.top}
        points={pointLabel(state.points.top, state.points.bot, state.config.scoring)}
        isWinning={state.points.top > state.points.bot}
      />

      <TeamRow
        name={teamNames[1]}
        serving={state.serving === 'bot'}
        flags={flags.bot}
        sets={setColumns.map((i) =>
          i < state.sets.length ? String(state.sets[i].bot) : String(state.games.bot),
        )}
        opps={setColumns.map((i) =>
          i < state.sets.length ? state.sets[i].top : state.games.top,
        )}
        ownVals={setColumns.map((i) =>
          i < state.sets.length ? state.sets[i].bot : state.games.bot,
        )}
        games={state.games.bot}
        points={pointLabel(state.points.bot, state.points.top, state.config.scoring)}
        isWinning={state.points.bot > state.points.top}
      />
    </View>
  );
}

interface TeamRowProps {
  name: string;
  serving: boolean;
  flags: Flag[];
  sets: string[];
  opps: number[];
  ownVals: number[];
  games: number;
  points: string;
  isWinning: boolean;
}

function TeamRow({ name, serving, flags, sets, ownVals, opps, points, isWinning }: TeamRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.nameCol}>
        <View
          style={[
            styles.servingDot,
            serving ? styles.servingDotOn : styles.servingDotOff,
          ]}
        />
        <Text style={styles.teamName} numberOfLines={1}>
          {name}
        </Text>
        {flags.map((f, i) => (
          <Chip key={i} label={f.label} kind={f.kind} small />
        ))}
      </View>
      <View style={styles.setCells}>
        {sets.map((v, i) => {
          const isCompleted = i < sets.length - 1;
          const wonSet = isCompleted && ownVals[i] > opps[i];
          return (
            <Text
              key={i}
              style={[
                styles.setDigit,
                { color: wonSet ? colors.accent : colors.ink2 },
              ]}
            >
              {v}
            </Text>
          );
        })}
      </View>
      <Text style={[styles.points, isWinning ? styles.pointsWinning : null]}>{points}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: { flexDirection: 'row', gap: 6 },
  headerMeta: {
    fontFamily: fonts.mono,
    color: colors.ink3,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  columnLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  colLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.ink3,
    flex: 1,
  },
  setHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  setHeaderLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.ink3,
    width: 22,
    textAlign: 'center',
  },
  gmLabel: { color: colors.accent },
  ptsLabel: { color: colors.accent, width: 56, textAlign: 'center', flex: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  nameCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  servingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  servingDotOn: {
    backgroundColor: colors.won,
  },
  servingDotOff: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  teamName: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  setCells: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  setDigit: {
    fontFamily: fonts.black,
    fontVariant: ['tabular-nums'],
    fontSize: 18,
    width: 22,
    textAlign: 'center',
  },
  points: {
    width: 56,
    textAlign: 'center',
    fontFamily: fonts.black,
    fontVariant: ['tabular-nums'],
    fontSize: 24,
    color: colors.ink,
  },
  pointsWinning: {
    color: colors.accent,
  },
});
