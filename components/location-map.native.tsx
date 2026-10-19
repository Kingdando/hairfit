import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import type { LocationMapProps } from './location-map.types';

const regionDelta = 0.012;

export function LocationMap({ coordinate, salons = [], onSelectSalon }: LocationMapProps) {
  const map = useRef<MapView>(null);

  useEffect(() => {
    if (!salons.length) return;

    map.current?.fitToCoordinates([coordinate, ...salons], {
      edgePadding: { top: 72, right: 48, bottom: 92, left: 48 },
      animated: true,
    });
  }, [coordinate, salons]);

  const recenter = () => {
    map.current?.animateToRegion({
      ...coordinate,
      latitudeDelta: regionDelta,
      longitudeDelta: regionDelta,
    }, 350);
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={map}
        initialRegion={{
          ...coordinate,
          latitudeDelta: regionDelta,
          longitudeDelta: regionDelta,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        style={StyleSheet.absoluteFill}
        toolbarEnabled={false}>
        <Marker coordinate={coordinate} pinColor="#4A765A" title="You are here" />
        {salons.map((salon) => {
          const initials = salon.name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((word) => word[0])
            .join('')
            .toUpperCase();

          return (
            <Marker
              key={salon.id}
              coordinate={salon}
              title={salon.name}
              description={salon.address}
              onCalloutPress={() => onSelectSalon?.(salon.id)}>
              <View style={styles.salonLogo}>
                {salon.profileImageUrl ? <Image source={{ uri: salon.profileImageUrl }} style={styles.salonLogoImage} /> : <><Ionicons name="storefront" size={15} color="#FFFFFF" /><Text style={styles.salonInitials}>{initials}</Text></>}
              </View>
            </Marker>
          );
        })}
      </MapView>
      <Pressable
        accessibilityLabel="Recenter map on my location"
        accessibilityRole="button"
        onPress={recenter}
        style={({ pressed }) => [styles.recenterButton, pressed && styles.pressed]}>
        <Ionicons name="locate" size={22} color="#4A765A" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  recenterButton: {
    position: 'absolute',
    right: 18,
    bottom: 28,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E9E2',
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 8, color: "rgba(0, 0, 0, 0.14)" }],
    elevation: 5,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
  salonLogo: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A765A',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 5, color: "rgba(0, 0, 0, 0.2)" }],
    elevation: 6,
  },
  salonInitials: {
    marginTop: -1,
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  salonLogoImage: { width: 40, height: 40, borderRadius: 12, },
});
