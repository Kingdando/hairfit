import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SalonLocationPicker } from '@/components/salon-location-picker';
import { createOwnerSalon } from '@/services/api';

type Props = {
  token: string;
  defaultName: string;
  onComplete: () => void;
  onLogout: () => void;
};

export function OwnerSalonSetupScreen({ token, defaultName, onComplete, onLogout }: Props) {
  const [name, setName] = useState(defaultName);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Nasugbu');
  const [latitude, setLatitude] = useState('14.0667');
  const [longitude, setLongitude] = useState('120.6333');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoData, setLogoData] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickLogo = async () => {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.65,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.base64) return;
    setLogoUri(asset.uri);
    setLogoData(`data:image/jpeg;base64,${asset.base64}`);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await createOwnerSalon(token, {
        name,
        address,
        city,
        latitude: Number(latitude),
        longitude: Number(longitude),
        logoData,
      });
      onComplete();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create salon.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>OWNER SETUP</Text>
          <Text style={styles.title}>Finish your salon profile</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Log out" onPress={onLogout} style={styles.logout}>
          <Ionicons name="log-out-outline" size={19} color="#355C45" />
        </Pressable>
      </View>

      <Text style={styles.body}>
        Add the details customers need to find your salon and book with your team.
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Salon details</Text>
        <Field label="Salon name" value={name} onChange={setName} />
        <Field label="Complete address" value={address} onChange={setAddress} />
        <Field label="City or municipality" value={city} onChange={setCity} />
        <Pressable accessibilityRole="button" onPress={() => void pickLogo()} style={styles.logoPicker}>
          {logoUri ? (
            <Image source={{ uri: logoUri }} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Ionicons name="images-outline" size={22} color="#4A765A" />
            </View>
          )}
          <View style={styles.logoCopy}>
            <Text style={styles.logoText}>{logoUri ? 'Change salon logo' : 'Add a salon logo'}</Text>
            <Text style={styles.logoHint}>A square image works best</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#4A765A" />
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.locationHeading}>
          <View style={styles.locationIcon}>
            <Ionicons name="location-outline" size={18} color="#4A765A" />
          </View>
          <View style={styles.locationCopy}>
            <Text style={styles.sectionTitle}>Pin your location</Text>
            <Text style={styles.locationHint}>Set the map point customers will use to find you.</Text>
          </View>
        </View>
        <View style={styles.mapFrame}>
          <SalonLocationPicker
            latitude={Number(latitude) || 14.0667}
            longitude={Number(longitude) || 120.6333}
            onChange={(point) => {
              setLatitude(point.latitude.toFixed(7));
              setLongitude(point.longitude.toFixed(7));
            }}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.half}><Field label="Latitude" value={latitude} onChange={setLatitude} /></View>
          <View style={styles.half}><Field label="Longitude" value={longitude} onChange={setLongitude} /></View>
        </View>
      </View>

      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.save, saving && styles.disabled]}>
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Text style={styles.saveText}>Create and publish salon</Text>
            <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
          </>
        )}
      </Pressable>
    </>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={`Enter ${label.toLowerCase()}`} placeholderTextColor="#8A967E" style={styles.field} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 8 },
  headerCopy: { flex: 1 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#4A765A', marginBottom: 7 },
  title: { fontSize: 29, lineHeight: 35, letterSpacing: -0.65, fontWeight: '900', color: '#29332D' },
  body: { fontSize: 14, lineHeight: 22, color: '#355C45', marginBottom: 22 },
  logout: { width: 44, height: 44, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E9E2', alignItems: 'center', justifyContent: 'center' },
  section: { padding: 18, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E9E2', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#29332D', marginBottom: 13 },
  fieldWrap: { marginBottom: 13 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6, color: '#355C45', marginBottom: 7 },
  field: { height: 52, borderRadius: 15, backgroundColor: '#FAFBF8', borderWidth: 1, borderColor: '#E2E9E2', paddingHorizontal: 14, fontSize: 14, color: '#29332D' },
  logoPicker: { minHeight: 74, borderRadius: 17, backgroundColor: '#FAFBF8', borderWidth: 1, borderColor: '#E2E9E2', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  logo: { width: 50, height: 50, borderRadius: 14 },
  logoPlaceholder: { width: 50, height: 50, borderRadius: 14, backgroundColor: '#EDF5EE', alignItems: 'center', justifyContent: 'center' },
  logoCopy: { flex: 1 },
  logoText: { fontSize: 12, fontWeight: '800', color: '#355C45' },
  logoHint: { fontSize: 10, color: '#58634E', marginTop: 3 },
  locationHeading: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 13 },
  locationIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#EDF5EE', alignItems: 'center', justifyContent: 'center' },
  locationCopy: { flex: 1 },
  locationHint: { fontSize: 11, lineHeight: 16, color: '#58634E', marginTop: -9 },
  mapFrame: { overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: '#E2E9E2', marginBottom: 14 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  error: { padding: 13, borderRadius: 15, backgroundColor: '#EDF5EE', color: '#355C45', marginBottom: 12 },
  save: { minHeight: 56, borderRadius: 18, backgroundColor: '#4A765A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 3, marginBottom: 12, boxShadow: [{ offsetX: 0, offsetY: 5, blurRadius: 12, color: "rgba(53, 92, 69, 0.15)" }], elevation: 4 },
  saveText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF' },
  disabled: { opacity: 0.6 },
});
