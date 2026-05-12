import React, { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { colors, fonts } from '@/src/theme/tokens';

type Kind = 'default' | 'live' | 'warn' | 'hot' | 'set';

interface Props {
  label: string;
  kind?: Kind;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}

const KIND_BG: Record<Kind, string> = {
  default: colors.surface2,
  live: colors.surface2,
  warn: 'rgba(255,206,61,0.16)',
  hot: 'rgba(255,138,61,0.18)',
  set: 'rgba(58,168,255,0.16)',
};

const KIND_FG: Record<Kind, string> = {
  default: colors.ink2,
  live: colors.ink2,
  warn: colors.warn,
  hot: colors.hot,
  set: colors.accent,
};

const KIND_BORDER: Record<Kind, string> = {
  default: colors.borderSoft,
  live: colors.borderSoft,
  warn: 'rgba(255,206,61,0.4)',
  hot: 'rgba(255,138,61,0.4)',
  set: 'rgba(58,168,255,0.4)',
};

export function Chip({ label, kind = 'default', small, style }: Props) {
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: KIND_BG[kind],
          borderColor: KIND_BORDER[kind],
          paddingHorizontal: small ? 6 : 10,
          paddingVertical: small ? 2 : 4,
        },
        style,
      ]}
    >
      {kind === 'live' ? <PulseDot /> : null}
      <Text style={[styles.label, { color: KIND_FG[kind], fontSize: small ? 9 : 11 }]}>{label}</Text>
    </View>
  );
}

function PulseDot() {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withTiming(0.4, { duration: 800 }), -1, true);
  }, [o]);
  const animStyle = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, animStyle]} />;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: fonts.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
});
