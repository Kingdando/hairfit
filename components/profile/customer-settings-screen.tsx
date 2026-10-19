import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getApiAssetUrl, updateProfile, type UserProfile } from '@/services/api';

type Props = {
  token: string;
  profile: UserProfile;
  onBack: () => void;
  onSaved: (profile: UserProfile) => void;
};

const colors = { rose: '#4A765A', roseDark: '#355C45', blush: '#EDF5EE', pale: '#FAFBF8', ink: '#29332D', muted: '#355C45', line: '#E2E9E2', white: '#FFFFFF' };

export function CustomerSettingsScreen({ token, profile, onBack, onSaved }: Props) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone || '');
  const [imageUri, setImageUri] = useState<string | null>(getApiAssetUrl(profile.profileImageUrl));
  const [imageData, setImageData] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setFullName(profile.fullName); setEmail(profile.email); setPhone(profile.phone || '');
    setImageUri(getApiAssetUrl(profile.profileImageUrl)); setImageData(undefined);
    setEditing(false); setSaveError(null); setSaveSuccess(false);
  }, [profile]);

  const choosePhoto = async () => {
    if (Platform.OS !== 'web') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return Alert.alert('Photo access needed', 'Allow FaceFit to select your profile picture.');
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: .65, base64: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.base64 || asset.base64.length * .75 > 2.5 * 1024 * 1024) return Alert.alert('Photo could not be used', 'Choose a JPG, PNG, or WebP photo smaller than 2.5 MB.');
    // Expo ImagePicker's base64 field contains JPEG bytes even when the
    // original library asset was HEIC or PNG.
    setImageUri(asset.uri); setImageData(`data:image/jpeg;base64,${asset.base64}`);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true); setSaveError(null); setSaveSuccess(false);
    try {
      const updated = await updateProfile(token, {
        fullName,
        email,
        phone,
        hairType: profile.hairType || '',
        hairLength: profile.hairLength || '',
        hairTexture: profile.hairTexture || '',
        imageData,
      });
      onSaved(updated);
      setSaveSuccess(true);
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to update your profile.');
    } finally { setSaving(false); }
  };

  return <>
    <View style={styles.header}><Pressable accessibilityRole="button" onPress={onBack} style={styles.iconButton}><Ionicons name="chevron-back" size={22} color={colors.ink} /></Pressable><Text style={styles.headerTitle}>Settings</Text><View style={styles.iconButton} /></View>
    <View style={styles.photoSection}>
      {imageUri ? <Image accessibilityLabel="Profile picture" source={{ uri: imageUri }} style={styles.photo} /> : <View style={styles.photoFallback}><Text style={styles.initial}>{fullName.charAt(0).toUpperCase() || '?'}</Text></View>}
      {editing && <View style={styles.photoActions}><Pressable accessibilityRole="button" onPress={() => void choosePhoto()} style={styles.photoButton}><Ionicons name="camera-outline" size={18} color={colors.roseDark} /><Text style={styles.photoButtonText}>{imageUri ? 'Change photo' : 'Add photo'}</Text></Pressable>{imageUri && <Pressable accessibilityRole="button" onPress={() => { setImageUri(null); setImageData(null); }} style={styles.removeButton}><Text style={styles.removeText}>Remove</Text></Pressable>}</View>}
    </View>
    <Text style={styles.sectionLabel}>PERSONAL INFORMATION</Text>
    <Field label="Full name" value={fullName} onChange={setFullName} icon="person-outline" editable={editing} />
    <Field label="Email" value={email} onChange={setEmail} icon="mail-outline" keyboardType="email-address" editable={editing} />
    <Field label="Phone" value={phone} onChange={setPhone} icon="call-outline" keyboardType="phone-pad" editable={editing} />
    {saveSuccess && <View accessibilityRole="alert" style={styles.success}><Ionicons name="checkmark-circle" size={21} color="#4A765A" /><View style={styles.grow}><Text style={styles.successTitle}>Profile saved</Text><Text style={styles.successText}>Your photo and personal information are up to date.</Text></View></View>}
    {saveError && <View style={styles.error}><Ionicons name="alert-circle" size={19} color="#355C45" /><Text style={styles.errorText}>{saveError}</Text></View>}
    {editing ? (
      <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.saveButton, saving && styles.disabled]}>{saving ? <ActivityIndicator color={colors.white} /> : <><Ionicons name="checkmark" size={20} color={colors.white} /><Text style={styles.saveText}>Save profile</Text></>}</Pressable>
    ) : (
      <Pressable accessibilityRole="button" onPress={() => { setSaveSuccess(false); setSaveError(null); setEditing(true); }} style={styles.editButton}><Ionicons name="create-outline" size={20} color={colors.roseDark} /><Text style={styles.editText}>Edit profile</Text></Pressable>
    )}
  </>;
}

