import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import type { PointEvent } from '@/src/engine/types';
import { colors, fonts } from '@/src/theme/tokens';

interface Props {
  history: PointEvent[];
  height?: number;
  emptyLabel?: string;
}

export function MomentumChart({ history, height = 72, emptyLabel = 'No points yet' }: Props) {
  const pts: { x: number; y: number }[] = [];
  let diff = 0;
  for (let i = 0; i < history.length; i++) {
    diff += history[i].winner === 'top' ? 1 : -1;
    pts.push({ x: i + 1, y: diff });
  }

  if (pts.length === 0) {
    return (
      <View style={[styles.card, { height }]}>
        <Text style={styles.empty}>{emptyLabel.toUpperCase()}</Text>
      </View>
    );
  }

  const W = 320;
  const innerH = height - 22;
  const maxAbs = Math.max(3, ...pts.map((p) => Math.abs(p.y)));
  const xStep = (W - 24) / Math.max(pts.length, 12);
  const yScale = innerH / 2 / maxAbs;
  const cy = innerH / 2;
  const path =
    `M 12 ${cy} ` +
    pts.map((p, i) => `L ${12 + (i + 1) * xStep} ${cy - p.y * yScale}`).join(' ');
  const last = pts[pts.length - 1];

  return (
    <View style={[styles.card, { height }]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>MOMENTUM · {pts.length} PTS</Text>
        <Text style={[styles.headerVal, { color: last.y > 0 ? colors.accent : colors.hot }]}>
          {last.y > 0 ? '+' : ''}
          {last.y}
        </Text>
      </View>
      <Svg viewBox={`0 0 ${W} ${innerH}`} width="100%" height={innerH} preserveAspectRatio="none">
        <Line x1={0} y1={cy} x2={W} y2={cy} stroke={colors.border} strokeDasharray="2 2" />
        <Path d={path} fill="none" stroke={colors.accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <Circle
            key={i}
            cx={12 + (i + 1) * xStep}
            cy={cy - p.y * yScale}
            r="1.6"
            fill={p.y > 0 ? colors.accent : p.y < 0 ? colors.hot : colors.ink3}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.ink3,
  },
  headerVal: {
    fontFamily: fonts.mono,
    fontSize: 10,
  },
  empty: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.ink3,
    textAlign: 'center',
  },
});
