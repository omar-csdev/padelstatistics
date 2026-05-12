import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PadelCourt } from '@/src/components/PadelCourt';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { SectionTitle } from '@/src/components/SectionTitle';
import type { MatchConfig, Position, ScoringVariant, Team } from '@/src/engine/types';
import { createMatch } from '@/src/store/matches';
import { colors, fonts, radii } from '@/src/theme/tokens';

const TEAM_A_ACCENT = colors.accent;
const TEAM_B_ACCENT = colors.hot;

export default function SetupScreen() {
  const router = useRouter();
  const [players, setPlayers] = useState<Record<Position, string>>({
    tl: '',
    tr: '',
    bl: '',
    br: '',
  });
  const [bestOf, setBestOf] = useState<3 | 5>(3);
  const [scoring, setScoring] = useState<ScoringVariant>('golden');
  const [server, setServer] = useState<Team>('bot');

  const teamNames = useMemo<[string, string]>(
    () => [
      `${players.tl || '—'} / ${players.tr || '—'}`,
      `${players.bl || '—'} / ${players.br || '—'}`,
    ],
    [players],
  );

  const canStart = !!(players.tl && players.tr && players.bl && players.br);

  function start() {
    if (!canStart) return;
    const config: MatchConfig = {
      positions: players,
      teamNames,
      bestOf,
      scoring,
      firstServer: server,
    };
    const id = createMatch(config);
    router.replace(`/match/${id}/live` as never);
  }

  function setPos(pos: Position, name: string) {
    setPlayers((p) => ({ ...p, [pos]: name }));
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title="New Match"
        subtitle="Setup"
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.courtCard}>
          <View style={styles.courtCardHeader}>
            <Text style={styles.label}>COURT POSITIONS</Text>
            <Text style={[styles.label, { color: colors.accent }]}>FILL TO ASSIGN</Text>
          </View>
          <View style={styles.courtBox}>
            <PadelCourt positions={players} compact />
          </View>
        </View>

        <SectionTitle index="01" title="Team A" accent={TEAM_A_ACCENT} />
        <View style={styles.grid2}>
          <PlayerInput label="TOP LEFT" name={players.tl} onChange={(n) => setPos('tl', n)} accent={TEAM_A_ACCENT} />
          <PlayerInput label="TOP RIGHT" name={players.tr} onChange={(n) => setPos('tr', n)} accent={TEAM_A_ACCENT} />
        </View>

        <SectionTitle index="02" title="Team B" accent={TEAM_B_ACCENT} />
        <View style={styles.grid2}>
          <PlayerInput label="BOTTOM LEFT" name={players.bl} onChange={(n) => setPos('bl', n)} accent={TEAM_B_ACCENT} />
          <PlayerInput label="BOTTOM RIGHT" name={players.br} onChange={(n) => setPos('br', n)} accent={TEAM_B_ACCENT} />
        </View>

        <SectionTitle index="03" title="Match Format" />
        <View style={styles.grid2}>
          {([3, 5] as const).map((n) => (
            <Pressable
              key={n}
              onPress={() => setBestOf(n)}
              style={[
                styles.formatBtn,
                bestOf === n && { backgroundColor: colors.accent, borderColor: colors.accent },
              ]}
            >
              <Text style={[styles.formatLabel, bestOf === n && { color: colors.onAccent }]}>BEST OF</Text>
              <Text style={[styles.formatNum, bestOf === n && { color: colors.onAccent }]}>{n}</Text>
            </Pressable>
          ))}
        </View>

        <SectionTitle index="04" title="Scoring" />
        <View style={styles.grid2}>
          {([
            { id: 'golden', label: 'GOLDEN PT', sub: 'Sudden death at 40-40' },
            { id: 'advantage', label: 'ADVANTAGE', sub: 'Traditional deuce / AD' },
          ] as { id: ScoringVariant; label: string; sub: string }[]).map((opt) => (
            <Pressable
              key={opt.id}
              onPress={() => setScoring(opt.id)}
              style={[
                styles.scoringBtn,
                scoring === opt.id && { borderColor: colors.accent, backgroundColor: 'rgba(58,168,255,0.10)' },
              ]}
            >
              <View style={styles.scoringTopRow}>
                <Text style={[styles.scoringLabel, scoring === opt.id && { color: colors.accent }]}>{opt.label}</Text>
                <Radio selected={scoring === opt.id} accent={colors.accent} />
              </View>
              <Text style={styles.scoringSub}>{opt.sub}</Text>
            </Pressable>
          ))}
        </View>

        <SectionTitle index="05" title="First Serve" />
        <View style={styles.grid2}>
          <ServerCard
            label="TEAM A"
            sub={teamNames[0]}
            selected={server === 'top'}
            accent={TEAM_A_ACCENT}
            onPress={() => setServer('top')}
          />
          <ServerCard
            label="TEAM B"
            sub={teamNames[1]}
            selected={server === 'bot'}
            accent={TEAM_B_ACCENT}
            onPress={() => setServer('bot')}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={start}
          disabled={!canStart}
          style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
        >
          <Text style={styles.startLabel}>START MATCH</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.onAccent} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

interface PlayerInputProps {
  label: string;
  name: string;
  onChange: (s: string) => void;
  accent: string;
}

function PlayerInput({ label, name, onChange, accent }: PlayerInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.inputCard, focused && { borderColor: accent }]}>
      <View style={styles.inputHeader}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <TextInput
        value={name}
        onChangeText={onChange}
        placeholder="Player"
        placeholderTextColor={colors.ink3}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="words"
      />
    </View>
  );
}

interface ServerCardProps {
  label: string;
  sub: string;
  selected: boolean;
  accent: string;
  onPress: () => void;
}

function ServerCard({ label, sub, selected, accent, onPress }: ServerCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.serverCard,
        selected && { borderColor: accent, backgroundColor: 'rgba(58,168,255,0.08)' },
      ]}
    >
      <View style={styles.serverTopRow}>
        <Text style={[styles.label, selected && { color: accent }]}>{label}</Text>
        <Radio selected={selected} accent={accent} />
      </View>
      <Text style={styles.serverSub} numberOfLines={1}>{sub}</Text>
    </Pressable>
  );
}

function Radio({ selected, accent }: { selected: boolean; accent: string }) {
  return (
    <View style={[styles.radio, { borderColor: selected ? accent : colors.border }]}>
      {selected ? <View style={[styles.radioDot, { backgroundColor: accent }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 100 },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.ink3,
  },
  courtCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  courtCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  courtBox: { height: 260, marginTop: 4 },
  grid2: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  inputCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  input: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 17,
    paddingVertical: 0,
  },
  formatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface2,
  },
  formatLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.ink2,
    letterSpacing: 1.6,
  },
  formatNum: {
    fontFamily: fonts.black,
    fontVariant: ['tabular-nums'],
    fontSize: 22,
    color: colors.ink,
  },
  scoringBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  scoringTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoringLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 13,
    color: colors.ink,
    letterSpacing: 0.8,
  },
  scoringSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.ink3,
    lineHeight: 14,
  },
  serverCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  serverTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serverSub: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.bg,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: 18,
  },
  startBtnDisabled: { opacity: 0.4 },
  startLabel: {
    fontFamily: fonts.black,
    fontSize: 16,
    letterSpacing: 2.4,
    color: colors.onAccent,
  },
});
