import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { type Booking, type OwnerBooking, confirmClientArrival, markBookingArrival, requestBookingReschedule, reviewBookingDeposit, reviewBookingReschedule, submitBookingDeposit } from '@/services/api';

type Props = {
  booking: Booking | OwnerBooking;
  token: string;
  owner?: boolean;
  onUpdated: () => Promise<void>;
  onRebook?: () => void;
  chooseReceipt?: () => Promise<{ uri: string; data: string } | null>;
};
export function BookingActions({ booking, token, owner, onUpdated, onRebook, chooseReceipt }: Props) {
  const [mode, setMode] = useState<'deposit' | 'reschedule' | 'receipt' | null>(null);
  const [reference, setReference] = useState('');
  const [receipt, setReceipt] = useState<{ uri: string; data: string } | null>(null);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const upcoming = new Date(booking.appointmentAt) > new Date();
  const active = booking.status === 'pending' || booking.status === 'confirmed';
  const depositStatus = booking.depositStatus || (booking.status === 'pending' ? 'unpaid' : null);
  const amount = Number(booking.depositAmount ?? Math.round(Number(booking.price) * 20) / 100);
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); await onUpdated(); setMode(null); setReceipt(null); setReference(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update booking.'); }
    finally { setBusy(false); }
  };
  const button = (label: string, onPress: () => void, secondary = false) => (
    <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={[styles.button, secondary && styles.secondary, busy && styles.disabled]}>
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
  const open = (value: typeof mode) => { setError(''); setMode(value); };
  return <View style={styles.section}>
    {!!booking.isQueued && <View style={styles.notice}>
      <Text style={styles.title}>Waiting in the stylist queue</Text>
      <Text style={styles.copy}>This is your requested time, not a guaranteed start. Please wait for the salon to confirm when the stylist is free. Arrival reminders begin only after confirmation.</Text>
    </View>}
    {depositStatus && booking.status !== 'completed' && <View style={styles.notice}>
      <Text style={styles.title}>20% down payment: PHP {amount.toFixed(2)}</Text>
      <Text style={styles.copy}>Payment: {depositStatus === 'submitted' ? 'Awaiting salon verification' : depositStatus}</Text>
      {String(booking.status) !== 'completed' && <Text style={styles.copy}>Balance at salon: PHP {Math.max(0, Number(booking.price) - amount).toFixed(2)}</Text>}
    </View>}
    {booking.status === 'confirmed' && <View style={styles.notice}>
      <Text style={styles.title}>{booking.arrivedAt ? 'Client checked in' : '15-minute arrival grace period'}</Text>
      <Text style={styles.copy}>{booking.arrivedAt ? 'Arrival has been recorded.' : 'Confirm your arrival from 30 minutes before your appointment. Appointments without a recorded arrival are automatically cancelled 15 minutes after the scheduled start.'}</Text>
    </View>}
    {!!booking.autoCancelled && booking.status === 'cancelled' && <View style={styles.notice}>
      <Text style={styles.title}>Missed appointment ? choose a new schedule</Text>
      <Text style={styles.copy}>No arrival was recorded within 15 minutes. Request a new time below for salon approval. Your payment record remains attached.</Text>
    </View>}
    {booking.changeRequestId && <View style={styles.notice}>
      <Text style={styles.title}>Reschedule awaiting approval</Text>
      <Text style={styles.copy}>Requested: {new Date(booking.requestedAppointmentAt!).toLocaleString()}</Text>
      <Text style={styles.copy}>{booking.changeReason}</Text>
      <Text style={styles.copy}>{booking.autoCancelled ? 'Your booking stays cancelled until the salon approves the new time.' : 'Your original appointment stays in place until the salon approves.'}</Text>
      {owner && <>{button('Approve new time', () => void run(() => reviewBookingReschedule(token, booking.id, 'approved')))}{button('Decline new time', () => void run(() => reviewBookingReschedule(token, booking.id, 'rejected')), true)}</>}
    </View>}
    {owner ? <>
      {booking.status === 'confirmed' && !booking.arrivedAt && button('Mark client arrived', () => void run(() => markBookingArrival(token, booking.id)))}
      {booking.depositReceipt && button('View payment receipt', () => open('receipt'), true)}
      {booking.depositStatus === 'submitted' && booking.status === 'pending' && <>
        <Text style={styles.copy}>Reference: {booking.depositReference}. Check the amount and reference in your GCash account before verifying.</Text>
        {button('Verify down payment', () => void run(() => reviewBookingDeposit(token, booking.id, 'verified')))}
        {button('Reject payment proof', () => void run(() => reviewBookingDeposit(token, booking.id, 'rejected')), true)}
      </>}
    </> : <>
      {booking.status === 'confirmed' && !booking.arrivedAt && button('I have arrived', () => void run(() => confirmClientArrival(token, booking.id)))}
      {booking.status === 'pending' && (upcoming || !!booking.isQueued) && amount > 0 && ['unpaid', 'rejected'].includes(depositStatus || '') && button('Pay down payment / Upload receipt', () => open('deposit'))}
      {booking.status === 'confirmed' && !depositStatus && <Text style={styles.copy}>This booking was confirmed before down payments were introduced. Contact the salon about payment.</Text>}
      {((active && upcoming) || (booking.status === 'cancelled' && !!booking.autoCancelled)) && !booking.changeRequestId && button('Request reschedule', () => open('reschedule'), true)}
      {(!active || !upcoming) && !booking.autoCancelled && onRebook && button('Book again', onRebook, true)}
    </>}
    {busy && <ActivityIndicator color="#4A765A" />}
    {!!error && !mode && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    <Modal visible={mode !== null} transparent animationType="fade" onRequestClose={() => { if (!busy) setMode(null); }}>
      <View style={styles.backdrop}><ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled"><View style={styles.sheet}>
        <Text style={styles.heading}>{ mode === 'deposit' ? 'Confirm with a down payment' : mode === 'reschedule' ? 'Request a new appointment time' : 'Payment receipt'}</Text>
        {mode === 'deposit' && <>
          <Text style={styles.copy}>Pay PHP {amount.toFixed(2)} (20%) through GCash. Contact the salon to confirm its GCash recipient before sending money. hAIrfit does not charge your account.</Text>
          <Text style={styles.copy}>The salon verifies your receipt before confirming the appointment. The remaining balance is paid at the salon.</Text>
          <Text style={styles.label}>GCash reference number</Text>
          <TextInput accessibilityLabel="GCash reference number" style={styles.input} placeholder="10–20 digits" keyboardType="number-pad" value={reference} onChangeText={setReference} maxLength={20} />
          {button(receipt ? 'Choose a different receipt' : 'Upload GCash receipt', () => {
            void (async () => { try { const image = await chooseReceipt?.(); if (image) setReceipt(image); } catch { setError('Could not open your photo library.'); } })();
          }, true)}
          {receipt && <Image source={{ uri: receipt.uri }} resizeMode="contain" style={styles.receipt} />}
          {button('Submit for verification', () => {
            if (!receipt) { setError('Upload your payment receipt first.'); return; }
            void run(() => submitBookingDeposit(token, booking.id, reference, receipt.data));
          })}
        </>}
        {mode === 'reschedule' && <>
          <Text style={styles.copy}>Choose a future time within salon hours. Your appointment status stays unchanged until the salon approves. Your down payment stays attached to this booking.</Text>
          <Text style={styles.label}>New date (YYYY-MM-DD, Philippine time)</Text>
          <TextInput accessibilityLabel="New date YYYY-MM-DD" placeholder="2026-10-20" style={styles.input} value={date} onChangeText={setDate} maxLength={10} />
          <Text style={styles.label}>New time (24-hour HH:MM)</Text>
          <TextInput accessibilityLabel="New time HH:MM" placeholder="14:00" style={styles.input} value={time} onChangeText={setTime} maxLength={5} />
          <Text style={styles.label}>Reason</Text>
          <TextInput accessibilityLabel="Reason for rescheduling" multiline style={styles.input} value={reason} onChangeText={setReason} maxLength={500} />
          {button('Send reschedule request', () => void run(() => requestBookingReschedule(token, booking.id, `${date.trim()} ${time.trim()}:00`, reason)))}
        </>}
        {mode === 'receipt' && booking.depositReceipt && <Image source={{ uri: booking.depositReceipt }} resizeMode="contain" style={styles.receipt} />}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        {button('Close', () => setMode(null), true)}
      </View></ScrollView></View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  section: { marginTop: 12, gap: 8 }, notice: { backgroundColor: '#EDF5EE', padding: 14, borderRadius: 16, gap: 5 },
  title: { color: '#29332D', fontWeight: '800', fontSize: 14 }, copy: { color: '#66736B', fontSize: 13, lineHeight: 20 },
  button: { minHeight: 46, borderRadius: 14, backgroundColor: '#4A765A', padding: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  buttonText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 }, secondary: { backgroundColor: '#EDF5EE', borderWidth: 1, borderColor: '#E2E9E2' }, secondaryText: { color: '#355C45' }, disabled: { opacity: 0.5 },
  backdrop: { flex: 1, backgroundColor: 'rgba(20,30,24,0.5)' }, modalScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 520, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 22, gap: 10 }, heading: { fontSize: 22, fontWeight: '800', color: '#29332D' },
  label: { fontSize: 12, fontWeight: '700', color: '#355C45', marginTop: 8 }, input: { minHeight: 48, borderWidth: 1, borderColor: '#E2E9E2', borderRadius: 12, padding: 12, color: '#29332D', backgroundColor: '#FAFBF8' },
  receipt: { width: '100%', height: 340, borderRadius: 14 }, error: { color: '#A33340', fontSize: 13, lineHeight: 20 },
});
