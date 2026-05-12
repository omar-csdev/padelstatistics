import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/src/theme/tokens';

interface Props {
  index: string;
  title: string;
  accent?: string;
}

export function SectionTitle({ index, title, accent }: Props) {
  return (
    <View style={styles.row}>
      <Text style={[styles.index, { color: accent ?? colors.ink3 }]}>{index}</Text>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 6,
    marginHorizontal: 2,
  },
  index: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
  },
  title: {
    color: colors.ink,
    fontFamily: fonts.extrabold,
    fontSize: 14,
    letterSpacing: 0.6,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderSoft,
    marginLeft: 6,
  },
});
