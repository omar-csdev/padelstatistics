import { StyleSheet, Text, View } from 'react-native';
import { Chip } from '@/src/components/Chip';
import { SectionTitle } from '@/src/components/SectionTitle';
import type { AISummaryPayload } from '@/src/api/aiSummary';
import type { Position } from '@/src/engine/types';
import { colors, fonts } from '@/src/theme/tokens';

const POSITION_LABELS: Record<Position, string> = {
  tl: 'TOP · LEFT',
  tr: 'TOP · RIGHT',
  bl: 'BOTTOM · LEFT',
  br: 'BOTTOM · RIGHT',
};

interface Props {
  payload: AISummaryPayload;
  cached: boolean;
  positions: Record<Position, string>;
  usage?: { used: number; limit: number };
}

export function AISummaryView({ payload, cached, positions, usage }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>AI COACHING REPORT</Text>
        <View style={styles.headerChips}>
          {usage ? <Chip label={`${usage.used} OF ${usage.limit}`} small /> : null}
          {cached ? <Chip label="CACHED" kind="set" small /> : <Chip label="FRESH" kind="set" small />}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.body}>{payload.summary}</Text>
      </View>

      <SectionTitle index="A" title="Tactical Read" />
      <View style={styles.card}>
        <Text style={styles.body}>{payload.tactics}</Text>
      </View>

      <SectionTitle index="B" title="Per-Player" />
      <View style={styles.playerGrid}>
        {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => {
          const p = payload.players[pos];
          return (
            <View key={pos} style={styles.playerCard}>
              <Text style={styles.playerName} numberOfLines={1}>{positions[pos] || '—'}</Text>
              <Text style={styles.playerPos}>{POSITION_LABELS[pos]}</Text>
              <Text style={styles.tag}>STRENGTHS</Text>
              {p.strengths.length === 0 ? (
                <Text style={styles.bulletMuted}>· —</Text>
              ) : (
                p.strengths.map((s, i) => (
                  <Text key={`s-${i}`} style={styles.bullet}>· {s}</Text>
                ))
              )}
              <Text style={[styles.tag, styles.tagSpaced]}>WEAKNESSES</Text>
              {p.weaknesses.length === 0 ? (
                <Text style={styles.bulletMuted}>· —</Text>
              ) : (
                p.weaknesses.map((w, i) => (
                  <Text key={`w-${i}`} style={styles.bullet}>· {w}</Text>
                ))
              )}
            </View>
          );
        })}
      </View>

      <SectionTitle index="C" title="Key Patterns" />
      <View style={styles.card}>
        {payload.patterns.length === 0 ? (
          <Text style={styles.bulletMuted}>· No patterns extracted.</Text>
        ) : (
          payload.patterns.map((p, i) => (
            <Text key={i} style={[styles.body, i > 0 && styles.bodySpaced]}>· {p}</Text>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerChips: { flexDirection: 'row', gap: 6 },
  label: {
    color: colors.accent,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.6,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 14,
  },
  body: {
    color: colors.ink,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  bodySpaced: { marginTop: 6 },
  playerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  playerCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
  },
  playerName: { color: colors.ink, fontFamily: fonts.extrabold, fontSize: 14 },
  playerPos: {
    color: colors.ink3,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.4,
    marginTop: 2,
    marginBottom: 8,
  },
  tag: {
    color: colors.ink3,
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  tagSpaced: { marginTop: 8 },
  bullet: { color: colors.ink2, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  bulletMuted: { color: colors.ink3, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
});
