const { fail, validateSlot } = require('./services/booking-policy');
const { parse, validateSettings, allowsSlot, checkStylistAvailability } = require('./services/stylist-workspace');
const { philippineDateTime } = require('./services/appointment-reminders');

function registerStylistWorkspaceRoutes(app, pool, authenticate) {
  const action = handler => async (req, res, next) => {
    if (req.user.role !== 'stylist') return res.status(403).json({ error: 'Hairstylist access is required.' });
    let db;
    try {
      db = await pool.getConnection(); await db.beginTransaction();
      // Match the salon -> booking lock order used by the booking system.
      const [salons] = await db.execute(`SELECT s.* FROM salons s JOIN stylists st ON st.salon_id=s.id
        WHERE st.user_id=? AND st.deleted_at IS NULL AND s.is_active=TRUE FOR UPDATE`, [req.user.sub]);
      if (!salons[0]) fail('No active salon staff profile is linked to your account.', 404);
      const [staff] = await db.execute('SELECT * FROM stylists WHERE user_id=? AND deleted_at IS NULL FOR UPDATE', [req.user.sub]);
      const data = await handler(req, db, staff[0], salons[0]);
      await db.commit(); res.json({ data });
    } catch (error) { if (db) await db.rollback(); if (error.status) res.status(error.status).json({ error: error.message }); else next(error); }
    finally { db?.release(); }
  };
  async function assigned(req, db, staff) {
    const [rows] = await db.execute(`SELECT b.*, DATE_FORMAT(b.appointment_at,'%Y-%m-%d %H:%i:%s') AS slot,
      sv.duration_minutes FROM bookings b JOIN services sv ON sv.id=b.service_id
      WHERE b.id=? AND b.stylist_id=? FOR UPDATE`, [req.params.id, staff.id]);
    if (!rows[0]) fail('Assigned appointment not found.', 404);
    return rows[0];
  }
  async function notify(db, userId, title, message, destination, referenceId) {
    await db.execute('INSERT INTO notifications (user_id,title,message,destination,reference_id) VALUES (?,?,?,?,?)', [userId, title, message, destination, referenceId]);
  }
  app.patch('/api/stylist/profile', authenticate, action(async (req, db, staff) => {
    const { fullName, phone, specialties, description, experience } = req.body;
    if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.length > 120 || typeof phone !== 'string' || phone.length > 30 || typeof specialties !== 'string' || specialties.length > 255 || typeof description !== 'string' || description.length > 500 || typeof experience !== 'string' || experience.length > 300) fail('Check profile fields and character limits.');
    await db.execute('UPDATE users SET full_name=?,phone=? WHERE id=?', [fullName.trim(), phone.trim() || null, req.user.sub]);
    await db.execute('UPDATE stylists SET specialties=?,description=? WHERE id=?', [specialties.trim(), description.trim(), staff.id]);
    const [rows] = await db.execute('SELECT settings FROM stylist_settings WHERE stylist_id=?', [staff.id]);
    const settings = { ...parse(rows[0]?.settings), experience: experience.trim() };
    await db.execute('INSERT INTO stylist_settings(stylist_id,settings) VALUES (?,?) ON DUPLICATE KEY UPDATE settings=VALUES(settings)', [staff.id, JSON.stringify(settings)]);
    return { saved: true };
  }));
  app.put('/api/stylist/availability', authenticate, action(async (req, db, staff) => {
    const settings = validateSettings(req.body);
    if (typeof req.body.isAvailable !== 'boolean') fail('Choose whether to accept appointments.');
    const [bookings] = await db.execute(`SELECT DATE_FORMAT(b.appointment_at,'%Y-%m-%d %H:%i:%s') AS slot,sv.duration_minutes
      FROM bookings b JOIN services sv ON sv.id=b.service_id WHERE b.stylist_id=? AND b.status IN ('pending','confirmed')
      AND b.appointment_at>DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)`, [staff.id]);
    if (bookings.some(b => !allowsSlot(settings, b.slot, b.duration_minutes))) fail('This schedule conflicts with an existing appointment. Resolve or reschedule that appointment first.', 409);
    const [rows] = await db.execute('SELECT settings FROM stylist_settings WHERE stylist_id=?', [staff.id]);
    await db.execute('INSERT INTO stylist_settings(stylist_id,settings) VALUES (?,?) ON DUPLICATE KEY UPDATE settings=VALUES(settings)', [staff.id, JSON.stringify({ ...parse(rows[0]?.settings), ...settings })]);
    await db.execute('UPDATE stylists SET is_available=? WHERE id=?', [req.body.isAvailable, staff.id]);
    return { saved: true };
  }));
  app.patch('/api/stylist/appointments/:id/status', authenticate, action(async (req, db, staff) => {
    const booking = await assigned(req, db, staff);
    if (booking.status !== 'confirmed') fail('Only confirmed appointments can change service status.', 409);
    const [details] = await db.execute('SELECT stage,DATE_FORMAT(stage_slot,\'%Y-%m-%d %H:%i:%s\') AS slot FROM stylist_booking_details WHERE booking_id=?', [booking.id]);
    const [tracking] = await db.execute('SELECT arrived_at FROM appointment_tracking WHERE booking_id=? AND appointment_at=?', [booking.id, booking.slot]);
    const stage = details[0]?.slot === booking.slot ? details[0].stage : 'scheduled';
    const next = req.body.status;
    const elapsed = Date.now() - new Date(booking.slot.replace(' ', 'T') + '+08:00').getTime();
    if (next === 'arrived') {
      if (stage !== 'scheduled' || elapsed < -30 * 60000 || elapsed >= 15 * 60000) fail('Record arrival from 30 minutes before until 15 minutes after the appointment.', 409);
      await db.execute('INSERT INTO appointment_tracking(booking_id,appointment_at,arrived_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE arrived_at=COALESCE(arrived_at,VALUES(arrived_at))', [booking.id, booking.slot, philippineDateTime(new Date())]);
    } else if (next === 'in_progress') {
      if (!tracking[0]?.arrived_at || !['scheduled', 'arrived'].includes(stage)) fail('Record arrival before starting the service.', 409);
    } else if (next === 'completed') {
      if (stage !== 'in_progress') fail('Start the service before completing it.', 409);
      await db.execute("UPDATE bookings SET status='completed' WHERE id=?", [booking.id]);
    } else if (next === 'no_show') {
      if (tracking[0]?.arrived_at || elapsed < 15 * 60000) fail('No-show applies after the 15-minute grace period, without a recorded arrival.', 409);
      await db.execute("UPDATE bookings SET status='cancelled' WHERE id=?", [booking.id]);
      await db.execute('INSERT INTO appointment_tracking(booking_id,appointment_at,auto_cancelled) VALUES (?,?,TRUE) ON DUPLICATE KEY UPDATE auto_cancelled=TRUE', [booking.id, booking.slot]);
    } else fail('Choose a valid service status.');
    await db.execute('INSERT INTO stylist_booking_details(booking_id,stage,stage_slot) VALUES (?,?,?) ON DUPLICATE KEY UPDATE stage=VALUES(stage),stage_slot=VALUES(stage_slot)', [booking.id, next, booking.slot]);
    if (['completed', 'no_show'].includes(next)) {
      await db.execute('DELETE FROM booking_queue WHERE booking_id=?', [booking.id]);
      await db.execute("UPDATE booking_changes SET status='rejected' WHERE booking_id=? AND status='pending'", [booking.id]);
    }
    await notify(db, booking.user_id, 'Appointment update', `Your hairstylist marked booking #${booking.id} as ${next.replace('_', ' ')}.`, 'bookings', booking.id);
    return { saved: true };
  }));
  app.patch('/api/stylist/appointments/:id/reschedule', authenticate, action(async (req, db, staff, salon) => {
    const booking = await assigned(req, db, staff);
    const [changes] = await db.execute("SELECT *,DATE_FORMAT(requested_at,'%Y-%m-%d %H:%i:%s') AS slot FROM booking_changes WHERE booking_id=? AND status='pending' FOR UPDATE", [booking.id]);
    const change = changes[0]; if (!change) fail('No pending rescheduling request.', 404);
    if (!['approved', 'rejected'].includes(req.body.status)) fail('Choose approve or decline.');
    if (req.body.status === 'approved') {
      const [tracking] = await db.execute('SELECT arrived_at,auto_cancelled FROM appointment_tracking WHERE booking_id=? AND appointment_at=?', [booking.id, booking.slot]);
      if (tracking[0]?.arrived_at || booking.status === 'completed' || (booking.status === 'cancelled' && !tracking[0]?.auto_cancelled)) fail('This appointment cannot be rescheduled.', 409);
      validateSlot(change.slot, salon, booking.duration_minutes);
      await checkStylistAvailability(db, staff.id, change.slot, booking.duration_minutes);
      const [conflicts] = await db.execute(`SELECT b.id FROM bookings b JOIN services sv ON sv.id=b.service_id WHERE sv.salon_id=?
        AND b.id<>? AND b.status IN ('pending','confirmed') AND (b.stylist_id=? OR b.stylist_id IS NULL)
        AND b.appointment_at<DATE_ADD(?,INTERVAL ? MINUTE) AND DATE_ADD(b.appointment_at,INTERVAL sv.duration_minutes MINUTE)>? LIMIT 1`, [salon.id, booking.id, staff.id, change.slot, booking.duration_minutes, change.slot]);
      if (conflicts.length) fail('The requested time overlaps another appointment.', 409);
      const status = booking.status === 'cancelled' ? 'confirmed' : booking.status;
      await db.execute('UPDATE bookings SET appointment_at=?,status=? WHERE id=?', [change.slot, status, booking.id]);
      if (status === 'confirmed') await db.execute('INSERT IGNORE INTO appointment_tracking(booking_id,appointment_at) VALUES (?,?)', [booking.id, change.slot]);
    }
    await db.execute('UPDATE booking_changes SET status=? WHERE id=?', [req.body.status, change.id]);
    await notify(db, booking.user_id, 'Reschedule reviewed', `Your stylist ${req.body.status} the schedule request for booking #${booking.id}.`, 'bookings', booking.id);
    if (salon.owner_id) await notify(db, salon.owner_id, 'Stylist reviewed reschedule', `Booking #${booking.id}: ${req.body.status}.`, 'owner-bookings', booking.id);
    return { saved: true };
  }));
  app.post('/api/stylist/portfolio', authenticate, action(async (req, db, staff) => {
    const { caption, imageData, clientPermission } = req.body;
    if (clientPermission !== true) fail('Confirm client permission before uploading.');
    if (typeof caption !== 'string' || !caption.trim() || caption.length > 300 || typeof imageData !== 'string' || imageData.length > 6000000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(imageData)) fail('Add a caption and a JPEG, PNG or WebP image under 4 MB.');
    const [result] = await db.execute('INSERT INTO stylist_portfolio(stylist_id,caption,image_data,consent_at) VALUES (?,?,?,UTC_TIMESTAMP())', [staff.id, caption.trim(), imageData]);
    return { id: result.insertId };
  }));
  app.delete('/api/stylist/portfolio/:id', authenticate, action(async (req, db, staff) => {
    const [result] = await db.execute('DELETE FROM stylist_portfolio WHERE id=? AND stylist_id=?', [req.params.id, staff.id]);
    if (!result.affectedRows) fail('Portfolio image not found.', 404);
    return { deleted: true };
  }));
  // Customer check-in is tied to their own confirmed booking and notifies its assigned stylist.
  app.post('/api/bookings/:id/arrival', authenticate, async (req, res, next) => {
    let db;
    try {
      db = await pool.getConnection(); await db.beginTransaction();
      const [salons] = await db.execute(`SELECT s.id FROM salons s JOIN services sv ON sv.salon_id=s.id JOIN bookings b ON b.service_id=sv.id WHERE b.id=? AND b.user_id=? FOR UPDATE`, [req.params.id, req.user.sub]);
      if (!salons[0]) fail('Booking not found.', 404);
      const [rows] = await db.execute(`SELECT b.id,b.status,b.appointment_at,DATE_FORMAT(b.appointment_at,'%Y-%m-%d %H:%i:%s') AS slot,st.user_id AS stylistUserId FROM bookings b LEFT JOIN stylists st ON st.id=b.stylist_id WHERE b.id=? AND b.user_id=? FOR UPDATE`, [req.params.id, req.user.sub]);
      const booking = rows[0]; if (!booking) fail('Booking not found.', 404);
      const elapsed = Date.now() - new Date(booking.slot.replace(' ', 'T') + '+08:00').getTime();
      if (booking.status !== 'confirmed' || elapsed < -30 * 60000 || elapsed >= 15 * 60000) fail('Check in from 30 minutes before until 15 minutes after your confirmed appointment.', 409);
      const [existing] = await db.execute('SELECT arrived_at FROM appointment_tracking WHERE booking_id=? AND appointment_at=?', [booking.id, booking.slot]);
      await db.execute('INSERT INTO appointment_tracking(booking_id,appointment_at,arrived_at) VALUES (?,?,?) ON DUPLICATE KEY UPDATE arrived_at=COALESCE(arrived_at,VALUES(arrived_at))', [booking.id, booking.slot, philippineDateTime(new Date())]);
      if (!existing[0]?.arrived_at && booking.stylistUserId) await notify(db, booking.stylistUserId, 'Your client has arrived', `Client checked in for booking #${booking.id}.`, 'stylist-dashboard', booking.id);
      await db.commit(); res.json({ data: { arrived: true } });
    } catch (error) { if (db) await db.rollback(); if (error.status) res.status(error.status).json({ error: error.message }); else next(error); }
    finally { db?.release(); }
  });
  app.post('/api/bookings/:id/stylist-review', authenticate, async (req, res, next) => {
    try {
      const { rating, comment } = req.body;
      if (!Number.isInteger(rating) || rating < 1 || rating > 5 || typeof comment !== 'string' || comment.length > 1000) fail('Choose 1–5 stars and a comment under 1,000 characters.');
      const [rows] = await pool.execute("SELECT b.id,st.user_id AS stylistUserId,u.full_name AS customerName FROM bookings b JOIN stylists st ON st.id=b.stylist_id JOIN users u ON u.id=b.user_id WHERE b.id=? AND b.user_id=? AND b.stylist_id IS NOT NULL AND b.status='completed'", [req.params.id, req.user.sub]);
      if (!rows[0]) fail('Only your completed stylist appointments can be reviewed.', 403);
      await pool.execute('INSERT INTO stylist_reviews(booking_id,rating,comment) VALUES (?,?,?) ON DUPLICATE KEY UPDATE rating=VALUES(rating),comment=VALUES(comment)', [req.params.id, rating, comment.trim()]);
      await pool.execute("INSERT INTO notifications(user_id,title,message,destination,reference_id) VALUES(?, 'New client feedback', ?, 'stylist-dashboard', ?) ON DUPLICATE KEY UPDATE id=id", [rows[0].stylistUserId, `${rows[0].customerName} left ${rating}-star feedback.`, req.params.id]);
      res.json({ data: { saved: true } });
    } catch (error) { if (error.status) res.status(error.status).json({ error: error.message }); else next(error); }
  });
}
module.exports = { registerStylistWorkspaceRoutes };
