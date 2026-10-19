import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type OwnerTab = 'dashboard' | 'analytics' | 'manage';
const tabs: { key: OwnerTab; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid-outline', activeIcon: 'grid' },
  { key: 'analytics', label: 'Analytics', icon: 'bar-chart-outline', activeIcon: 'bar-chart' },
  { key: 'manage', label: 'Manage Salon', icon: 'storefront-outline', activeIcon: 'storefront' },
];
export function OwnerTabBar({ active, onChange }: { active: OwnerTab; onChange: (tab: OwnerTab) => void }) {
  return <SafeAreaView edges={['bottom']} style={styles.shell}>
    <View style={styles.row}>
      {tabs.map(tab => {
        const selected = active === tab.key;
        return <Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{ selected }}
          accessibilityLabel={tab.label} onPress={() => onChange(tab.key)} style={styles.tab}>
          <View style={[styles.icon, selected && styles.activeIcon]}>
            <Ionicons name={selected ? tab.activeIcon : tab.icon} size={23} color={selected ? '#355C45' : '#66736B'} />
          </View>
          <Text style={[styles.label, selected && styles.activeLabel]}>{tab.label}</Text>
        </Pressable>;
      })}
    </View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  shell: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E9E2' },
  row: { flexDirection: 'row', maxWidth: 720, width: '100%', alignSelf: 'center', paddingTop: 7, paddingBottom: 7 },
  tab: { flex: 1, minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 4 },
  icon: { minWidth: 56, height: 30, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  activeIcon: { backgroundColor: '#EDF5EE' },
  label: { fontSize: 11, fontWeight: '600', color: '#66736B' }, activeLabel: { color: '#355C45', fontWeight: '800' },
});
