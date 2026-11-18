import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import type { SalonMapProps } from './salon-map.types';

const nasugbu = { latitude: 14.0667, longitude: 120.6333 };

export function SalonMap({ salons, onSelectSalon }: SalonMapProps) {
  const map = useRef<MapView>(null);

  useEffect(() => {
    if (salons.length) {
      map.current?.fitToCoordinates(salons, { edgePadding: { top: 70, right: 50, bottom: 70, left: 50 }, animated: true });
    }
  }, [salons]);

  return <View style={styles.container}><MapView ref={map} initialRegion={{ ...nasugbu, latitudeDelta: 0.16, longitudeDelta: 0.16 }} showsUserLocation style={StyleSheet.absoluteFill} toolbarEnabled={false}>{salons.map(salon => <Marker key={salon.id} coordinate={salon} title={salon.name} description={salon.address} onCalloutPress={() => onSelectSalon?.(salon.id)}><View style={styles.marker}>{salon.profileImageUrl ? <Image source={{ uri: salon.profileImageUrl }} style={styles.markerLogo} /> : <Ionicons name="storefront" size={18} color="#FFFFFF" />}</View></Marker>)}</MapView><View style={[styles.legend, { pointerEvents: "none" }]}><View style={styles.legendMarker}><Ionicons name="storefront" size={13} color="#FFFFFF" /></View><Text style={styles.legendText}>hAIrfit salon</Text></View></View>;
}

const styles = StyleSheet.create({
  container: { height: 470, borderRadius: 22, overflow: 'hidden', backgroundColor: '#E2E9E2' },
  marker: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#4A765A', borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 6 },
  markerLogo: { width: 36, height: 36, borderRadius: 18, },
  legend: { position: 'absolute', left: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 13, backgroundColor: '#FFFFFF' },
  legendMarker: { width: 25, height: 25, borderRadius: 13, backgroundColor: '#4A765A', alignItems: 'center', justifyContent: 'center' },
  legendText: { color: '#29332D', fontSize: 12, fontWeight: '700' },
});
