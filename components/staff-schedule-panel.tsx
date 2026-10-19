import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getStaffSchedule, type StaffSchedule } from '@/services/api';

function phToday() { return new Date(Date.now()+8*3600000).toISOString().slice(0,10); }
function time(value: string) { return new Date(value.replace(' ','T')+'+08:00').toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'numeric',minute:'2-digit'}); }
export function StaffSchedulePanel({ salonId, token, initialDate, inline = false, followSelectedDate = false }: { salonId: number; token?: string | null; initialDate?: string | null; inline?: boolean; followSelectedDate?: boolean }) {
  const [visible,setVisible]=useState(false);
  const [date,setDate]=useState(initialDate || phToday());
  const [data,setData]=useState<StaffSchedule | null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const scheduleDate = followSelectedDate ? initialDate : date;
  useEffect(()=>{
    if (!visible && !inline) return;
    if (!scheduleDate) { setData(null); setError(''); setLoading(false); return; }
    let cancelled=false;
    setLoading(true);setError('');setData(null);
    getStaffSchedule(salonId,scheduleDate,token).then(result=>{if(!cancelled)setData(result);}).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Unable to load schedule.');}).finally(()=>{if(!cancelled)setLoading(false);});
    return ()=>{cancelled=true;};
  },[visible,inline,salonId,scheduleDate,token,refresh]);
  useEffect(()=>{ if (inline && !followSelectedDate) setDate(initialDate || phToday()); },[inline,initialDate,followSelectedDate]);
  const move=(days:number)=>{
    const current=new Date(date+'T00:00:00Z');
    if (!Number.isFinite(current.getTime())) return;
    current.setUTCDate(current.getUTCDate()+days);setDate(current.toISOString().slice(0,10));
  };
  if (inline) return <View style={styles.inline}>
    <Text style={styles.heading}>Staff & availability</Text>
        <Text style={styles.copy}>All times are Philippine time. Availability follows saved salon hours and current bookings.</Text>
        {followSelectedDate ? <Text style={styles.label}>{scheduleDate
          ? new Date(`${scheduleDate}T12:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
          : 'Choose a day in the booking calendar to see staff availability.'}</Text> : <View style={styles.row}>
          <Pressable accessibilityLabel="Previous day" accessibilityRole="button" onPress={()=>move(-1)} style={styles.button}><Text style={styles.openText}>Previous</Text></Pressable>
          <TextInput accessibilityLabel="Schedule date YYYY-MM-DD" placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} maxLength={10} style={styles.input}/>
          <Pressable accessibilityLabel="Next day" accessibilityRole="button" onPress={()=>move(1)} style={styles.button}><Text style={styles.openText}>Next</Text></Pressable>
        </View>}
        {!!scheduleDate && <Pressable accessibilityRole="button" onPress={()=>setRefresh(value=>value+1)} style={styles.button}><Text style={styles.openText}>Refresh schedule</Text></Pressable>}
    <View style={styles.list}>
          {loading && <ActivityIndicator color="#4A765A"/>}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {data && data.date === scheduleDate && <>
            <Text style={styles.copy}>{data.canSeeClients ? 'Salon view: full client names and services.' : token ? 'Booked clients are shown by first name only.' : 'Sign in to see client first-name labels on booked slots.'}</Text>
            {!data.openingTime && <Text style={styles.copy}>Salon hours are not configured. Contact the salon to confirm availability.</Text>}
            {data.staff.length===0 && <Text style={styles.copy}>No staff profiles are available for this salon.</Text>}
            {data.staff.map(member=><View key={member.id} style={styles.card}>
              <Text style={styles.name}>{member.name}</Text>
              <Text style={styles.copy}>{member.isAvailable ? 'Accepting appointments' : 'Unavailable — not accepting new appointments'}</Text>
              <Text style={styles.label}>Available time ranges</Text>
              {member.available.length ? member.available.map((slot,index)=><Text style={styles.available} key={index}>{time(slot.start)} – {time(slot.end)}</Text>) : <Text style={styles.copy}>No available time ranges for this date.</Text>}
              <Text style={styles.label}>Booked times</Text>
              {member.bookings.length ? member.bookings.map((slot,index)=><View key={index} style={styles.booking}>
                <Text style={styles.name}>{time(slot.start)} – {time(slot.end)}</Text>
                <Text style={styles.copy}>{slot.isQueued ? 'Waiting queue ? requested time, actual start to be confirmed' : slot.status==='pending' ? 'Pending request' : 'Confirmed booking'}{slot.unassigned ? ' · Staff assignment pending' : ''}</Text>
                {(slot.clientName || slot.clientLabel) && <Text style={styles.name}>Booked by: {slot.clientName || slot.clientLabel}</Text>}{data.canSeeClients && <Text style={styles.copy}>{slot.serviceName}</Text>}
              </View>) : <Text style={styles.copy}>No bookings for this date.</Text>}
            </View>)}
            <Text style={styles.copy}>Free ranges must fit the full service duration. Pending requests may change; refresh before choosing a time.</Text>
          </>}
    </View>
  </View>;
  const content = <>
    <Pressable accessibilityRole="button" onPress={()=>{setDate(initialDate || phToday());setVisible(true);}} style={styles.open}><Text style={styles.openText}>View staff availability & schedule</Text></Pressable>
    <Modal visible={visible} transparent animationType="slide" onRequestClose={()=>setVisible(false)}>
      <View style={styles.backdrop}><View style={styles.sheet}>
        <View style={styles.row}><Text style={styles.heading}>Staff schedule</Text><Pressable accessibilityRole="button" onPress={()=>setVisible(false)} style={styles.button}><Text style={styles.openText}>Close</Text></Pressable></View>
        <Text style={styles.copy}>All times are Philippine time. Availability follows saved salon hours and current bookings.</Text>
        {followSelectedDate ? <Text style={styles.label}>{scheduleDate
          ? new Date(`${scheduleDate}T12:00:00+08:00`).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
          : 'Choose a day in the booking calendar to see staff availability.'}</Text> : <View style={styles.row}>
          <Pressable accessibilityLabel="Previous day" accessibilityRole="button" onPress={()=>move(-1)} style={styles.button}><Text style={styles.openText}>Previous</Text></Pressable>
          <TextInput accessibilityLabel="Schedule date YYYY-MM-DD" placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} maxLength={10} style={styles.input}/>
          <Pressable accessibilityLabel="Next day" accessibilityRole="button" onPress={()=>move(1)} style={styles.button}><Text style={styles.openText}>Next</Text></Pressable>
        </View>}
        {!!scheduleDate && <Pressable accessibilityRole="button" onPress={()=>setRefresh(value=>value+1)} style={styles.button}><Text style={styles.openText}>Refresh schedule</Text></Pressable>}
        <ScrollView contentContainerStyle={styles.list}>
          {loading && <ActivityIndicator color="#4A765A"/>}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          {data && data.date === scheduleDate && <>
            <Text style={styles.copy}>{data.canSeeClients ? 'Salon view: full client names and services.' : token ? 'Booked clients are shown by first name only.' : 'Sign in to see client first-name labels on booked slots.'}</Text>
            {!data.openingTime && <Text style={styles.copy}>Salon hours are not configured. Contact the salon to confirm availability.</Text>}
            {data.staff.length===0 && <Text style={styles.copy}>No staff profiles are available for this salon.</Text>}
            {data.staff.map(member=><View key={member.id} style={styles.card}>
              <Text style={styles.name}>{member.name}</Text>
              <Text style={styles.copy}>{member.isAvailable ? 'Accepting appointments' : 'Unavailable — not accepting new appointments'}</Text>
              <Text style={styles.label}>Available time ranges</Text>
              {member.available.length ? member.available.map((slot,index)=><Text style={styles.available} key={index}>{time(slot.start)} – {time(slot.end)}</Text>) : <Text style={styles.copy}>No available time ranges for this date.</Text>}
              <Text style={styles.label}>Booked times</Text>
              {member.bookings.length ? member.bookings.map((slot,index)=><View key={index} style={styles.booking}>
                <Text style={styles.name}>{time(slot.start)} – {time(slot.end)}</Text>
                <Text style={styles.copy}>{slot.isQueued ? 'Waiting queue ? requested time, actual start to be confirmed' : slot.status==='pending' ? 'Pending request' : 'Confirmed booking'}{slot.unassigned ? ' · Staff assignment pending' : ''}</Text>
                {(slot.clientName || slot.clientLabel) && <Text style={styles.name}>Booked by: {slot.clientName || slot.clientLabel}</Text>}{data.canSeeClients && <Text style={styles.copy}>{slot.serviceName}</Text>}
              </View>) : <Text style={styles.copy}>No bookings for this date.</Text>}
            </View>)}
            <Text style={styles.copy}>Free ranges must fit the full service duration. Pending requests may change; refresh before choosing a time.</Text>
          </>}
        </ScrollView>
      </View></View>
    </Modal>
  </>;
  return content;
}
const styles=StyleSheet.create({
  inline:{gap:12,marginVertical:16},
  open:{minHeight:48,padding:13,backgroundColor:'#EDF5EE',borderWidth:1,borderColor:'#E2E9E2',borderRadius:14,alignItems:'center',justifyContent:'center',marginVertical:10},openText:{color:'#355C45',fontWeight:'800',fontSize:13},
  backdrop:{flex:1,backgroundColor:'rgba(20,30,24,0.5)',justifyContent:'center',padding:18},sheet:{width:'100%',maxWidth:720,maxHeight:'90%',alignSelf:'center',backgroundColor:'#FFFFFF',borderRadius:24,padding:18,gap:10},
  heading:{fontSize:22,fontWeight:'800',color:'#29332D',flex:1},row:{flexDirection:'row',gap:8,alignItems:'center'},button:{minHeight:44,padding:10,borderRadius:12,backgroundColor:'#EDF5EE',alignItems:'center',justifyContent:'center'},input:{flex:1,minHeight:46,borderWidth:1,borderColor:'#E2E9E2',borderRadius:12,padding:10,color:'#29332D'},
  list:{gap:14,paddingBottom:20},card:{padding:16,borderRadius:18,borderWidth:1,borderColor:'#E2E9E2',gap:6},name:{fontSize:14,fontWeight:'700',color:'#29332D'},copy:{fontSize:12,lineHeight:19,color:'#66736B'},label:{marginTop:9,fontSize:12,fontWeight:'800',color:'#355C45'},available:{fontSize:13,color:'#355C45',lineHeight:21},booking:{padding:12,backgroundColor:'#F4F7F2',borderRadius:12,gap:4},error:{color:'#A33340',fontSize:13},
});
