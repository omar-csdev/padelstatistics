import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip } from '@/src/components/Chip';
import { ScreenHeader } from '@/src/components/ScreenHeader';
import { listMatches, type MatchRow } from '@/src/store/matches';
import { getEvents } from '@/src/store/events';
import { fold, isMatchOver } from '@/src/engine/scoring';
import type { SetScore } from '@/src/engine/types';
import { colors, fonts } from '@/src/theme/tokens';

interface HistoryItem {
  row: MatchRow;
  setsDisplay: SetScore[];
  duration: string;
  finished: boolean;
  winnerTeam: 'top' | 'bot' | null;
}

function formatDuration(start: number, end: number): string {
  const ms = Math.max(0, end - start);
  const min = Math.floor(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}` : `00:${String(m).padStart(2, '0')}`;
}

function formatDate(ts: number): { date: string; time: string } {
  const d = new Date(ts);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const date = `${d.getDate()} ${months[d.getMonth()]}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { date, time };
}

function loadAll(): HistoryItem[] {
  const rows = listMatches();
  return rows.map((row) => {
    const events = getEvents(row.id);
    const state = fold(row.config, events, row.createdAt);
    const finished = isMatchOver(state);
    return {
      row,
      setsDisplay: state.sets,
      duration: formatDuration(row.createdAt, row.finishedAt ?? Date.now()),
      finished: finished || row.status === 'finished',
      winnerTeam: state.winner,
    };
  });
}

export default function HistoryScreen() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      setItems(loadAll());
    }, []),
  );

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        title="Matches"
        subtitle={items.length ? `${items.length} logged` : 'No matches yet'}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="tennisball-outline" size={32} color={colors.ink3} />
            </View>
            <Text style={styles.emptyTitle}>NO MATCHES YET</Text>
            <Text style={styles.emptyBody}>
              Tap the + button below to set up a new match and start logging points.
            </Text>
          </View>
        ) : (
          items.map((it) => <HistoryRow key={it.row.id} item={it} onPress={() => {
            const target = it.finished ? `/match/${it.row.id}/post` : `/match/${it.row.id}/live`;
            router.push(target as never);
          }} />)
        )}
      </ScrollView>

      <Pressable
        style={styles.fab}
        onPress={() => router.push('/setup')}
      >
        <Ionicons name="add" size={28} color={colors.onAccent} />
      </Pressable>
    </SafeAreaView>
  );
}

function HistoryRow({ item, onPress }: { item: HistoryItem; onPress: () => void }) {
  const { row, setsDisplay, duration, finished } = item;
  const { date, time } = formatDate(row.createdAt);
  const aWon = setsDisplay.filter((s) => s.top > s.bot).length;
  const bWon = setsDisplay.filter((s) => s.bot > s.top).length;
  const aWonMatch = aWon > bWon;

  return (
    <Pressable
      style={[styles.row, !finished && styles.rowLive]}
      onPress={onPress}
    >
      <View style={styles.rowHeader}>
        <View style={styles.rowHeaderLeft}>
          {!finished ? <Chip label="LIVE" kind="live" small /> : null}
          <Text style={styles.rowDate}>
            {date} · {time}
          </Text>
        </View>
        <Text style={styles.rowDuration}>{duration}</Text>
      </View>

      <View style={styles.scoreRow}>
        <Text
          style={[styles.teamName, { color: aWonMatch ? colors.ink : colors.ink2 }]}
          numberOfLines={1}
        >
          {row.config.teamNames[0]}
        </Text>
        <View style={styles.setRow}>
          {setsDisplay.length === 0 ? (
            <Text style={styles.dash}>—</Text>
          ) : (
            setsDisplay.map((s, i) => (
              <Text
                key={i}
                style={[
                  styles.setNum,
                  { color: s.top > s.bot ? colors.accent : colors.ink3 },
                ]}
              >
                {s.top}
              </Text>
            ))
          )}
        </View>
      </View>
      <View style={styles.scoreRow}>
        <Text
          style={[styles.teamName, { color: !aWonMatch ? colors.ink : colors.ink2 }]}
          numberOfLines={1}
        >
          {row.config.teamNames[1]}
        </Text>
        <View style={styles.setRow}>
          {setsDisplay.length === 0 ? (
            <Text style={styles.dash}>—</Text>
          ) : (
            setsDisplay.map((s, i) => (
              <Text
                key={i}
                style={[
                  styles.setNum,
                  { color: s.bot > s.top ? colors.hot : colors.ink3 },
                ]}
              >
                {s.bot}
              </Text>
            ))
          )}
        </View>
      </View>

      <View style={styles.rowFooter}>
        <Text style={styles.rowTag}>BO{row.config.bestOf} · {row.config.scoring.toUpperCase()}</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.ink3} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 120 },
  empty: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.extrabold,
    fontSize: 13,
    letterSpacing: 1.6,
    marginTop: 8,
  },
  emptyBody: {
    color: colors.ink3,
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 18,
  },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  rowLive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(58,168,255,0.06)',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowDate: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.ink3,
  },
  rowDuration: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.ink3,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  teamName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    flex: 1,
    paddingRight: 12,
  },
  setRow: { flexDirection: 'row', gap: 6 },
  setNum: {
    fontFamily: fonts.black,
    fontVariant: ['tabular-nums'],
    fontSize: 16,
    minWidth: 14,
    textAlign: 'right',
  },
  dash: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.ink3,
  },
  rowFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTag: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.ink3,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
});
