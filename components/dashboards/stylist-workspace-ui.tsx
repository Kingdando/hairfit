import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
type Icon = keyof typeof Ionicons.glyphMap;
export function Action({ label, onPress, primary = false, disabled = false, icon }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean; icon?: Icon }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [ui.button, primary && ui.primary, (pressed || disabled) && ui.faded]}>{icon && <Ionicons name={icon} size={17} color={primary ? '#FFFFFF' : '#355C45'}/>}<Text style={[ui.buttonText, primary && ui.white]}>{label}</Text></Pressable>;
}
export function Field({ label, value, onChangeText, multiline = false, maxLength = 500, placeholder = '' }: { label: string; value: string; onChangeText: (v: string) => void; multiline?: boolean; maxLength?: number; placeholder?: string }) {
  return <View style={ui.field}><Text style={ui.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} multiline={multiline} maxLength={maxLength} placeholder={placeholder} placeholderTextColor="#66736B" style={[ui.input, multiline && ui.multiline]}/></View>;
}
export function Intro({ title, copy }: { title: string; copy: string }) { return <View style={ui.field}><Text style={ui.title}>{title}</Text><Text style={ui.copy}>{copy}</Text></View>; }
export function Empty({ title, copy }: { title: string; copy: string }) { return <View style={ui.empty}><View style={ui.iconBox}><Ionicons name="leaf-outline" size={25} color="#4A765A"/></View><Text style={ui.cardTitle}>{title}</Text><Text style={[ui.copy, ui.center]}>{copy}</Text></View>; }
export const ui = StyleSheet.create({
  flex: { flex: 1 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, wrap: { flexWrap: 'wrap' }, gap: { gap: 16 }, center: { textAlign: 'center' },
  title: { color: '#29332D', fontSize: 24, fontWeight: '800' }, heading: { color: '#29332D', fontSize: 19, fontWeight: '800' }, cardTitle: { color: '#29332D', fontSize: 15, fontWeight: '700' }, copy: { color: '#66736B', fontSize: 12, lineHeight: 20 }, eyebrow: { color: '#4A765A', fontSize: 10, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' }, label: { color: '#355C45', fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E9E2', borderRadius: 20, padding: 18, gap: 14 }, badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: '#EDF5EE', color: '#355C45', fontSize: 11, fontWeight: '700' }, pill: { color: '#4A765A', fontSize: 12, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#FAFBF8', borderRadius: 8 },
  button: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: '#EDF5EE', borderRadius: 12 }, primary: { backgroundColor: '#355C45' }, buttonText: { color: '#355C45', fontWeight: '700', fontSize: 12 }, white: { color: '#FFFFFF' }, faded: { opacity: 0.5 },
  field: { gap: 8 }, input: { minHeight: 46, padding: 12, borderWidth: 1, borderColor: '#E2E9E2', borderRadius: 12, backgroundColor: '#FFFFFF', fontSize: 13, color: '#29332D' }, multiline: { minHeight: 100, textAlignVertical: 'top' },
  empty: { backgroundColor: '#FFFFFF', padding: 24, borderRadius: 20, borderWidth: 1, borderColor: '#E2E9E2', alignItems: 'center', gap: 12 }, iconBox: { width: 46, height: 46, backgroundColor: '#EDF5EE', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  reference: { width: '100%', height: 280, borderRadius: 16, backgroundColor: '#EDF5EE' },
});
