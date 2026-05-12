import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import type { Position, Positions, Team } from '@/src/engine/types';
import { colors, fonts } from '@/src/theme/tokens';

const W = 220;
const H = 360;
const PAD = 18;
const POSITIONS: Position[] = ['tl', 'tr', 'bl', 'br'];

const COORDS: Record<Position, [number, number]> = {
  tl: [W / 4, H * 0.22],
  tr: [(3 * W) / 4, H * 0.22],
  bl: [W / 4, H * 0.78],
  br: [(3 * W) / 4, H * 0.78],
};

interface Props {
  positions: Positions;
  serving?: Team | null;
  highlightPos?: Position | null;
  onPlayerTap?: (pos: Position) => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PadelCourt({ positions, serving, highlightPos, onPlayerTap, compact, style }: Props) {
  const r = compact ? 22 : 30;
  const tapR = compact ? 32 : 40;

  return (
    <View style={[styles.container, style]}>
      <Svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        <Defs>
          <LinearGradient id="courtgrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.courtBlue} />
            <Stop offset="0.5" stopColor={colors.courtGlass} />
            <Stop offset="1" stopColor={colors.courtBlue} />
          </LinearGradient>
          <RadialGradient id="dotglow" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={colors.accent} stopOpacity="0.6" />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect
          x={PAD - 6}
          y={PAD - 6}
          width={W - 2 * (PAD - 6)}
          height={H - 2 * (PAD - 6)}
          fill="none"
          stroke={colors.border}
          strokeWidth="1"
          strokeDasharray="2 4"
          opacity="0.45"
          rx="4"
        />
        <Rect
          x={PAD}
          y={PAD}
          width={W - 2 * PAD}
          height={H - 2 * PAD}
          fill="url(#courtgrad)"
          stroke={colors.courtLine}
          strokeWidth="1.2"
          rx="2"
        />

        <Line x1={PAD} y1={H / 2} x2={W - PAD} y2={H / 2} stroke={colors.ink} strokeWidth="2.4" opacity="0.95" />
        <Line x1={PAD} y1={H * 0.32} x2={W - PAD} y2={H * 0.32} stroke={colors.courtLine} strokeWidth="1" />
        <Line x1={PAD} y1={H * 0.68} x2={W - PAD} y2={H * 0.68} stroke={colors.courtLine} strokeWidth="1" />
        <Line x1={W / 2} y1={H * 0.32} x2={W / 2} y2={H * 0.68} stroke={colors.courtLine} strokeWidth="1" />

        {POSITIONS.map((pos) => {
          const [x, y] = COORDS[pos];
          const isTop = pos === 'tl' || pos === 'tr';
          const color = isTop ? colors.accent : colors.hot;
          const name = positions[pos] || '—';
          const isHighlight = highlightPos === pos;
          const isServing = (serving === 'top' && isTop) || (serving === 'bot' && !isTop);
          const initial = (name.charAt(0) || '?').toUpperCase();
          return (
            <G key={pos}>
              {isHighlight ? <Circle cx={x} cy={y} r={r + 8} fill="url(#dotglow)" /> : null}
              <Circle cx={x} cy={y} r={r} fill={color} stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" />
              <SvgText
                x={x}
                y={y + r * 0.32}
                textAnchor="middle"
                fontFamily={fonts.black}
                fontSize={r * 0.9}
                fill="#04111e"
              >
                {initial}
              </SvgText>
              <Rect x={x - 32} y={y + r + 4} width={64} height={18} rx={9} fill="rgba(0,0,0,0.55)" />
              <SvgText
                x={x}
                y={y + r + 16}
                textAnchor="middle"
                fontFamily={fonts.bold}
                fontSize="9"
                fill={colors.ink}
              >
                {name.toUpperCase().slice(0, 8)}
              </SvgText>
              {isServing ? (
                <Circle
                  cx={x + r * 0.75}
                  cy={y - r * 0.75}
                  r={5}
                  fill={colors.won}
                  stroke={colors.bg}
                  strokeWidth="1.5"
                />
              ) : null}
            </G>
          );
        })}
      </Svg>

      {onPlayerTap
        ? POSITIONS.map((pos) => {
            const [cx, cy] = COORDS[pos];
            const xPct = (cx / W) * 100;
            const yPct = (cy / H) * 100;
            return (
              <Pressable
                key={`tap-${pos}`}
                onPress={() => onPlayerTap(pos)}
                hitSlop={8}
                style={[
                  styles.tap,
                  {
                    left: `${xPct}%`,
                    top: `${yPct}%`,
                    marginLeft: -tapR,
                    marginTop: -tapR,
                    width: tapR * 2,
                    height: tapR * 2,
                    borderRadius: tapR,
                  },
                ]}
              />
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    aspectRatio: W / H,
    alignSelf: 'center',
    height: '100%',
    maxWidth: '100%',
  },
  tap: {
    position: 'absolute',
  },
});
