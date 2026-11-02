import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getApiAssetUrl, getRecommendedStylists, type RecommendedStylist } from '@/services/api';
import { rankStylists } from '@/services/stylist-matching';

export function HairstyleStylists({ hairstyle, onSelect }: { hairstyle: string; onSelect: (staff: RecommendedStylist) => void }) {
  const [expanded, setExpanded] = useState(false);
  return <View style={s.container}>
    <Pressable accessibilityRole="button" onPress={() => setExpanded(true)} style={({ pressed }) => [s.toggle, pressed && s.pressed]}>
      <Ionicons name="cut-outline" size={19} color="#355C45"/>
      <Text style={s.toggleText}>View top hairstylist</Text>
      <Ionicons name="open-outline" size={17} color="#355C45"/>
    </Pressable>
    <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
      <SafeAreaView style={s.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close hairstylist popup" style={StyleSheet.absoluteFill} onPress={() => setExpanded(false)}/>
        <View style={s.popup} accessibilityViewIsModal>
          <View style={s.header}>
            <View style={s.identity}><Text style={s.title}>Top hairstylists</Text><Text style={s.copy}>{hairstyle}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close popup" onPress={() => setExpanded(false)} style={s.close}><Ionicons name="close" size={22} color="#355C45"/></Pressable>
          </View>
          <View style={s.popupContent}>
            {expanded && <StylistList hairstyle={hairstyle} onSelect={staff => { setExpanded(false); onSelect(staff); }}/>}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  </View>;
}

function StylistList({ hairstyle, onSelect }: { hairstyle: string; onSelect: (staff: RecommendedStylist) => void }) {
  const [pageWidth, setPageWidth] = useState(0);
  const [page, setPage] = useState(0);
  const carousel = useRef<ComponentRef<typeof ScrollView>>(null);
  const [staff, setStaff] = useState<RecommendedStylist[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    getRecommendedStylists().then(data => { if (active) { setStaff(data); setError(''); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Unable to load hairstylists.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const ranked = rankStylists(staff, hairstyle).slice(0, 5);
  return <View style={s.list}>
    {loading && <ActivityIndicator color="#4A765A"/>}
    {!!error && <Pressable accessibilityRole="button" onPress={() => { setLoading(true); setRetry(v => v + 1); }}><Text style={s.copy}>{error} · Tap to retry</Text></Pressable>}
    {!loading && !error && !ranked.length && <Text style={s.copy}>No available hairstylists yet.</Text>}
    <View style={s.carousel} onLayout={event => setPageWidth(event.nativeEvent.layout.width)}>
    {pageWidth > 0 && <ScrollView ref={carousel} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={event => setPage(Math.max(0, Math.min(ranked.length - 1, Math.round(event.nativeEvent.contentOffset.x / pageWidth))))}>
    {ranked.map((member, index) => {
      const original = staff.find(item => item.id === member.id)!;
      return <ScrollView key={member.id} style={{ width: pageWidth }} contentContainerStyle={s.card}>
        <View style={s.row}>
          {member.imageUrl ? <Image source={{ uri: getApiAssetUrl(member.imageUrl)! }} style={s.avatar}/> : <View style={s.avatar}><Text style={s.initial}>{member.name.charAt(0).toUpperCase()}</Text></View>}
          <View style={s.identity}><Text style={s.name}>{member.name}</Text><Text style={s.copy}>{original.salonName}</Text></View>
          <Text style={s.rank}>#{index + 1}</Text>
        </View>
        <View style={s.haircut}><Ionicons name="cut-outline" size={15} color="#355C45"/><Text style={s.haircutText}>{hairstyle}</Text></View>
        <Text style={s.book}>{member.hairstyleMatch ? 'Specialty match' : 'Consultation available'}</Text>
        <Text style={s.description}>{original.description || 'Discuss your preferred length, shape and finish with this stylist before your appointment.'}</Text>
        <Text style={s.copy}>Choose this stylist to continue to date and time. Availability is checked for your selected appointment.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${member.name} for ${hairstyle}`} style={s.select} onPress={() => onSelect(original)}><Text style={s.selectText}>Choose {member.name}</Text><Ionicons name="arrow-forward" size={18} color="#FFFFFF"/></Pressable>
      </ScrollView>;
    })}
    </ScrollView>}
    </View>
    {!!ranked.length && <View style={s.navigation}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous stylist" disabled={page === 0} style={[s.close, page === 0 && s.pressed]} onPress={() => { const next = page - 1; setPage(next); carousel.current?.scrollTo({ x: next * pageWidth, animated: true }); }}><Ionicons name="chevron-back" size={20} color="#355C45"/></Pressable>
      <View style={s.identity}><Text style={s.counter}>{page + 1} of {ranked.length}</Text><Text style={[s.copy, s.center]}>Swipe to explore stylists</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Next stylist" disabled={page === ranked.length - 1} style={[s.close, page === ranked.length - 1 && s.pressed]} onPress={() => { const next = page + 1; setPage(next); carousel.current?.scrollTo({ x: next * pageWidth, animated: true }); }}><Ionicons name="chevron-forward" size={20} color="#355C45"/></Pressable>
    </View>}
  </View>;
}
const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,30,24,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  popup: { width: '100%', maxWidth: 540, height: '80%', maxHeight: 650, backgroundColor: '#FAFBF8', borderRadius: 24, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderBottomWidth: 1, borderBottomColor: '#E2E9E2' },
  title: { fontSize: 21, fontWeight: '800', color: '#29332D', marginBottom: 4 },
  close: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EDF5EE', alignItems: 'center', justifyContent: 'center' },
  popupContent: { flex: 1, paddingHorizontal: 18, paddingBottom: 16 },
  container: { marginTop: 16 }, list: { flex: 1, gap: 10, paddingTop: 12 },
  carousel: { flex: 1 }, navigation: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8 }, center: { textAlign: 'center' }, counter: { textAlign: 'center', color: '#355C45', fontWeight: '800', fontSize: 13 },
  description: { color: '#66736B', fontSize: 14, lineHeight: 23 }, select: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#355C45', borderRadius: 14, padding: 12 }, selectText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  toggle: { minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EDF5EE', borderWidth: 1, borderColor: '#E2E9E2', borderRadius: 14 },
  toggleText: { flex: 1, color: '#355C45', fontSize: 13, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 }, identity: { flex: 1 },
  copy: { fontSize: 11, lineHeight: 17, color: '#66736B' },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E9E2', borderRadius: 16, padding: 14, gap: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EDF5EE', alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '800', color: '#355C45', fontSize: 16 }, rank: { fontSize: 12, color: '#66736B', fontWeight: '700' },
  name: { color: '#29332D', fontSize: 14, fontWeight: '700' },
  haircut: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#FAFBF8', borderRadius: 10, padding: 10 },
  haircutText: { flex: 1, color: '#355C45', fontSize: 12, fontWeight: '600' }, book: { color: '#355C45', fontSize: 12, fontWeight: '800' }, pressed: { opacity: 0.7 },
});

