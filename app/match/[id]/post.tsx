import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MomentumChart } from '@/src/components/MomentumChart';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import { aggregate } from '@/src/engine/aggregation';
import { fold, isMatchOver, matchWinner } from '@/src/engine/scoring';
import type { MatchState, PlayerStats, Position } from '@/src/engine/types';
import { getEvents } from '@/src/store/events';
import { finishMatch, getMatch } from '@/src/store/matches';
import { colors, fonts } from '@/src/theme/tokens';

const POSITION_LABELS: Record<Position, string> = {
  tl: 'TOP · LEFT',
  tr: 'TOP · RIGHT',
  bl: 'BOTTOM · LEFT',
  br: 'BOTTOM · RIGHT',
};

function formatDuration(start: number, end: number): string {
  const ms = Math.max(0, end - start);
  const min = Math.floor(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `00:${String(m).padStart(2, '0')}`;
}

export default function PostMatchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const matchId = useMemo(() => String(params.id ?? ''), [params.id]);
  const [state, setState] = useState<MatchState | null>(null);
  const [duration, setDuration] = useState('00:00');

  useFocusEffect(
    useCallback(() => {
      const row = getMatch(matchId);
      if (!row) return;
      const events = getEvents(matchId);
      const folded = fold(row.config, events, row.createdAt);
      if (isMatchOver(folded) && row.status !== 'finished') {
        finishMatch(matchId);
      }
      setState(folded);
      setDuration(formatDuration(row.createdAt, row.finishedAt ?? Date.now()));
    }, [matchId]),
  );

  const stats = useMemo(() => (state ? aggregate(state.history, state.config.positions) : null), [state]);

  if (!state || !stats) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.placeholder}>Loading…</Text>
      </View>
    );
  }

  const winner = matchWinner(state);
  const winnerName = winner ? state.config.teamNames[winner === 'top' ? 0 : 1] : '—';
  const matchOver = isMatchOver(state);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title={matchOver ? 'Match Complete' : 'Match Summary'}
        subtitle={`${duration} total`}
        onBack={() => router.replace('/' as never)}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.winnerCard}>
          <View style={styles.winnerHeader}>
            <Ionicons name="trophy" size={16} color={colors.accent} />
            <Text style={[styles.label, { color: colors.accent }]}>{matchOver ? 'WINNER' : 'IN PROGRESS'}</Text>
          </View>
          <Text style={styles.winnerName}>{winnerName}</Text>
          <FinalScore state={state} />
        </View>

        <SectionTitle index="01" title="Match Timeline" />
        <MomentumChart history={state.history} height={90} />

        <View style={{ height: 14 }} />
        <SectionTitle index="02" title="Players" />
        <View style={styles.playersGrid}>
          {(['tl', 'tr', 'bl', 'br'] as Position[]).map((pos) => (
            <PlayerStatCard
              key={pos}
              stats={stats.perPlayer[pos]}
              onPress={() => router.push(`/match/${matchId}/breakdown/${pos}` as never)}
            />
          ))}
        </View>

        <SectionTitle index="03" title="Match Summary" />
        <SummaryGrid state={state} />

        <Pressable disabled style={styles.aiBtn}>
          <View style={styles.aiBtnRow}>
            <Ionicons name="flash" size={14} color={colors.accent} />
            <Text style={styles.aiBtnLabel}>GENERATE AI REPORT</Text>
          </View>
          <Text style={styles.aiBtnSub}>COMING SOON · TACTICAL BREAKDOWN</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function FinalScore({ state }: { state: MatchState }) {
  const sets = state.sets.length > 0
    ? state.sets
    : [{ top: state.games.top, bot: state.games.bot }];
  return (
    <View style={styles.finalScoreRows}>
      <View style={styles.finalScoreRow}>
        <Text style={styles.finalTeamLabel}>{state.config.teamNames[0]}</Text>
        <View style={styles.finalScoreSets}>
          {sets.map((s, i) => (
            <Text
              key={i}
              style={[
                styles.finalScoreNum,
                { color: s.top > s.bot ? colors.ink : colors.ink3 },
              ]}
            >
              {s.top}
            </Text>
          ))}
        </View>
      </View>
      <View style={styles.finalScoreRow}>
        <Text style={styles.finalTeamLabel}>{state.config.teamNames[1]}</Text>
        <View style={styles.finalScoreSets}>
          {sets.map((s, i) => (
            <Text
              key={i}
              style={[
                styles.finalScoreNum,
                { color: s.bot > s.top ? colors.ink : colors.ink3 },
              ]}
            >
              {s.bot}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

function PlayerStatCard({ stats, onPress }: { stats: PlayerStats; onPress: () => void }) {
  const isTop = stats.pos === 'tl' || stats.pos === 'tr';
  const accent = isTop ? colors.accent : colors.hot;
  const totalErrors = stats.forced + stats.unforced;
  const topShot = Object.entries(stats.shotCounts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];

  return (
    <Pressable onPress={onPress} style={styles.psCard}>
      <View style={styles.psHeader}>
        <View style={[styles.psAvatar, { backgroundColor: accent }]}>
          <Text style={styles.psInitial}>{(stats.name || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.psName} numberOfLines={1}>{stats.name || '—'}</Text>
          <Text style={styles.psPos}>{POSITION_LABELS[stats.pos]}</Text>
        </View>
      </View>
      <View style={styles.psStatsRow}>
        <View>
          <Text style={[styles.psStatNum, { color: colors.won }]}>{stats.winners}</Text>
          <Text style={styles.label}>WIN</Text>
        </View>
        <View>
          <Text style={[styles.psStatNum, { color: colors.error }]}>{totalErrors}</Text>
          <Text style={styles.label}>ERR</Text>
        </View>
      </View>
      {topShot ? (
        <View style={styles.psTopShot}>
          <Text style={styles.label}>TOP SHOT</Text>
          <Text style={[styles.psTopShotName, { color: accent }]}>{topShot[0].toUpperCase()}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function SummaryGrid({ state }: { state: MatchState }) {
  const rows = useMemo(() => {
    const tWin = state.history.filter((h) => h.result === 'won' && (h.byPos === 'tl' || h.byPos === 'tr')).length;
    const bWin = state.history.filter((h) => h.result === 'won' && (h.byPos === 'bl' || h.byPos === 'br')).length;
    const tUnf = state.history.filter((h) => h.error === 'unforced' && (h.byPos === 'tl' || h.byPos === 'tr')).length;
    const bUnf = state.history.filter((h) => h.error === 'unforced' && (h.byPos === 'bl' || h.byPos === 'br')).length;
    const tForced = state.history.filter((h) => h.error === 'forced' && (h.byPos === 'tl' || h.byPos === 'tr')).length;
    const bForced = state.history.filter((h) => h.error === 'forced' && (h.byPos === 'bl' || h.byPos === 'br')).length;
    const tPts = state.history.filter((h) => h.winner === 'top').length;
    const bPts = state.history.filter((h) => h.winner === 'bot').length;
    return [
      { label: 'WINNERS', a: tWin, b: bWin },
      { label: 'UNFORCED ERR', a: tUnf, b: bUnf },
      { label: 'FORCED ERR', a: tForced, b: bForced },
      { label: 'TOTAL POINTS', a: tPts, b: bPts },
    ];
  }, [state.history]);

  return (
    <View style={styles.summaryCard}>
      {rows.map((r, i) => {
        const total = (r.a + r.b) || 1;
        const aPct = (r.a / total) * 100;
        const bPct = 100 - aPct;
        return (
          <View key={r.label} style={[styles.summaryRow, i < rows.length - 1 && styles.summaryRowBorder]}>
            <View style={styles.summaryHeader}>
              <Text style={[styles.summaryNum, { color: colors.accent }]}>{r.a}</Text>
              <Text style={styles.label}>{r.label}</Text>
              <Text style={[styles.summaryNum, { color: colors.hot }]}>{r.b}</Text>
            </View>
            <View style={styles.summaryBar}>
              <View style={{ flex: aPct, backgroundColor: colors.accent }} />
              <View style={{ flex: bPct, backgroundColor: colors.hot }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 32 },
  placeholder: { color: colors.ink3, fontFamily: fonts.regular },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.ink3,
  },
  winnerCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  winnerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  winnerName: {
    color: colors.ink,
    fontFamily: fonts.black,
    fontSize: 22,
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  finalScoreRows: { gap: 4 },
  finalScoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  finalTeamLabel: {
    color: colors.ink2,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    flex: 1,
  },
  finalScoreSets: { flexDirection: 'row', gap: 12 },
  finalScoreNum: {
    fontFamily: fonts.black,
    fontVariant: ['tabular-nums'],
    fontSize: 26,
    minWidth: 18,
    textAlign: 'center',
  },
  playersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  psCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    padding: 12,
  },
  psHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  psAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  psInitial: { fontFamily: fonts.black, color: '#04111e', fontSize: 13 },
  psName: { color: colors.ink, fontFamily: fonts.extrabold, fontSize: 13 },
  psPos: { color: colors.ink3, fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.6, marginTop: 2 },
  psStatsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  psStatNum: {
    fontFamily: fonts.black,
    fontVariant: ['tabular-nums'],
    fontSize: 22,
  },
  psTopShot: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.surface2,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  psTopShotName: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.6 },
  summaryCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  summaryRow: { paddingVertical: 10 },
  summaryRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 },
  summaryNum: {
    fontFamily: fonts.black,
    fontVariant: ['tabular-nums'],
    fontSize: 18,
  },
  summaryBar: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
  },
  aiBtn: {
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: 4,
    opacity: 0.7,
  },
  aiBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aiBtnLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 12,
    color: colors.ink,
    letterSpacing: 2,
  },
  aiBtnSub: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.ink3,
    letterSpacing: 1.6,
  },
});
