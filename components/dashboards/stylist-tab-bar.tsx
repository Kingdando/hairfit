import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Icon = keyof typeof Ionicons.glyphMap;
const tabs: { section: string; label: string; icon: Icon; activeIcon: Icon }[] = [
  { section: 'Overview', label: 'Dashboard', icon: 'grid-outline', activeIcon: 'grid' },
  { section: 'Appointments', label: 'Appointments', icon: 'calendar-outline', activeIcon: 'calendar' },
  { section: 'Insights', label: 'Insights', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
  { section: 'More', label: 'More', icon: 'menu-outline', activeIcon: 'menu' },
];
export function StylistTabBar({ section, onChange, onMore }: { section: string; onChange: (section: string) => void; onMore: () => void }) {
  const active = tabs.some(tab => tab.section === section) ? section : 'More';
  return <SafeAreaView edges={['bottom']} style={s.shell}><View style={s.row}>
    {tabs.map(tab => {
      const selected = active === tab.section;
      return <Pressable key={tab.section} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected }} onPress={() => tab.section === 'More' ? onMore() : onChange(tab.section)} style={s.tab}>
        <View style={[s.icon, selected && s.selectedIcon]}><Ionicons name={selected ? tab.activeIcon : tab.icon} size={23} color={selected ? '#355C45' : '#66736B'}/></View>
        <Text numberOfLines={1} style={[s.label, selected && s.selectedLabel]}>{tab.label}</Text>
      </Pressable>;
    })}
  </View></SafeAreaView>;
}
const s = StyleSheet.create({
  shell: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E9E2' },
  row: { flexDirection: 'row', maxWidth: 720, width: '100%', alignSelf: 'center', paddingVertical: 7 },
  tab: { flex: 1, minWidth: 0, minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 4 },
  icon: { minWidth: 56, height: 30, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, selectedIcon: { backgroundColor: '#EDF5EE' },
  label: { fontSize: 11, fontWeight: '600', color: '#66736B' }, selectedLabel: { color: '#355C45', fontWeight: '800' },
});
