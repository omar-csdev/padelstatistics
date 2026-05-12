import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '@/src/theme/tokens';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: string;
  onAction?: () => void;
}

export function ScreenHeader({ title, subtitle, onBack, action, onAction }: Props) {
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.ink2} />
        </Pressable>
      ) : null}
      <View style={styles.titleCol}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} style={styles.actionBtn}>
          <Text style={styles.actionLabel}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: { flex: 1, minWidth: 0 },
  title: {
    color: colors.ink,
    fontFamily: fonts.black,
    fontSize: 18,
    letterSpacing: -0.2,
  },
  subtitle: {
    color: colors.ink3,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 10,
  },
  actionLabel: {
    color: colors.ink2,
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
  },
});
