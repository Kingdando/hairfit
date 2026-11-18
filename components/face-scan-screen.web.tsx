import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type FaceScanScreenProps = {
  onBack: () => void;
  onCaptured: (photo: { uri: string; imageData: string }) => void;
};

type TrackingState = 'loading' | 'searching' | 'locked' | 'error';

export function FaceScanScreen({ onBack, onCaptured }: FaceScanScreenProps) {
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [tracking, setTracking] = useState<TrackingState>('loading');
  const [capturing, setCapturing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [cameraAspectRatio, setCameraAspectRatio] = useState(4 / 3);
  const compactLayout = viewportWidth < 520 || viewportHeight < 620;
  const controlsHeight = compactLayout ? 76 : 88;
  const previewMaxHeight = Math.max(
    220,
    Math.min(380, viewportHeight - (compactLayout ? 120 : 160), viewportWidth * 1.25),
  );
  const scannerHeight = Math.min(440, viewportHeight, (compactLayout ? 54 : 60) + previewMaxHeight);
  const cameraFrameHeight = Math.min(380, previewMaxHeight);
  const previewWidth = Math.max(
    0,
    Math.min(960, viewportWidth - 32, cameraFrameHeight * cameraAspectRatio),
  );
  const guideWidth = Math.min(190, viewportWidth * 0.48);
  const guideHeight = Math.min(250, viewportHeight * 0.36, viewportWidth * 0.65);
  const showDecorations = viewportWidth >= 1250;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.onloadedmetadata = null;
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    async function start() {
      stopCamera();
      setTracking('loading');
      setErrorText('');
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser does not support camera access.');
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: { ideal: 16 / 9 },
          },
        });
        if (disposed) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.onloadedmetadata = () => {
          if (video.videoWidth > 0 && video.videoHeight > 0) {
            setCameraAspectRatio(video.videoWidth / video.videoHeight);
          }
        };
        video.srcObject = stream;
        await video.play();
        if (disposed) return;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          setCameraAspectRatio(video.videoWidth / video.videoHeight);
        }
        setTracking('locked');
      } catch (error) {
        if (disposed) return;
        stopCamera();
        setTracking('error');
        setErrorText(error instanceof Error ? error.message : 'Camera could not start.');
      }
    }
    void start();
    return () => {
      disposed = true;
      stopCamera();
    };
  }, [facing, stopCamera]);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || capturing || tracking !== 'locked') return;
    setCapturing(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable.');
      if (facing === 'user') {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
      }
      context.drawImage(video, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.82);
      onCaptured({ uri: imageData, imageData });
    } finally {
      setCapturing(false);
    }
  };

  const pickImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const imageData = String(reader.result);
        onCaptured({ uri: imageData, imageData });
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const mirrorStyle = facing === 'user' ? ({ transform: 'scaleX(-1)' } as const) : undefined;
  const statusText = tracking === 'loading' ? 'Starting camera' : tracking === 'locked' ? 'Camera ready' : tracking === 'error' ? 'Camera unavailable' : 'Center your face';

  return (
    <View style={styles.page}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.backgroundWaveTop} />
        <View style={styles.backgroundWaveBottom} />
        <View style={styles.backgroundAccent} />
      </View>
      <ScrollView
        style={styles.pageScroll}
        contentContainerStyle={[styles.pageContent, viewportWidth < 640 && styles.pageContentCompact]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeading}>
          <Text style={styles.headingEyebrow}>PERSONALIZED STYLE DISCOVERY</Text>
          <Text style={styles.pageTitle}>Face Shape Analysis</Text>
          <View style={styles.headingAccent} />
          <Text style={styles.pageDescription}>
            Discover hairstyles that complement your facial features through AI-powered analysis.
          </Text>
        </View>

        <View style={[styles.scannerStage, { minHeight: scannerHeight }]}>
          {showDecorations && (
            <View pointerEvents="none" accessible={false} style={styles.sideDecor}>
              <View style={styles.decorLeafBadge}><Ionicons name="leaf-outline" size={35} color="#6F9F7D" /></View>
              <View style={styles.decorCurve} />
              <View style={styles.decorScissorsBadge}><Ionicons name="cut-outline" size={29} color="#6F9F7D" /></View>
              <Ionicons name="sparkles-outline" size={22} color="#6F9F7D" style={styles.decorSparkle} />
            </View>
          )}
          <View style={[styles.shell, { width: previewWidth, maxWidth: previewWidth, maxHeight: scannerHeight, height: scannerHeight }]}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={[styles.header, compactLayout && styles.headerCompact]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.headerButton}><Ionicons name="chevron-back" size={23} color="#fff" /></Pressable>
          <View style={styles.headerCopy}><Text style={styles.headerTitle}>Face scan</Text><Text style={styles.headerSubtitle}>Live processing stays in this browser</Text></View>
          <View style={styles.secureIcon}><Ionicons name="shield-checkmark-outline" size={21} color="#fff" /></View>
        </View>

        <View style={[styles.preview, { maxWidth: previewWidth, maxHeight: previewMaxHeight }]}>
          <video ref={videoRef} autoPlay muted playsInline style={{ ...webStyles.media, ...mirrorStyle }} />
          <View style={[styles.guideArea, compactLayout && styles.guideAreaCompact, { paddingBottom: controlsHeight + 12, pointerEvents: "none" }]}>
            <View style={styles.statusPill}>
              {tracking === 'loading' ? <ActivityIndicator size="small" color="#fff" /> : <View style={[styles.statusDot, tracking === 'locked' && styles.statusDotReady, tracking === 'error' && styles.statusDotError]} />}
              <Text style={styles.statusText}>{statusText}</Text>
            </View>
            <View style={[styles.faceGuide, { width: guideWidth, height: guideHeight, borderRadius: guideWidth / 2 }]} />
            <View style={styles.tipPill}><Ionicons name="sunny-outline" size={15} color="#fff" /><Text style={styles.tip}>{errorText || 'Face forward · remove glasses · use even light'}</Text></View>
          </View>

          <View style={[styles.controls, { height: controlsHeight, paddingHorizontal: viewportWidth < 360 ? 10 : 22 }]}>
            <Pressable accessibilityRole="button" onPress={pickImage} style={[styles.toolButton, compactLayout && styles.toolButtonCompact]}><Ionicons name="images-outline" size={compactLayout ? 20 : 23} color="#fff" /><Text style={styles.toolLabel}>Gallery</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Capture face photo" disabled={tracking !== 'locked' || capturing} onPress={takePhoto} style={[styles.shutter, compactLayout && styles.shutterCompact, (tracking !== 'locked' || capturing) && styles.disabled]}><View style={[styles.shutterInner, compactLayout && styles.shutterInnerCompact]}>{capturing && <ActivityIndicator color="#fff" />}</View></Pressable>
            <Pressable accessibilityRole="button" onPress={() => setFacing(current => current === 'user' ? 'environment' : 'user')} style={[styles.toolButton, compactLayout && styles.toolButtonCompact]}><Ionicons name="camera-reverse-outline" size={compactLayout ? 22 : 25} color="#fff" /><Text style={styles.toolLabel}>Flip</Text></Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
        </View>

        <View style={[styles.featureStrip, viewportWidth < 760 && styles.featureStripCompact]}>
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}><Ionicons name="scan-outline" size={19} color="#315E45" /></View>
            <View style={styles.featureCopy}><Text style={styles.featureTitle}>AI Face Analysis</Text><Text style={styles.featureDescription}>Identifies facial features.</Text></View>
          </View>
          {viewportWidth >= 760 && <View style={styles.featureDivider} />}
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}><Ionicons name="cut-outline" size={19} color="#315E45" /></View>
            <View style={styles.featureCopy}><Text style={styles.featureTitle}>Haircut Suggestions</Text><Text style={styles.featureDescription}>Personalized hairstyle recommendations.</Text></View>
          </View>
          {viewportWidth >= 760 && <View style={styles.featureDivider} />}
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}><Ionicons name="shield-checkmark-outline" size={19} color="#315E45" /></View>
            <View style={styles.featureCopy}><Text style={styles.featureTitle}>Your Privacy Matters</Text><Text style={styles.featureDescription}>Your data is handled securely.</Text></View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const webStyles = {
  media: { position: 'absolute', inset: 0, width: '100%', height: '100%', minWidth: '100%', minHeight: '100%', objectFit: 'contain', objectPosition: 'center center', transformOrigin: 'center center', display: 'block' } as const,
};

