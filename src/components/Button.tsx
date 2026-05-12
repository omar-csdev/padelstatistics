import React from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native';
import { colors, fonts, radii } from '@/src/theme/tokens';

type Variant = 'primary' | 'ghost' | 'solid';

interface Props {
  label?: string;
  variant?: Variant;
  onPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function Button({ label, variant = 'solid', onPress, disabled, style, children }: Props) {
  const variantStyle =
    variant === 'primary' ? styles.primary : variant === 'ghost' ? styles.ghost : styles.solid;
  const textStyle =
    variant === 'primary' ? styles.primaryText : variant === 'ghost' ? styles.ghostText : styles.solidText;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variantStyle,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {children ? (
        <View style={styles.row}>{children}</View>
      ) : (
        <Text style={textStyle}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
  },
  solid: {
    backgroundColor: colors.surface2,
    borderColor: colors.borderSoft,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
  primaryText: {
    color: colors.onAccent,
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 0.6,
  },
  ghostText: {
    color: colors.ink2,
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 0.6,
  },
  solidText: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 0.6,
  },
});
