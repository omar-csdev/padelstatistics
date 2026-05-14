import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import type { ErrorKind, Shot } from '@/src/engine/types';
import { colors, fonts } from '@/src/theme/tokens';

interface WinnerSeg {
  id: Shot;
  label: string;
}
interface ErrorSeg {
  id: ErrorKind;
  label: string;
  sub: string;
}

const WINNERS: WinnerSeg[] = [
  { id: 'vibora', label: 'VIBORA' },
  { id: 'smash', label: 'SMASH' },
  { id: 'bandeja', label: 'BANDEJA' },
  { id: 'volley', label: 'VOLLEY' },
];

const ERRORS: ErrorSeg[] = [
  { id: 'forced', label: 'FORCED', sub: 'ERROR' },
  { id: 'unforced', label: 'UNFORCED', sub: 'ERROR' },
];

interface PickWinner {
  result: 'won';
  shot: Shot;
}
interface PickError {
  result: 'lost';
  error: ErrorKind;
}
type Pick = PickWinner | PickError;

interface Props {
  playerName: string;
  playerPosLabel: string;
  size?: number;
  onPick: (pick: Pick) => void;
  onCancel?: () => void;
}

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx: number, cy: number, rOut: number, rIn: number, a1: number, a2: number): string {
  const large = a2 - a1 > 180 ? 1 : 0;
  const [x1, y1] = polar(cx, cy, rOut, a1);
  const [x2, y2] = polar(cx, cy, rOut, a2);
  const [x3, y3] = polar(cx, cy, rIn, a2);
  const [x4, y4] = polar(cx, cy, rIn, a1);
  return `M ${x1} ${y1} A ${rOut} ${rOut} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rIn} ${rIn} 0 ${large} 0 ${x4} ${y4} Z`;
}

