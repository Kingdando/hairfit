import { Ionicons } from '@expo/vector-icons';
import { type ComponentRef, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const colors = {
  rose: '#4A765A',
  roseDark: '#355C45',
  blush: '#EDF5EE',
  pale: '#FFFFFF',
  ink: '#29332D',
  muted: '#4A765A',
  white: '#FFFFFF',
};

const slides = [
  { icon: 'scan-outline', title: 'Scan your face', copy: 'A guided selfie helps our AI understand your unique face shape.' },
  { icon: 'sparkles-outline', title: 'Get AI hairstyle matches', copy: 'Discover ranked styles tailored to your shape, texture, and preferences.' },
  { icon: 'calendar-outline', title: 'Book a salon near you', copy: 'Choose a trusted stylist and reserve your transformation in minutes.' },
] as const;

type OnboardingScreenProps = {
  onGetStarted: () => void;
  onLogin: () => void;
  onGuest: () => void;
};

export function OnboardingScreen({ onGetStarted, onLogin, onGuest }: OnboardingScreenProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const pager = useRef<ComponentRef<typeof ScrollView>>(null);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth !== pageWidth) {
      setPageWidth(nextWidth);
      pager.current?.scrollTo({ x: activeSlide * nextWidth, animated: false });
    }
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageWidth) return;
    setActiveSlide(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
  };

  const continueFlow = (index: number) => {
    if (index === slides.length - 1) {
      onGetStarted();
      return;
    }
    pager.current?.scrollTo({ x: (index + 1) * pageWidth, animated: true });
  };

  return (
    <View onLayout={handleLayout} style={styles.container}>
      <Pressable accessibilityRole="button" onPress={onLogin} style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
        <Text style={styles.link}>Skip</Text>
      </Pressable>
      <ScrollView
        ref={pager}
        alwaysBounceHorizontal={false}
        bounces={false}
        decelerationRate="fast"
        directionalLockEnabled
        horizontal
        onMomentumScrollEnd={handleScrollEnd}
        pagingEnabled
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={styles.pager}>
        {slides.map((slide, index) => (
          <View key={slide.title} style={[styles.page, { width: pageWidth || 1 }]}>
            <View style={styles.brand}>
              <View style={styles.brandMark}>
                <Ionicons name="cut-outline" size={17} color={colors.white} />
              </View>
              <Text style={styles.brandName}>FACEFIT</Text>
            </View>
            <View style={styles.artArea}>
              <View style={styles.artCircle}>
                <Ionicons name={slide.icon} size={90} color={colors.rose} />
              </View>
              {index === 1 && <View style={styles.matchBadge}><Text style={styles.matchText}>96% match</Text></View>}
            </View>
            <View>
              <View style={styles.dots}>
                {slides.map((item, dotIndex) => <View key={item.title} style={[styles.dot, dotIndex === activeSlide && styles.dotActive]} />)}
              </View>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.body}>{slide.copy}</Text>
              <Pressable accessibilityRole="button" onPress={() => continueFlow(index)} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
                <Text style={styles.buttonText}>{index === slides.length - 1 ? 'Get started' : 'Continue'}</Text>
                <Ionicons name="arrow-forward" size={19} color={colors.white} />
              </Pressable>
              <Pressable accessibilityRole="button" onPress={onLogin} style={({ pressed }) => [styles.login, pressed && styles.pressed]}>
                <Text style={styles.loginText}>Already have an account? Log in</Text>
              </Pressable>
              {index === slides.length - 1 && <Pressable accessibilityRole="button" onPress={onGuest} style={({ pressed }) => [styles.login, pressed && styles.pressed]}><Text style={styles.loginText}>Continue as guest · scan once</Text></Pressable>}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pale },
  pager: { flex: 1 },
  page: { flex: 1, paddingHorizontal: 26, paddingTop: 58, paddingBottom: 28, justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  brandMark: { width: 30, height: 30, borderRadius: 10, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center' },
  brandName: { color: colors.roseDark, fontSize: 12, fontWeight: '900', letterSpacing: 1.6 },
  skip: { position: 'absolute', zIndex: 2, top: 10, right: 14, minWidth: 60, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  link: { color: colors.rose, fontSize: 14, fontWeight: '700' },
  artArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  artCircle: { width: 268, height: 268, borderRadius: 134, backgroundColor: colors.blush, borderWidth: 1, borderColor: '#E2E9E2', alignItems: 'center', justifyContent: 'center' },
  matchBadge: { position: 'absolute', right: 25, bottom: '30%', paddingHorizontal: 15, paddingVertical: 12, borderRadius: 15, backgroundColor: colors.white, boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 16, color: "rgba(53, 92, 69, 0.12)" }], elevation: 4 },
  matchText: { color: colors.rose, fontSize: 12, fontWeight: '800' },
  dots: { height: 12, flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 20 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E2E9E2' },
  dotActive: { width: 26, backgroundColor: colors.rose },
  title: { color: colors.ink, fontSize: 40, lineHeight: 47, letterSpacing: -0.7, fontWeight: '800', marginBottom: 12 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 24, marginBottom: 22 },
  button: { minHeight: 56, borderRadius: 18, paddingHorizontal: 18, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.rose },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  login: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  loginText: { color: colors.roseDark, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
