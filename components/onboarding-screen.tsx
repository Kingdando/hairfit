import { Ionicons } from '@expo/vector-icons';
import { type ComponentRef, useRef, useState } from 'react';
import {
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
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
  const { width } = useWindowDimensions();
  const siteScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [featuresY, setFeaturesY] = useState(0);

  if (Platform.OS === 'web') {
    const isWide = width >= 900;
    return (
      <ScrollView ref={siteScroll} style={styles.site} contentContainerStyle={styles.siteContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.siteHeader, { paddingHorizontal: isWide ? 64 : 24 }]}>
          <View style={styles.siteBrand}>
            <View style={styles.siteBrandMark}><Ionicons name="cut-outline" size={19} color={colors.white} /></View>
            <Text style={styles.siteBrandName}>hAIrfit</Text>
          </View>
          <View style={styles.siteNav}>
            {isWide && <Pressable onPress={() => siteScroll.current?.scrollTo({ y: featuresY, animated: true })} style={styles.siteNavLink}><Text style={styles.siteNavText}>How it works</Text></Pressable>}
            <Pressable accessibilityRole="button" onPress={onLogin} style={styles.siteNavLink}><Text style={styles.siteNavText}>Log in</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={onGetStarted} style={styles.siteNavButton}><Text style={styles.siteNavButtonText}>Get started</Text><Ionicons name="arrow-forward" size={16} color={colors.white} /></Pressable>
          </View>
        </View>

        <View style={[styles.siteHero, { paddingHorizontal: isWide ? 64 : 24, flexDirection: isWide ? 'row' : 'column' }]}>
          <View style={[styles.siteHeroCopy, { width: isWide ? '47%' : '100%', alignItems: isWide ? 'flex-start' : 'center' }]}>
            <View style={styles.siteEyebrow}><Ionicons name="sparkles" size={14} color={colors.rose} /><Text style={styles.siteEyebrowText}>YOUR NEXT LOOK STARTS HERE</Text></View>
            <Text style={[styles.siteTitle, { textAlign: isWide ? 'left' : 'center', fontSize: isWide ? 66 : 48, lineHeight: isWide ? 72 : 55 }]}>A hairstyle that feels like <Text style={styles.siteTitleAccent}>you.</Text></Text>
            <Text style={[styles.siteDescription, { textAlign: isWide ? 'left' : 'center' }]}>Find styles that suit your face, discover your next salon, and feel good about your next look.</Text>
            <View style={[styles.siteActions, { justifyContent: isWide ? 'flex-start' : 'center' }]}>
              <Pressable accessibilityRole="button" onPress={onGetStarted} style={({ pressed }) => [styles.sitePrimaryButton, pressed && styles.pressed]}><Text style={styles.sitePrimaryText}>Find your look</Text><Ionicons name="arrow-forward" size={18} color={colors.white} /></Pressable>
              <Pressable accessibilityRole="button" onPress={onGuest} style={({ pressed }) => [styles.siteSecondaryButton, pressed && styles.pressed]}><Text style={styles.siteSecondaryText}>Try a free scan</Text></Pressable>
            </View>
            <View style={styles.siteTrust}><View style={styles.siteTrustAvatars}><View style={[styles.siteAvatar, { backgroundColor: '#E7C9B9' }]} /><View style={[styles.siteAvatar, { backgroundColor: '#CDA99A' }]} /><View style={[styles.siteAvatar, { backgroundColor: '#B8C9B4' }]} /></View><Text style={styles.siteTrustText}>A little more you, every day.</Text></View>
          </View>
          <View style={[styles.siteVisual, { width: isWide ? '47%' : '100%', marginTop: isWide ? 0 : 42 }]}>
            <View style={styles.siteImageFrame}><Image source={require('../assets/images/facefit-styles.png')} style={styles.siteImage} resizeMode="cover" /></View>
            <View style={[styles.siteFloatCard, styles.siteFloatTop]}><View style={styles.siteFloatIcon}><Ionicons name="scan-outline" size={18} color={colors.rose} /></View><View><Text style={styles.siteFloatTitle}>Made for your features</Text><Text style={styles.siteFloatCaption}>Personalized style ideas</Text></View></View>
            <View style={[styles.siteFloatCard, styles.siteFloatBottom]}><Ionicons name="sparkles" size={16} color="#A87939" /><Text style={styles.siteMatchText}>Your next favorite look</Text></View>
            <View style={styles.siteDecorCircle} />
          </View>
        </View>

        <View onLayout={(event) => setFeaturesY(event.nativeEvent.layout.y)} style={[styles.siteFeatures, { paddingHorizontal: isWide ? 64 : 24 }]}>
          <Text style={styles.siteSectionEyebrow}>THE hAIrfit EXPERIENCE</Text>
          <Text style={styles.siteSectionTitle}>Good hair days, made personal.</Text>
          <View style={[styles.siteFeatureRow, { flexDirection: isWide ? 'row' : 'column' }]}>
            {slides.map((slide, index) => <View key={slide.title} style={styles.siteFeatureCard}><View style={styles.siteFeatureIcon}><Ionicons name={slide.icon} size={22} color={colors.rose} /></View><Text style={styles.siteFeatureNumber}>0{index + 1}</Text><Text style={styles.siteFeatureTitle}>{slide.title}</Text><Text style={styles.siteFeatureCopy}>{slide.copy}</Text></View>)}
          </View>
        </View>

        <View style={[styles.siteFooter, { paddingHorizontal: isWide ? 64 : 24 }]}><View style={styles.siteFooterInner}><View><Text style={styles.siteFooterTitle}>Ready for a fresh start?</Text><Text style={styles.siteFooterCopy}>Your next look is closer than you think.</Text></View><Pressable accessibilityRole="button" onPress={onGetStarted} style={styles.sitePrimaryButton}><Text style={styles.sitePrimaryText}>Get started</Text><Ionicons name="arrow-forward" size={18} color={colors.white} /></Pressable></View><Text style={styles.siteCopyright}>© hAIrfit · Beauty, with a plan.</Text></View>
      </ScrollView>
    );
  }

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
              <Text style={styles.brandName}>hAIrfit</Text>
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
  site: { flex: 1, backgroundColor: '#FAFBF8' },
  siteContent: { paddingBottom: 0 },
  siteHeader: { width: '100%', maxWidth: 1440, alignSelf: 'center', minHeight: 94, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  siteBrand: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  siteBrandMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.rose, alignItems: 'center', justifyContent: 'center' },
  siteBrandName: { color: colors.roseDark, fontSize: 16, fontWeight: '900', letterSpacing: 2.2 },
  siteNav: { flexDirection: 'row', alignItems: 'center', gap: 25 },
  siteNavLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  siteNavText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  siteNavButton: { minHeight: 46, borderRadius: 15, backgroundColor: colors.rose, paddingHorizontal: 19, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  siteNavButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  siteHero: { width: '100%', maxWidth: 1440, minHeight: 620, alignSelf: 'center', alignItems: 'center', paddingTop: 52, paddingBottom: 76, gap: 38 },
  siteHeroCopy: { maxWidth: 610, justifyContent: 'center' },
  siteEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 21, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, backgroundColor: '#EDF5EE' },
  siteEyebrowText: { color: colors.roseDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  siteTitle: { maxWidth: 600, color: colors.ink, fontWeight: '900', letterSpacing: -2.2 },
  siteTitleAccent: { color: colors.rose },
  siteDescription: { maxWidth: 490, color: '#627067', fontSize: 17, lineHeight: 28, marginTop: 20 },
  siteActions: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginTop: 28 },
  sitePrimaryButton: { minHeight: 54, borderRadius: 16, backgroundColor: colors.rose, paddingHorizontal: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11 },
  sitePrimaryText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  siteSecondaryButton: { minHeight: 54, borderRadius: 16, borderWidth: 1, borderColor: '#DCE6DC', backgroundColor: '#FFFFFF', paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  siteSecondaryText: { color: colors.roseDark, fontSize: 14, fontWeight: '800' },
  siteTrust: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 32 },
  siteTrustAvatars: { flexDirection: 'row', paddingLeft: 2 },
  siteAvatar: { width: 29, height: 29, borderRadius: 15, borderWidth: 2, borderColor: '#FAFBF8', marginLeft: -3 },
  siteTrustText: { color: '#66736B', fontSize: 12, fontWeight: '600' },
  siteVisual: { maxWidth: 590, height: 480, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  siteImageFrame: { width: '88%', height: '88%', borderRadius: 34, overflow: 'hidden', backgroundColor: '#E8EEE5', transform: [{ rotate: '2deg' }], boxShadow: [{ offsetX: 0, offsetY: 22, blurRadius: 54, color: 'rgba(41, 51, 45, 0.15)' }] },
  siteImage: { width: '100%', height: '100%' },
  siteFloatCard: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, paddingVertical: 13, borderRadius: 18, backgroundColor: '#FFFFFF', boxShadow: [{ offsetX: 0, offsetY: 8, blurRadius: 24, color: 'rgba(41, 51, 45, 0.13)' }] },
  siteFloatTop: { top: 55, left: -2 },
  siteFloatBottom: { right: -2, bottom: 47 },
  siteFloatIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: '#EDF5EE', alignItems: 'center', justifyContent: 'center' },
  siteFloatTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  siteFloatCaption: { color: '#778278', fontSize: 10, marginTop: 3 },
  siteMatchText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  siteDecorCircle: { position: 'absolute', zIndex: -1, width: 250, height: 250, borderRadius: 125, right: -50, top: 35, backgroundColor: '#EDF5EE' },
  siteFeatures: { width: '100%', paddingTop: 80, paddingBottom: 90, backgroundColor: '#FFFFFF', alignItems: 'center' },
  siteSectionEyebrow: { color: colors.rose, fontSize: 10, fontWeight: '900', letterSpacing: 1.7, textAlign: 'center' },
  siteSectionTitle: { color: colors.ink, fontSize: 32, lineHeight: 39, fontWeight: '900', letterSpacing: -0.8, textAlign: 'center', marginTop: 12, marginBottom: 35 },
  siteFeatureRow: { width: '100%', maxWidth: 1280, gap: 16 },
  siteFeatureCard: { flex: 1, minWidth: 240, minHeight: 226, padding: 24, borderRadius: 23, borderWidth: 1, borderColor: '#E7ECE6', backgroundColor: '#FAFBF8' },
  siteFeatureIcon: { width: 49, height: 49, borderRadius: 17, backgroundColor: '#EDF5EE', alignItems: 'center', justifyContent: 'center', marginBottom: 17 },
  siteFeatureNumber: { position: 'absolute', top: 28, right: 24, color: '#A9B8AA', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  siteFeatureTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginBottom: 9 },
  siteFeatureCopy: { color: '#6B776E', fontSize: 13, lineHeight: 21 },
  siteFooter: { width: '100%', maxWidth: 1440, alignSelf: 'center', paddingTop: 57, paddingBottom: 24 },
  siteFooterInner: { minHeight: 160, borderRadius: 27, backgroundColor: '#EDF5EE', paddingHorizontal: 32, paddingVertical: 27, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  siteFooterTitle: { color: colors.ink, fontSize: 25, fontWeight: '900', letterSpacing: -0.5 },
  siteFooterCopy: { color: '#69766D', fontSize: 14, marginTop: 7 },
  siteCopyright: { color: '#89938B', fontSize: 11, textAlign: 'center', marginTop: 24 },
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