function Field({ label, value, onChange, icon, placeholder, editable, keyboardType = 'default' }: { label: string; value: string; onChange: (value: string) => void; icon: keyof typeof Ionicons.glyphMap; placeholder?: string; editable: boolean; keyboardType?: 'default' | 'email-address' | 'phone-pad' }) { return <View style={styles.fieldWrap}><Text style={styles.label}>{label}</Text><View style={[styles.field, !editable && styles.readOnlyField]}><Ionicons name={icon} size={19} color={colors.muted} /><TextInput editable={editable} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#4A765A" keyboardType={keyboardType} autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'} style={[styles.input, !editable && styles.readOnlyInput]} /></View></View>; }

const styles = StyleSheet.create({ header:{height:56,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:18},headerTitle:{fontSize:18,fontWeight:'800',color:colors.ink},iconButton:{width:42,height:42,borderRadius:15,backgroundColor:colors.white,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.line},photoSection:{alignItems:'center',padding:22,borderRadius:24,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,marginBottom:24},photo:{width:116,height:116,borderRadius:58,},photoFallback:{width:116,height:116,borderRadius:58,backgroundColor:colors.rose,alignItems:'center',justifyContent:'center'},initial:{fontSize:42,fontWeight:'900',color:colors.white},photoActions:{flexDirection:'row',gap:9,marginTop:14},photoButton:{minHeight:42,paddingHorizontal:14,borderRadius:14,backgroundColor:colors.blush,flexDirection:'row',alignItems:'center',gap:6},photoButtonText:{fontSize:12,fontWeight:'800',color:colors.roseDark},removeButton:{minHeight:40,paddingHorizontal:13,justifyContent:'center'},removeText:{fontSize:12,fontWeight:'800',color:'#355C45'},sectionLabel:{fontSize:10,fontWeight:'900',letterSpacing:1.2,color:colors.rose,marginTop:10,marginBottom:11},fieldWrap:{marginBottom:14},label:{fontSize:11,fontWeight:'800',color:colors.ink,marginBottom:7},field:{height:56,borderRadius:17,backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:15},readOnlyField:{backgroundColor:colors.pale},input:{flex:1,height:'100%',fontSize:14,color:colors.ink,outlineStyle:'none' as never},readOnlyInput:{opacity:.82},editButton:{minHeight:54,borderRadius:18,backgroundColor:colors.blush,borderWidth:1,borderColor:'#E2E9E2',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginVertical:10},editText:{fontSize:15,fontWeight:'900',color:colors.roseDark},success:{padding:14,borderRadius:15,backgroundColor:'#EDF5EE',borderWidth:1,borderColor:'#E2E9E2',flexDirection:'row',alignItems:'center',gap:10,marginBottom:10},successTitle:{fontSize:13,fontWeight:'900',color:'#4A765A'},successText:{fontSize:11,lineHeight:16,color:'#4A765A',marginTop:2},saveButton:{minHeight:54,borderRadius:18,backgroundColor:colors.rose,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginVertical:10},saveText:{fontSize:15,fontWeight:'900',color:colors.white},disabled:{opacity:.5},error:{padding:13,borderRadius:14,backgroundColor:'#EDF5EE',flexDirection:'row',alignItems:'center',gap:8,marginBottom:10},errorText:{flex:1,fontSize:12,color:'#355C45'},privacyRow:{minHeight:70,borderBottomWidth:1,borderBottomColor:colors.line,flexDirection:'row',alignItems:'center',gap:13},privacyIcon:{width:42,height:42,borderRadius:14,backgroundColor:colors.blush,alignItems:'center',justifyContent:'center'},privacyTitle:{fontSize:15,fontWeight:'700',color:colors.ink},small:{fontSize:12,lineHeight:18,color:colors.muted},grow:{flex:1} });
