import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import { aggregate } from '@/src/engine/aggregation';
import { fold } from '@/src/engine/scoring';
import type { MatchState, PointEvent, Position, Shot } from '@/src/engine/types';
import { getEvents } from '@/src/store/events';
import { getMatch } from '@/src/store/matches';
import { colors, fonts } from '@/src/theme/tokens';

const POSITION_LABELS: Record<Position, string> = {
  tl: 'TOP · LEFT',
  tr: 'TOP · RIGHT',
  bl: 'BOTTOM · LEFT',
  br: 'BOTTOM · RIGHT',
};

const SHOTS: { id: Shot; label: string }[] = [
  { id: 'lob', label: 'LOB' },
  { id: 'vibora', label: 'VIBORA' },
  { id: 'smash', label: 'SMASH' },
  { id: 'bandeja', label: 'BANDEJA' },
  { id: 'volley', label: 'VOLLEY' },
  { id: 'other', label: 'OTHER' },
];

function isValidPos(s: string): s is Position {
  return s === 'tl' || s === 'tr' || s === 'bl' || s === 'br';
}

export default function BreakdownScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; pos: string }>();
  const matchId = useMemo(() => Number(params.id), [params.id]);
  const pos: Position | null = isValidPos(params.pos as string) ? (params.pos as Position) : null;
  const [state, setState] = useState<MatchState | null>(null);

  useFocusEffect(
    useCallback(() => {
      const row = getMatch(matchId);
      if (!row) return;
      const events = getEvents(matchId);
      setState(fold(row.config, events, row.createdAt));
    }, [matchId]),
  );

  const stats = useMemo(() => (state ? aggregate(state.history, state.config.positions) : null), [state]);

  if (!state || !stats || !pos) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.placeholder}>Loading…</Text>
      </View>
    );
  }

  const playerStats = stats.perPlayer[pos];
  const isTop = pos === 'tl' || pos === 'tr';
  const accent = isTop ? colors.accent : colors.hot;
  const total = playerStats.winners + playerStats.forced + playerStats.unforced;
  const winPct = total ? Math.round((playerStats.winners / total) * 100) : 0;

  const topShot = Object.entries(playerStats.shotCounts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
  const shotsList = SHOTS.map((s) => ({ ...s, count: playerStats.shotCounts[s.id] ?? 0 }));
  const shotMax = Math.max(1, ...shotsList.map((s) => s.count));

  // Personal momentum points (cumulative +/- contribution by this player).
  const personalPoints = computePersonal(state.history, pos);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title={playerStats.name || '—'}
        subtitle={POSITION_LABELS[pos]}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroCard, { borderColor: accent }]}>
          <View style={[styles.avatar, { backgroundColor: accent }]}>
            <Text style={styles.avatarInitial}>{(playerStats.name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heroName} numberOfLines={1}>{playerStats.name || '—'}</Text>
            <Text style={styles.heroMeta}>{total} POINTS · {winPct}% WIN</Text>
          </View>
        </View>

        <View style={styles.bigStatsRow}>
          <BigStat label="WINNERS" value={playerStats.winners} color={colors.won} />
          <BigStat label="UNFORCED" value={playerStats.unforced} color={colors.error} />
          <BigStat label="FORCED" value={playerStats.forced} color={colors.warn} />
        </View>

        {topShot ? (
          <View style={styles.topShotCard}>
            <View>
              <Text style={styles.label}>MOST EFFECTIVE</Text>
              <Text style={styles.topShotName}>{topShot[0].toUpperCase()}</Text>
            </View>
            <Text style={[styles.topShotCount, { color: accent }]}>×{topShot[1]}</Text>
          </View>
        ) : null}

        <SectionTitle index="01" title="Shot Distribution" />
        <View style={styles.distCard}>
          {shotsList.map((s) => (
            <View key={s.id} style={styles.distRow}>
              <View style={styles.distHeader}>
                <Text style={styles.distLabel}>{s.label}</Text>
                <Text style={[styles.distCount, { color: s.count ? colors.accent : colors.ink3 }]}>{s.count}</Text>
              </View>
              <View style={styles.distBarTrack}>
                <View
                  style={{
                    width: `${(s.count / shotMax) * 100}%`,
                    height: '100%',
                    backgroundColor: s.count ? accent : 'transparent',
                  }}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 8 }} />
        <SectionTitle index="02" title="Personal Momentum" />
        <View style={styles.momentumCard}>
          <Text style={styles.label}>POINT-BY-POINT CONTRIBUTION</Text>
          {personalPoints.length === 0 ? (
            <Text style={styles.placeholder}>No data yet</Text>
          ) : (
            <PersonalMini points={personalPoints} accent={accent} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function computePersonal(events: PointEvent[], pos: Position): { i: number; cumulative: number; result: 'won' | 'lost' }[] {
  const out: { i: number; cumulative: number; result: 'won' | 'lost' }[] = [];
  let c = 0;
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.byPos !== pos) continue;
    c += ev.result === 'won' ? 1 : -1;
    out.push({ i, cumulative: c, result: ev.result });
  }
  return out;
}

function BigStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.bigStat}>
      <Text style={[styles.bigStatNum, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function PersonalMini({ points, accent }: { points: { i: number; cumulative: number; result: 'won' | 'lost' }[]; accent: string }) {
  const W = 320;
  const H = 60;
  const maxAbs = Math.max(2, ...points.map((p) => Math.abs(p.cumulative)));
  const xStep = (W - 16) / Math.max(points.length, 5);
  const path =
    `M 8 ${H / 2} ` +
    points.map((p, i) => `L ${8 + (i + 1) * xStep} ${H / 2 - p.cumulative * (H / 2 / maxAbs)}`).join(' ');

  return (
    <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <Line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke={colors.border} strokeDasharray="2 2" />
      <Path d={path} fill="none" stroke={accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <Circle
          key={i}
          cx={8 + (i + 1) * xStep}
          cy={H / 2 - p.cumulative * (H / 2 / maxAbs)}
          r={p.result === 'won' ? 2.4 : 2}
          fill={p.result === 'won' ? colors.won : colors.error}
        />
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 32 },
  placeholder: { color: colors.ink3, fontFamily: fonts.regular, marginTop: 8 },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.ink3,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  avatarInitial: { fontFamily: fonts.black, fontSize: 28, color: '#04111e' },
  heroName: { color: colors.ink, fontFamily: fonts.black, fontSize: 22 },
  heroMeta: {
    color: colors.ink2,
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 4,
  },
  bigStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  bigStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
  },
  bigStatNum: {
    fontFamily: fonts.black,
    fontVariant: ['tabular-nums'],
    fontSize: 30,
    marginBottom: 6,
  },
  topShotCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topShotName: {
    color: colors.ink,
    fontFamily: fonts.black,
    fontSize: 22,
    marginTop: 2,
  },
  topShotCount: {
    fontFamily: fonts.black,
    fontVariant: ['tabular-nums'],
    fontSize: 36,
  },
  distCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  distRow: { marginBottom: 10 },
  distHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  distLabel: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.8,
  },
  distCount: {
    fontFamily: fonts.mono,
    fontSize: 14,
  },
  distBarTrack: {
    height: 5,
    backgroundColor: colors.surface2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  momentumCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
});
