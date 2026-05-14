import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MomentumChart } from '@/src/components/MomentumChart';
import { PadelCourt } from '@/src/components/PadelCourt';
import { RadialWheel } from '@/src/components/RadialWheel';
import { Scoreboard } from '@/src/components/Scoreboard';
import { useMatch } from '@/src/hooks/useMatch';
import type { Position } from '@/src/engine/types';
import { colors, fonts } from '@/src/theme/tokens';

const POSITION_LABELS: Record<Position, string> = {
  tl: 'TOP · LEFT',
  tr: 'TOP · RIGHT',
  bl: 'BOTTOM · LEFT',
  br: 'BOTTOM · RIGHT',
};

function formatClock(start: number, now: number): string {
  const ms = Math.max(0, now - start);
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function LiveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const matchId = useMemo(() => String(params.id ?? ''), [params.id]);
  const { state, loading, logPoint, undoLast, switchSides, finish } = useMatch(matchId);
  const [active, setActive] = useState<{ pos: Position; name: string } | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (state?.finished) {
      const t = setTimeout(() => router.replace(`/match/${matchId}/post` as never), 600);
      return () => clearTimeout(t);
    }
  }, [matchId, router, state?.finished]);

  if (loading || !state) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.metaText}>Loading match…</Text>
      </View>
    );
  }

  const clock = formatClock(state.startTime, now);

  function handleTap(pos: Position) {
    if (!state) return;
    Haptics.selectionAsync().catch(() => {});
    setActive({ pos, name: state.config.positions[pos] });
  }

  function handlePick(pick: { result: 'won'; shot: import('@/src/engine/types').Shot } | { result: 'lost'; error: import('@/src/engine/types').ErrorKind }) {
    if (!active) return;
    Haptics.notificationAsync(
      pick.result === 'won' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});
    if (pick.result === 'won') {
      logPoint({ byPos: active.pos, result: 'won', shot: pick.shot });
    } else {
      logPoint({ byPos: active.pos, result: 'lost', error: pick.error });
    }
    setActive(null);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.headerBar}>
        <Pressable onPress={() => router.replace('/' as never)} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.ink2} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>LIVE MATCH</Text>
          <Text style={styles.headerSub}>
            {state.config.scoring === 'golden' ? 'GOLDEN PT' : 'ADVANTAGE'} · BO{state.config.bestOf}
          </Text>
        </View>
        <Pressable onPress={() => setConfirmFinish(true)} style={styles.iconBtn}>
          <Ionicons name="checkmark" size={22} color={colors.ink2} />
        </Pressable>
      </View>

      <View style={styles.scoreboardWrap}>
        <Scoreboard state={state} clock={clock} />
      </View>

      <View style={styles.courtWrap}>
        <PadelCourt
          positions={state.config.positions}
          serving={state.serving}
          onPlayerTap={handleTap}
        />
      </View>

      <View style={styles.momentumWrap}>
        <MomentumChart history={state.history} height={64} />
      </View>

      <View style={styles.actionBar}>
        <ActionButton
          icon="arrow-undo"
          label="UNDO"
          disabled={state.history.length === 0}
          onPress={undoLast}
        />
        <ActionButton icon="swap-horizontal" label="SIDES" onPress={switchSides} />
        <ActionButton
          icon="flash"
          label={String(state.history.length)}
          sub="POINTS"
        />
        <ActionButton
          icon="trophy"
          label="STATS"
          onPress={() => router.push(`/match/${matchId}/post` as never)}
        />
      </View>

      {active ? (
        <RadialWheel
          playerName={active.name}
          playerPosLabel={POSITION_LABELS[active.pos]}
          onPick={handlePick}
          onCancel={() => setActive(null)}
        />
      ) : null}

      <Modal
        visible={confirmFinish}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmFinish(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setConfirmFinish(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="flag" size={22} color={colors.accent2} />
            </View>
            <Text style={styles.modalTitle}>FINISH MATCH?</Text>
            <Text style={styles.modalBody}>
              This will end the match and lock the score. You&apos;ll be taken to the summary and the
              match will be marked as finished.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setConfirmFinish(false)}
                style={[styles.modalBtn, styles.modalBtnGhost]}
              >
                <Text style={styles.modalBtnGhostLabel}>NO</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  setConfirmFinish(false);
                  finish();
                  router.replace(`/match/${matchId}/post` as never);
                }}
                style={[styles.modalBtn, styles.modalBtnPrimary]}
              >
                <Text style={styles.modalBtnPrimaryLabel}>YES, FINISH</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

interface ActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  onPress?: () => void;
  disabled?: boolean;
}

function ActionButton({ icon, label, sub, onPress, disabled }: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.actionBtn, disabled && styles.actionBtnDisabled]}
    >
      <Ionicons name={icon} size={18} color={disabled ? colors.ink3 : colors.ink} />
      <Text style={[styles.actionLabel, disabled && { color: colors.ink3 }]}>{label}</Text>
      {sub ? <Text style={styles.actionSub}>{sub}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: {
    color: colors.ink,
    fontFamily: fonts.extrabold,
    fontSize: 13,
    letterSpacing: 2.4,
  },
  headerSub: {
    color: colors.ink3,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    marginTop: 2,
  },
  scoreboardWrap: { paddingHorizontal: 14, paddingBottom: 10 },
  courtWrap: {
    flex: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  momentumWrap: { paddingHorizontal: 14, paddingBottom: 8 },
  actionBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  actionBtnDisabled: { opacity: 0.5 },
  actionLabel: {
    fontFamily: fonts.extrabold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.ink,
  },
  actionSub: {
    fontFamily: fonts.bold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: colors.ink3,
  },
  metaText: { color: colors.ink3, fontFamily: fonts.regular },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 10, 20, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    alignItems: 'center',
  },
  modalIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    color: colors.ink,
    fontFamily: fonts.extrabold,
    fontSize: 16,
    letterSpacing: 2.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalBody: {
    color: colors.ink2,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnGhost: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: 'transparent',
  },
  modalBtnGhostLabel: {
    color: colors.ink2,
    fontFamily: fonts.extrabold,
    fontSize: 12,
    letterSpacing: 2,
  },
  modalBtnPrimary: {
    backgroundColor: colors.accent,
  },
  modalBtnPrimaryLabel: {
    color: colors.onAccent,
    fontFamily: fonts.extrabold,
    fontSize: 12,
    letterSpacing: 2,
  },
});