export function RadialWheel({ playerName, playerPosLabel, size = 340, onPick, onCancel }: Props) {
  const W = size;
  const H = size;
  const cx = W / 2;
  const cy = H / 2;
  const rOut = W * 0.46;
  const rMid = W * 0.2;
  const rIn = W * 0.1;

  const winnerSegs = WINNERS.map((w, i) => {
    const sweep = 180 / WINNERS.length;
    const a1 = -90 + i * sweep;
    const a2 = a1 + sweep;
    const mid = (a1 + a2) / 2;
    const [lx, ly] = polar(cx, cy, (rOut + rMid) / 2, mid);
    return { ...w, a1, a2, lx, ly };
  });

  const errorSegs = ERRORS.map((e, i) => {
    const a1 = 90 + i * 90;
    const a2 = a1 + 90;
    const mid = (a1 + a2) / 2;
    const [lx, ly] = polar(cx, cy, (rOut + rMid) / 2, mid);
    return { ...e, a1, a2, lx, ly };
  });

  // Entry animation
  const scale = useSharedValue(0.7);
  const opacity = useSharedValue(0);
  useEffect(() => {
    scale.value = withTiming(1, { duration: 180 });
    opacity.value = withTiming(1, { duration: 180 });
  }, [opacity, scale]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Pressable style={styles.overlay} onPress={onCancel}>
      <Pressable onPress={() => {}}>
        <Animated.View style={[{ width: W, height: H }, animStyle]}>
          <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            <Defs>
              <LinearGradient id="wonGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.won} stopOpacity="0.6" />
                <Stop offset="1" stopColor={colors.won} stopOpacity="0.18" />
              </LinearGradient>
              <LinearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.error} stopOpacity="0.18" />
                <Stop offset="1" stopColor={colors.error} stopOpacity="0.55" />
              </LinearGradient>
            </Defs>

            <Circle cx={cx} cy={cy} r={rOut + 4} fill="rgba(0,0,0,0.7)" />

            {winnerSegs.map((s) => (
              <G key={s.id}>
                <Path
                  d={arcPath(cx, cy, rOut, rMid, s.a1 + 1, s.a2 - 1)}
                  fill="url(#wonGrad)"
                  stroke={colors.won}
                  strokeWidth="1"
                />
                <SvgText
                  x={s.lx}
                  y={s.ly + 4}
                  textAnchor="middle"
                  fontFamily={fonts.extrabold}
                  fontSize={W * 0.045}
                  fill={colors.ink}
                >
                  {s.label}
                </SvgText>
              </G>
            ))}

            {errorSegs.map((s) => (
              <G key={s.id}>
                <Path
                  d={arcPath(cx, cy, rOut, rMid, s.a1 + 1, s.a2 - 1)}
                  fill="url(#errGrad)"
                  stroke={colors.error}
                  strokeWidth="1"
                />
                <SvgText
                  x={s.lx}
                  y={s.ly}
                  textAnchor="middle"
                  fontFamily={fonts.extrabold}
                  fontSize={W * 0.05}
                  fill={colors.ink}
                >
                  {s.label}
                </SvgText>
                <SvgText
                  x={s.lx}
                  y={s.ly + 16}
                  textAnchor="middle"
                  fontFamily={fonts.medium}
                  fontSize={W * 0.03}
                  fill={colors.ink2}
                >
                  {s.sub}
                </SvgText>
              </G>
            ))}

            <SvgText
              x={cx}
              y={cy - rMid + 4}
              textAnchor="middle"
              fontFamily={fonts.extrabold}
              fontSize={W * 0.034}
              fill={colors.won}
            >
              WINNER
            </SvgText>
            <SvgText
              x={cx}
              y={cy + rMid - 5}
              textAnchor="middle"
              fontFamily={fonts.extrabold}
              fontSize={W * 0.034}
              fill={colors.error}
            >
              ERROR
            </SvgText>

            <Circle cx={cx} cy={cy} r={rIn + 14} fill={colors.surface} stroke={colors.border} />
            <Circle cx={cx} cy={cy} r={rIn} fill={colors.accent} stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
            <SvgText
              x={cx}
              y={cy + 6}
              textAnchor="middle"
              fontFamily={fonts.black}
              fontSize={W * 0.075}
              fill="#04111e"
            >
              {(playerName || '?').charAt(0).toUpperCase()}
            </SvgText>
          </Svg>

          {/* Tap targets: invisible Pressables overlaid where each segment lives */}
          {winnerSegs.map((s) => (
            <SegmentTap
              key={`tap-w-${s.id}`}
              cx={cx}
              cy={cy}
              rOut={rOut}
              rIn={rMid}
              a1={s.a1}
              a2={s.a2}
              size={W}
              onPress={() => onPick({ result: 'won', shot: s.id })}
            />
          ))}
          {errorSegs.map((s) => (
            <SegmentTap
              key={`tap-e-${s.id}`}
              cx={cx}
              cy={cy}
              rOut={rOut}
              rIn={rMid}
              a1={s.a1}
              a2={s.a2}
              size={W}
              onPress={() => onPick({ result: 'lost', error: s.id })}
            />
          ))}
        </Animated.View>

        <View style={styles.label}>
          <PlayerLabel name={playerName} sub={playerPosLabel} />
        </View>
      </Pressable>
    </Pressable>
  );
}

interface SegmentTapProps {
  cx: number;
  cy: number;
  rOut: number;
  rIn: number;
  a1: number;
  a2: number;
  size: number;
  onPress: () => void;
}

function SegmentTap({ cx, cy, rOut, rIn, a1, a2, size, onPress }: SegmentTapProps) {
  // Tap at the centroid of the arc segment, with a circular hitslop.
  const midA = (a1 + a2) / 2;
  const midR = (rOut + rIn) / 2;
  const [x, y] = polar(cx, cy, midR, midA);
  const tapSize = Math.max(36, (rOut - rIn) * 0.85);
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={{
        position: 'absolute',
        left: x - tapSize / 2,
        top: y - tapSize / 2,
        width: tapSize,
        height: tapSize,
        borderRadius: tapSize / 2,
      }}
    />
  );
}

function PlayerLabel({ name, sub }: { name: string; sub: string }) {
  return (
    <View style={styles.playerLabel}>
      <Text style={styles.playerName}>{(name || '').toUpperCase()}</Text>
      <Text style={styles.playerSub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  label: {
    alignItems: 'center',
    marginTop: 6,
  },
  playerLabel: { alignItems: 'center' },
  playerName: {
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 1.2,
  },
  playerSub: {
    color: colors.ink3,
    fontFamily: fonts.medium,
    fontSize: 10,
    letterSpacing: 1.6,
    marginTop: 2,
  },
});
