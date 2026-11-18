import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { getApiAssetUrl, type AuthUser, type Salon } from '@/services/api';

type Props = {
  user: AuthUser | null;
  salons: Salon[];
  favoriteSalonIds: number[];
  savingFavoriteSalonIds: number[];
  unreadNotifications: number;
  loadingSalons: boolean;
  salonsError: string | null;
  loadingLocation: boolean;
  onNotifications: () => void;
  onScan: () => void;
  onMap: () => void;
  onReloadSalons: () => void;
  onOpenSalon: (salon: Salon) => void;
  onToggleFavorite: (salonId: number) => void;
};

const colors = { rose: '#4A765A', roseDark: '#355C45', blush: '#EDF5EE', ink: '#29332D', muted: '#66736B', line: '#E2E9E2', white: '#FFFFFF', gold: '#6F946E' };

export function CustomerDashboardScreen({ user, salons, favoriteSalonIds, savingFavoriteSalonIds, unreadNotifications, loadingSalons, salonsError, loadingLocation, onNotifications, onScan, onMap, onReloadSalons, onOpenSalon, onToggleFavorite }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 480;
  const wide = width >= 1100;
  return <>
    <View style={styles.topRow}>
      <View style={styles.grow}><Text numberOfLines={1} style={[styles.greeting, compact && styles.greetingCompact]}>Hello, {user?.fullName.split(' ')[0] || 'there'}</Text><Text style={styles.body}>Ready for a fresh look?</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${unreadNotifications} unread notifications`} onPress={onNotifications} style={styles.avatar}>
        <Ionicons name="notifications-outline" size={21} color={colors.roseDark} />
        {unreadNotifications > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadNotifications > 99 ? '99+' : unreadNotifications}</Text></View>}
      </Pressable>
    </View>

    <View style={[styles.hero, compact && styles.heroCompact, wide && styles.heroWide]}>
      <View style={styles.grow}><Text style={styles.heroKicker}>AI FACE ANALYSIS</Text><Text style={[styles.heroTitle, compact && styles.heroTitleCompact, wide && styles.heroTitleWide]}>Find the cut that fits you.</Text><Pressable accessibilityRole="button" onPress={onScan} style={styles.heroButton}><Text style={styles.heroButtonText}>Scan your face</Text><Ionicons name="arrow-forward" size={18} color={colors.roseDark} /></Pressable></View>
      <View style={styles.faceMini}><Ionicons name="scan" size={53} color={colors.rose} /></View>
    </View>

    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>Salons near you</Text>
      <Pressable accessibilityRole="button" disabled={loadingLocation} onPress={onMap} style={styles.mapAction}>{loadingLocation ? <ActivityIndicator size="small" color={colors.rose} /> : <><Text style={styles.link}>View map</Text><Ionicons name="map-outline" size={17} color={colors.rose} /></>}</Pressable>
    </View>

    {loadingSalons ? <ActivityIndicator color={colors.rose} style={styles.dataLoader} />
      : salonsError ? <Pressable onPress={onReloadSalons} style={styles.dataState}><Ionicons name="cloud-offline-outline" size={25} color={colors.rose} /><Text style={styles.cardTitle}>Could not load salons</Text><Text style={styles.small}>{salonsError} · Tap to retry</Text></Pressable>
      : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.salonRow}>{salons.slice(0, 6).map((salon, index) => {
        const favorite = favoriteSalonIds.includes(salon.id);
        const busy = savingFavoriteSalonIds.includes(salon.id);
        return <Pressable key={salon.id} onPress={() => onOpenSalon(salon)} style={[styles.salonCard, wide && styles.salonCardWide]}>
          <View style={[styles.salonThumb, { backgroundColor: index % 2 ? '#EDF5EE' : '#F4F7F2' }]}>
            {salon.profileImageUrl ? <Image accessibilityLabel={`${salon.name} profile picture`} source={{ uri: getApiAssetUrl(salon.profileImageUrl)! }} style={styles.salonImage} /> : <Ionicons name="cut-outline" size={28} color={colors.rose} />}
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: favorite, busy }} accessibilityLabel={`${favorite ? 'Remove' : 'Add'} ${salon.name} ${favorite ? 'from' : 'to'} favorites`} hitSlop={8} disabled={busy} onPress={event => { event.stopPropagation(); onToggleFavorite(salon.id); }} style={({ pressed }) => [styles.favorite, favorite && styles.favoriteActive, pressed && styles.pressed]}>{busy ? <ActivityIndicator size="small" color={colors.rose} /> : <Ionicons name={favorite ? 'heart' : 'heart-outline'} size={20} color={colors.rose} />}</Pressable>
          </View>
          <Text numberOfLines={1} style={styles.cardTitle}>{salon.name}</Text><Text numberOfLines={2} style={styles.small}>{salon.address}</Text>
        </Pressable>;
      })}</ScrollView>}

    <View style={styles.tip}><Ionicons name="sparkles" size={22} color={colors.gold} /><View style={styles.grow}><Text style={styles.cardTitle}>Stylist tip</Text><Text style={styles.small}>Soft layers are trending—and perfect for oval faces.</Text></View></View>
  </>;
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 },
  greeting: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5, color: colors.ink, marginBottom: 4 },
  greetingCompact: { fontSize: 23 },
  body: { fontSize: 15, lineHeight: 23, color: colors.muted, marginBottom: 20 },
  avatar: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: -5, top: -5, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#4A765A', borderWidth: 2, borderColor: colors.white, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 9, fontWeight: '900', color: colors.white },
  hero: { minHeight: 226, borderRadius: 28, backgroundColor: colors.roseDark, padding: 24, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', marginBottom: 30, boxShadow: [{ offsetX: 0, offsetY: 7, blurRadius: 18, color: "rgba(53, 92, 69, 0.14)" }], elevation: 4 },
  heroCompact: { minHeight: 198, padding: 18, borderRadius: 23 },
  heroWide: { minHeight: 260, padding: 32 },
  heroKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, color: colors.roseDark, marginBottom: 10 },
  heroTitle: { fontSize: 29, lineHeight: 35, fontWeight: '800', letterSpacing: -0.6, color: colors.ink, maxWidth: 220 },
  heroTitleCompact: { maxWidth: 190, fontSize: 25, lineHeight: 31 },
  heroTitleWide: { maxWidth: 420, fontSize: 36, lineHeight: 42 },
  heroButton: { marginTop: 22, alignSelf: 'flex-start', height: 46, borderRadius: 16, backgroundColor: colors.white, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 9 },
  heroButtonText: { fontSize: 13, fontWeight: '800', color: colors.roseDark },
  faceMini: { position: 'absolute', right: -20, bottom: -20, width: 140, height: 180, borderWidth: 2, borderColor: '#6F946E', borderRadius: 75, alignItems: 'center', justifyContent: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.ink, marginVertical: 15 },
  mapAction: { minWidth: 84, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  link: { color: colors.rose, fontSize: 14, fontWeight: '700' },
  dataLoader: { marginVertical: 32 },
  dataState: { padding: 20, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, alignItems: 'center', gap: 5, marginBottom: 16 },
  salonRow: { gap: 13, paddingRight: 10 },
  salonCard: { width: 164, padding: 11, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, boxShadow: [{ offsetX: 0, offsetY: 5, blurRadius: 12, color: "rgba(53, 92, 69, 0.04)" }], elevation: 2 },
  salonCardWide: { width: 220, padding: 14 },
  salonThumb: { height: 96, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 10, overflow: 'hidden' },
  salonImage: { width: '100%', height: '100%', },
  favorite: { position: 'absolute', right: 7, top: 7, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  favoriteActive: { backgroundColor: colors.blush, borderWidth: 1, borderColor: '#EDF5EE' },
  pressed: { opacity: 0.75 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: 3 },
  small: { fontSize: 12, lineHeight: 18, color: colors.muted },
  tip: { marginTop: 25, padding: 18, borderRadius: 20, backgroundColor: '#EDF5EE', flexDirection: 'row', gap: 12 },
});
