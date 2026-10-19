import React, { useState } from 'react';
import { View, Text, Image, ActivityIndicator, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

// REPLACE 192.168.X.X WITH YOUR COMPUTER'S LOCAL IP ADDRESS
const API_URL = 'http://192.168.1.5:3000/api/ai-hairstyle-preview';

export default function HairPreviewScreen() {
  const [imageUri, setImageUri] = useState(null);
  const [base64Data, setBase64Data] = useState(null);
  const [resultImage, setResultImage] = useState(null);
  const [loading, setLoading] = useState(false);

  // Pick photo from gallery
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true, // Enables base64 output
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setBase64Data(result.assets[0].base64);
      setResultImage(null);
    }
  };

  // Send request to Node.js backend
  const handleApplyHairstyle = async (styleName) => {
    if (!base64Data) {
      alert('Please upload a photo first!');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          prompt: `Keep the user's face shape and features identical. Change only their hairstyle to a ${styleName}.`,
        }),
      });

      const data = await response.json();

      if (data.success && data.imageUrl) {
        setResultImage(data.imageUrl);
      } else {
        alert(data.error || 'Failed to generate hairstyle');
      }
    } catch (err) {
      alert('Network Error: Check if server is running and local IP is correct.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandMark}><Ionicons name="cut-outline" size={20} color="#FFFFFF" /></View>
        <Text style={styles.brand}>FACEFIT <Text style={styles.brandAccent}>STUDIO</Text></Text>
      </View>
      <Text style={styles.eyebrow}>AI HAIRSTYLE PREVIEW</Text>
      <Text style={styles.title}>See a new look on you.</Text>
      <Text style={styles.intro}>Choose a clear photo and preview a style while keeping your features true to you.</Text>

      <View style={styles.photoCard}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <View style={styles.photoIcon}><Ionicons name="person-outline" size={28} color="#4A765A" /></View>
            <Text style={styles.placeholderTitle}>Your photo goes here</Text>
            <Text style={styles.placeholderCopy}>Use a front-facing photo in soft, even light.</Text>
          </View>
        )}
        <Pressable accessibilityRole="button" onPress={pickImage} style={({ pressed }) => [styles.photoAction, pressed && styles.pressed]}>
          <Ionicons name="images-outline" size={18} color="#355C45" />
          <Text style={styles.photoActionText}>{imageUri ? 'Choose another photo' : 'Choose a photo'}</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <View><Text style={styles.sectionTitle}>Try a hairstyle</Text><Text style={styles.sectionCopy}>Pick a look to generate your preview.</Text></View>
        <Ionicons name="sparkles-outline" size={21} color="#4A765A" />
      </View>
      <View style={styles.buttonRow}>
        <Pressable disabled={loading} onPress={() => handleApplyHairstyle('Textured Crop Fade')} style={({ pressed }) => [styles.styleButton, pressed && styles.pressed, loading && styles.disabled]}>
          <Ionicons name="cut-outline" size={18} color="#4A765A" /><Text style={styles.styleButtonText}>Textured fade</Text>
        </Pressable>
        <Pressable disabled={loading} onPress={() => handleApplyHairstyle('Classic Buzz Cut')} style={({ pressed }) => [styles.styleButton, pressed && styles.pressed, loading && styles.disabled]}>
          <Ionicons name="cut-outline" size={18} color="#4A765A" /><Text style={styles.styleButtonText}>Buzz cut</Text>
        </Pressable>
      </View>

      {loading && <View style={styles.loadingCard}><ActivityIndicator size="small" color="#4A765A" /><Text style={styles.loadingText}>Creating your look…</Text></View>}

      {resultImage && (
        <View style={styles.resultContainer}>
          <View style={styles.resultHeading}><View><Text style={styles.eyebrow}>YOUR NEW LOOK</Text><Text style={styles.sectionTitle}>Preview ready</Text></View><View style={styles.resultBadge}><Ionicons name="checkmark" size={15} color="#355C45" /><Text style={styles.resultBadgeText}>Done</Text></View></View>
          <Image source={{ uri: resultImage }} style={styles.resultImage} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 30, paddingBottom: 42, backgroundColor: '#FAFBF8', width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 34 },
  brandMark: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#4A765A', alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: '#355C45' },
  brandAccent: { color: '#4A765A', fontWeight: '700' },
  eyebrow: { color: '#4A765A', fontSize: 10, fontWeight: '900', letterSpacing: 1.4, marginBottom: 8 },
  title: { color: '#29332D', fontSize: 34, lineHeight: 40, letterSpacing: -0.8, fontWeight: '900', marginBottom: 9 },
  intro: { color: '#355C45', fontSize: 14, lineHeight: 22, marginBottom: 22 },
  photoCard: { padding: 12, borderRadius: 25, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E9E2', boxShadow: [{ offsetX: 0, offsetY: 5, blurRadius: 14, color: "rgba(53, 92, 69, 0.045)" }], elevation: 2 },
  previewImage: { width: '100%', aspectRatio: 1, borderRadius: 18, backgroundColor: '#EDF5EE' },
  photoPlaceholder: { aspectRatio: 1, borderRadius: 18, backgroundColor: '#FAFBF8', alignItems: 'center', justifyContent: 'center', padding: 28 },
  photoIcon: { width: 62, height: 62, borderRadius: 22, backgroundColor: '#EDF5EE', alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  placeholderTitle: { color: '#29332D', fontSize: 15, fontWeight: '800', marginBottom: 5 },
  placeholderCopy: { color: '#58634E', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  photoAction: { minHeight: 48, borderRadius: 15, backgroundColor: '#EDF5EE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 11 },
  photoActionText: { color: '#355C45', fontSize: 13, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 28, marginBottom: 13 },
  sectionTitle: { color: '#29332D', fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
  sectionCopy: { color: '#58634E', fontSize: 11, marginTop: 4 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  styleButton: { flexGrow: 1, minHeight: 52, borderRadius: 16, paddingHorizontal: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E9E2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  styleButtonText: { color: '#355C45', fontSize: 12, fontWeight: '800' },
  loadingCard: { minHeight: 58, borderRadius: 17, backgroundColor: '#EDF5EE', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 16 },
  loadingText: { color: '#355C45', fontSize: 13, fontWeight: '700' },
  resultContainer: { marginTop: 28, padding: 13, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E9E2' },
  resultHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  resultBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#EDF5EE' },
  resultBadgeText: { color: '#355C45', fontSize: 10, fontWeight: '800' },
  resultImage: { width: '100%', aspectRatio: 1, borderRadius: 17 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.5 },
});
