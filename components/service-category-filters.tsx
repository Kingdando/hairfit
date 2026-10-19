import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

const categories = ['All', 'Haircut', 'Hair Color', 'Styling', 'Treatments', 'Perm & Straightening', 'Beard', 'Nails', 'Makeup', 'Other'] as const;
export type ServiceCategory = typeof categories[number];
export function serviceCategory(name: string): ServiceCategory {
  if (/beard|mustache|moustache|shav/i.test(name)) return 'Beard';
  if (/hair\s*cut|\bcut\b|trim|fade|fringe|bangs/i.test(name)) return 'Haircut';
  if (/colou?r|highlight|balayage|ombre|bleach|\bdye\b|toner|tint/i.test(name)) return 'Hair Color';
  if (/rebond|straighten|\bperm\b|relax/i.test(name)) return 'Perm & Straightening';
  if (/treatment|keratin|hair\s*spa|scalp|condition|repair/i.test(name)) return 'Treatments';
  if (/nail|manicure|pedicure/i.test(name)) return 'Nails';
  if (/make\s*up/i.test(name)) return 'Makeup';
  if (/styl|blow|shampoo|wash|braid|updo|curl/i.test(name)) return 'Styling';
  return 'Other';
}
export function matchesServiceCategory(service: { name: string }, category: ServiceCategory) {
  return category === 'All' || serviceCategory(service.name) === category;
}
export function ServiceCategoryFilters({ services, value, onChange }: {
  services: { name: string }[]; value: ServiceCategory; onChange: (category: ServiceCategory) => void;
}) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
    {categories.map(category => {
      const count = services.filter(service => matchesServiceCategory(service, category)).length;
      if (!count && category !== 'All' && category !== value) return null;
      const selected = value === category;
      return <Pressable key={category} accessibilityRole="button" accessibilityState={{ selected }}
        accessibilityLabel={`${category}, ${count} services`} onPress={() => onChange(category)} style={[styles.chip, selected && styles.selected]}>
        <Text style={[styles.text, selected && styles.selectedText]}>{category} ({count})</Text>
      </Pressable>;
    })}
  </ScrollView>;
}
const styles = StyleSheet.create({
  row: { gap: 8, paddingBottom: 16 }, chip: { minHeight: 44, borderRadius: 22, paddingHorizontal: 15, justifyContent: 'center', borderWidth: 1, borderColor: '#E2E9E2', backgroundColor: '#FFFFFF' },
  selected: { backgroundColor: '#4A765A', borderColor: '#4A765A' }, text: { color: '#355C45', fontSize: 13, fontWeight: '700' }, selectedText: { color: '#FFFFFF' },
});
