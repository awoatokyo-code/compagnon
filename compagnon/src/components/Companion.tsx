import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const IMG = {
  tail: require('../../assets/axo/tail.webp'),
  gillL: require('../../assets/axo/gillL.webp'),
  gillR: require('../../assets/axo/gillR.webp'),
  body: require('../../assets/axo/body.webp'),
  mouth: require('../../assets/axo/mouth.webp'),
  lidA: require('../../assets/axo/lidA.webp'),
  lidB: require('../../assets/axo/lidB.webp'),
};

const RATIO = 790 / 742;

type Props = {
  width: number;
  talking?: boolean; // bouche qui bouge
  thinking?: boolean; // l'IA réfléchit : branchies plus vives
  happy?: boolean; // yeux fermés de joie (^^)
  hopKey?: number; // change la valeur => il saute
};

function useSway(from: number, to: number, ms: number, reverse = false) {
  const v = useSharedValue(reverse ? to : from);
  useEffect(() => {
    v.value = reverse ? to : from;
    v.value = withRepeat(
      withTiming(reverse ? from : to, { duration: ms, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(v);
  }, [ms]);
  return v;
}

export default function Companion({ width, talking, thinking, happy, hopKey = 0 }: Props) {
  const height = width * RATIO;

  const breath = useSway(0, -height * 0.012, 1600);
  const tail = useSway(-4, 6, 2800);
  const gillMs = thinking ? 900 : 2600;
  const gillL = useSway(-2.5, 3, gillMs);
  const gillR = useSway(-2.5, 3, gillMs, true);

  const blink = useSharedValue(0);
  useEffect(() => {
    blink.value = withRepeat(
      withSequence(
        withDelay(3800, withTiming(1, { duration: 70 })),
        withTiming(1, { duration: 110 }),
        withTiming(0, { duration: 70 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(blink);
  }, []);

  const joy = useSharedValue(0);
  useEffect(() => {
    joy.value = happy ? 1 : 0;
  }, [happy]);

  const mouth = useSharedValue(1);
  useEffect(() => {
    if (talking) {
      mouth.value = withRepeat(
        withSequence(withTiming(0.38, { duration: 170 }), withTiming(1, { duration: 170 })),
        -1,
        false,
      );
    } else {
      cancelAnimation(mouth);
      mouth.value = withTiming(1, { duration: 120 });
    }
  }, [talking]);

  // Saut : uniquement un déplacement vertical, aucune déformation
  const hop = useSharedValue(0);
  useEffect(() => {
    if (!hopKey) return;
    hop.value = withSequence(
      withTiming(height * 0.02, { duration: 130 }),
      withTiming(-height * 0.3, { duration: 250, easing: Easing.out(Easing.quad) }),
      withTiming(height * 0.015, { duration: 230, easing: Easing.in(Easing.quad) }),
      withTiming(0, { duration: 140 }),
    );
  }, [hopKey]);

  const hopStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hop.value }] }));
  const breathStyle = useAnimatedStyle(() => ({ transform: [{ translateY: breath.value }] }));
  const tailStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${tail.value}deg` }] }));
  const gillLStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${gillL.value}deg` }] }));
  const gillRStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${gillR.value}deg` }] }));
  const mouthStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: mouth.value }] }));
  const lidStyle = useAnimatedStyle(() => ({ opacity: Math.max(blink.value, joy.value) }));

  return (
    <Animated.View style={[{ width, height }, hopStyle]}>
      <Animated.View style={[StyleSheet.absoluteFill, breathStyle]}>
        <Animated.Image source={IMG.tail} style={[s.layer, { transformOrigin: '34% 82%' }, tailStyle]} />
        <Animated.Image source={IMG.gillL} style={[s.layer, { transformOrigin: '26% 33%' }, gillLStyle]} />
        <Animated.Image source={IMG.gillR} style={[s.layer, { transformOrigin: '81% 38%' }, gillRStyle]} />
        <Animated.Image source={IMG.body} style={s.layer} />
        <Animated.Image source={IMG.mouth} style={[s.layer, { transformOrigin: '52.4% 43.7%' }, mouthStyle]} />
        <Animated.Image source={IMG.lidA} style={[s.layer, lidStyle]} />
        <Animated.Image source={IMG.lidB} style={[s.layer, lidStyle]} />
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  layer: { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', resizeMode: 'contain' },
});
