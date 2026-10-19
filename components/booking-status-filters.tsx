import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { Booking } from '@/services/api';

export type BookingFilter = 'all' | Booking['status'];
const options: { value: BookingFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];
export function BookingStatusFilters({ value, onChange, bookings }: {
  value: BookingFilter;
  onChange: (value: BookingFilter) => void;
  bookings: { status: Booking['status'] }[];
}) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
    {options.map(option => {
      const selected = value === option.value;
      const count = option.value === 'all' ? bookings.length : bookings.filter(booking => booking.status === option.value).length;
      return <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected }}
        accessibilityLabel={`${option.label}, ${count} bookings`} onPress={() => onChange(option.value)} style={[styles.chip, selected && styles.selected]}>
        <Text style={[styles.text, selected && styles.selectedText]}>{option.label} ({count})</Text>
      </Pressable>;
    })}
  </ScrollView>;
}
const styles = StyleSheet.create({
  row: { gap: 8, paddingBottom: 18 },
  chip: { minHeight: 44, borderRadius: 22, paddingHorizontal: 15, justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E9E2' },
  selected: { backgroundColor: '#4A765A', borderColor: '#4A765A' },
  text: { color: '#355C45', fontSize: 13, fontWeight: '700' },
  selectedText: { color: '#FFFFFF' },
});