const styles = StyleSheet.create({
  page: { flex: 1, width: '100%', position: 'relative', overflow: 'hidden', backgroundColor: '#F8FAF7' },
  pageScroll: { flex: 1, zIndex: 1 },
  pageContent: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 22, paddingBottom: 28, gap: 18 },
  pageContentCompact: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20, gap: 14 },
  backgroundWaveTop: { position: 'absolute', top: -250, right: -140, width: 590, height: 590, borderRadius: 295, backgroundColor: '#EAF3EC', opacity: 0.82 },
  backgroundWaveBottom: { position: 'absolute', bottom: -270, left: -220, width: 650, height: 470, borderRadius: 260, backgroundColor: '#EDF5EF', opacity: 0.9, transform: [{ rotate: '-12deg' }] },
  backgroundAccent: { position: 'absolute', top: '37%', left: -270, width: 550, height: 210, borderRadius: 150, backgroundColor: '#F0F6F1', opacity: 0.85, transform: [{ rotate: '18deg' }] },
  pageHeading: { alignItems: 'center', paddingVertical: 4, gap: 7 },
  headingEyebrow: { color: '#6F9F7D', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  pageTitle: { color: '#263B30', fontSize: 29, lineHeight: 36, fontWeight: '800', textAlign: 'center' },
  headingAccent: { width: 48, height: 3, borderRadius: 2, backgroundColor: '#6F9F7D', marginTop: 1 },
  pageDescription: { maxWidth: 560, color: '#607467', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  scannerStage: { width: '100%', maxWidth: 1320, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  sideDecor: { position: 'absolute', right: 28, top: '26%', width: 112, height: 230, alignItems: 'center', justifyContent: 'space-between', opacity: 0.38 },
  decorLeafBadge: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#EAF3EC', alignItems: 'center', justifyContent: 'center' },
  decorCurve: { width: 1, height: 46, backgroundColor: '#6F9F7D', opacity: 0.7 },
  decorScissorsBadge: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#EEF5EF', alignItems: 'center', justifyContent: 'center' },
  decorSparkle: { position: 'absolute', top: 82, right: 1 },
  shell: { flex: 1, width: '100%', maxWidth: 960, maxHeight: 440, alignSelf: 'center', backgroundColor: '#29332D', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(49, 94, 69, 0.12)', boxShadow: [{ offsetX: 0, offsetY: 14, blurRadius: 34, color: 'rgba(38, 59, 48, 0.12)' }] },
  safe: { flex: 1 },
  header: { height: 60, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', backgroundColor: '#355C45' },
  headerCompact: { height: 54, paddingHorizontal: 10 },
  headerButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4A765A' },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  headerSubtitle: { color: '#E2E9E2', fontSize: 11, marginTop: 2 },
  secureIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  preview: { flex: 1, width: '100%', maxWidth: 960, maxHeight: 380, alignSelf: 'center', overflow: 'hidden', backgroundColor: '#29332D' },
  guideArea: { ...StyleSheet.absoluteFill, paddingTop: 20, paddingBottom: 100, alignItems: 'center', justifyContent: 'space-between' },
  guideAreaCompact: { paddingTop: 12 },
  statusPill: { height: 34, paddingHorizontal: 13, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(20,16,18,0.72)' },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6F946E' },
  statusDotReady: { backgroundColor: '#6F946E' },
  statusDotError: { backgroundColor: '#355C45' },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  faceGuide: { width: 190, height: 250, maxHeight: '68%', borderRadius: 95, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(255,255,255,0.025)' },
  tipPill: { minHeight: 34, maxWidth: '92%', paddingHorizontal: 12, borderRadius: 17, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(20,16,18,0.7)' },
  tip: { color: '#fff', fontSize: 11, fontWeight: '700' },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 88, paddingHorizontal: 22, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(20,16,18,0.58)' },
  toolButton: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', gap: 5 },
  toolButtonCompact: { width: 56, height: 62, gap: 2 },
  toolLabel: { color: '#fff', fontSize: 11, fontWeight: '600' },
  shutter: { width: 66, height: 66, borderRadius: 33, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterCompact: { width: 58, height: 58, borderRadius: 29 },
  shutterInner: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4A765A' },
  shutterInnerCompact: { width: 48, height: 48, borderRadius: 24 },
  disabled: { opacity: 0.48 },
  featureStrip: { width: '100%', maxWidth: 1180, alignSelf: 'center', minHeight: 96, paddingHorizontal: 20, paddingVertical: 16, borderRadius: 22, borderWidth: 1, borderColor: '#E4ECE5', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, boxShadow: [{ offsetX: 0, offsetY: 8, blurRadius: 24, color: 'rgba(49, 94, 69, 0.07)' }] },
  featureStripCompact: { alignItems: 'stretch', flexDirection: 'column', gap: 12, paddingHorizontal: 16, paddingVertical: 15 },
  featureItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, minWidth: 0 },
  featureIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#EAF3EC', alignItems: 'center', justifyContent: 'center' },
  featureCopy: { flex: 1, minWidth: 0 },
  featureTitle: { color: '#263B30', fontSize: 12, lineHeight: 17, fontWeight: '800' },
  featureDescription: { color: '#738277', fontSize: 10, lineHeight: 15, marginTop: 2 },
  featureDivider: { width: 1, height: 42, backgroundColor: '#E4ECE5' },
});
