const PH_OFFSET = 8 * 60 * 60 * 1000;
function philippineDateTime(date) {
  return new Date(date.getTime() + PH_OFFSET).toISOString().slice(0, 19).replace('T', ' ');
}
async function ensureAppointmentSchema(db) {
  await db.execute(`CREATE TABLE IF NOT EXISTS appointment_tracking (
    booking_id BIGINT UNSIGNED NOT NULL, appointment_at DATETIME NOT NULL,
    arrived_at DATETIME NULL, reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
    due_sent BOOLEAN NOT NULL DEFAULT FALSE, auto_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (booking_id, appointment_at),
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE)`);
  // Existing historical bookings must not be retroactively marked as no-shows.
  await db.execute(`INSERT IGNORE INTO appointment_tracking (booking_id,appointment_at)
    SELECT id,appointment_at FROM bookings WHERE status='confirmed'
    AND appointment_at > DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)`);
}
async function processAppointmentReminders(pool, now = new Date()) {
  const nowPH = philippineDateTime(now);
  const [candidates] = await pool.execute(`SELECT t.booking_id, DATE_FORMAT(t.appointment_at,'%Y-%m-%d %H:%i:%s') AS slot,
    sv.salon_id FROM appointment_tracking t JOIN bookings b ON b.id=t.booking_id AND b.appointment_at=t.appointment_at
    JOIN services sv ON sv.id=b.service_id WHERE b.status='confirmed' AND t.arrived_at IS NULL
    AND t.auto_cancelled=FALSE AND t.appointment_at <= DATE_ADD(?, INTERVAL 15 MINUTE)
    AND (t.reminder_sent=FALSE OR t.due_sent=FALSE OR t.appointment_at<=DATE_SUB(?, INTERVAL 15 MINUTE))`, [nowPH, nowPH]);
  for (const candidate of candidates) {
    const db = await pool.getConnection();
    try {
      await db.beginTransaction();
      // The same lock order as booking actions prevents arrival/cancellation races.
      const [salons] = await db.execute('SELECT id,name,owner_id FROM salons WHERE id=? FOR UPDATE',[candidate.salon_id]);
      const [bookings] = await db.execute("SELECT id,user_id,status,DATE_FORMAT(appointment_at,'%Y-%m-%d %H:%i:%s') AS slot FROM bookings WHERE id=? FOR UPDATE",[candidate.booking_id]);
      const booking = bookings[0], salon=salons[0];
      const [tracking] = await db.execute('SELECT * FROM appointment_tracking WHERE booking_id=? AND appointment_at=? FOR UPDATE',[candidate.booking_id,candidate.slot]);
      const track=tracking[0];
      if (!salon || !booking || booking.status!=='confirmed' || booking.slot!==candidate.slot || !track || track.arrived_at || track.auto_cancelled) { await db.commit(); continue; }
      const elapsed = now.getTime() - new Date(candidate.slot.replace(' ','T')+'+08:00').getTime();
      const notify = async (user,title,message,destination) => {
        if (user) await db.execute('INSERT INTO notifications (user_id,title,message,destination,reference_id) VALUES (?,?,?,?,?)',[user,title,message,destination,booking.id]);
      };
      if (elapsed >= 15 * 60000) {
        await db.execute("UPDATE bookings SET status='cancelled' WHERE id=?",[booking.id]);
        await db.execute('UPDATE appointment_tracking SET auto_cancelled=TRUE WHERE booking_id=? AND appointment_at=?',[booking.id,candidate.slot]);
        await db.execute("UPDATE booking_changes SET status='rejected' WHERE booking_id=? AND status='pending'",[booking.id]);
        await notify(booking.user_id,'Appointment cancelled — reschedule needed',`Booking #${booking.id} at ${salon.name} was cancelled because the salon had not marked you arrived within 15 minutes. Open My bookings to request a new schedule. Your payment record is retained.`,'bookings');
        await notify(salon.owner_id,'Appointment automatically cancelled',`Booking #${booking.id} passed the 15-minute arrival grace period without check-in. The client can request a new schedule.`,'owner-bookings');
      } else if (elapsed >= 0 && !track.due_sent) {
        await db.execute('UPDATE appointment_tracking SET due_sent=TRUE WHERE booking_id=? AND appointment_at=?',[booking.id,candidate.slot]);
        await notify(booking.user_id,'Your appointment starts now',`Your appointment at ${salon.name} starts now (booking #${booking.id}). Ask the salon to mark you arrived. Unattended appointments are cancelled after 15 minutes.`,'bookings');
        await notify(salon.owner_id,'Appointment starting now',`Booking #${booking.id} starts now. Mark the client arrived when present to prevent automatic cancellation.`,'owner-bookings');
      } else if (elapsed < 0 && elapsed >= -15 * 60000 && !track.reminder_sent) {
        await db.execute('UPDATE appointment_tracking SET reminder_sent=TRUE WHERE booking_id=? AND appointment_at=?',[booking.id,candidate.slot]);
        await notify(booking.user_id,'Appointment in 15 minutes',`Your appointment at ${salon.name} is at ${candidate.slot.slice(11,16)} Philippine time (booking #${booking.id}). Please arrive on time and check in with the salon.`,'bookings');
      }
      await db.commit();
    } catch (error) { await db.rollback(); throw error; }
    finally { db.release(); }
  }
}
function startAppointmentReminders(pool) {
  let running=false;
  const tick=async()=>{
    if (running) return;
    running=true;
    try { await processAppointmentReminders(pool); }
    catch (error) { console.error('Appointment reminders failed:',error.message); }
    finally { running=false; }
  };
  void tick();
  const timer=setInterval(()=>void tick(),30000);
  return ()=>clearInterval(timer);
}
module.exports={ensureAppointmentSchema,processAppointmentReminders,startAppointmentReminders,philippineDateTime};
