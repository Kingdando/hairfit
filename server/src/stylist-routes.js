function registerStylistRoutes(app, pool, authenticate) {
  app.get('/api/stylists', async (req, res, next) => {
    try {
      const [staff] = await pool.execute(`SELECT st.id, u.full_name AS name, st.specialties, st.description,
        st.image_path AS imageUrl, st.is_available AS isAvailable, s.id AS salonId, s.name AS salonName
        FROM stylists st JOIN users u ON u.id=st.user_id JOIN salons s ON s.id=st.salon_id
        WHERE st.deleted_at IS NULL AND st.is_available=TRUE AND s.is_active=TRUE
        AND EXISTS (SELECT 1 FROM services sv WHERE sv.salon_id=s.id AND sv.is_active=TRUE AND sv.deleted_at IS NULL)
        ORDER BY u.full_name, st.id`);
      res.json({ data: staff });
    } catch (error) { next(error); }
  });
  app.get('/api/stylist/dashboard', authenticate, async (req, res, next) => {
    if (req.user.role !== 'stylist') return res.status(403).json({ error: 'Hairstylist access is required.' });
    try {
      const [staff] = await pool.execute(`SELECT st.id, st.specialties, st.description, st.is_available AS isAvailable,
        st.image_path AS imageUrl, s.name AS salonName, s.opening_time AS openingTime,s.closing_time AS closingTime,
        u.full_name AS fullName,u.phone,u.email,ss.settings FROM stylists st
        JOIN salons s ON s.id=st.salon_id JOIN users u ON u.id=st.user_id
        LEFT JOIN stylist_settings ss ON ss.stylist_id=st.id
        WHERE st.user_id=? AND st.deleted_at IS NULL AND s.is_active=TRUE`, [req.user.sub]);
      if (!staff[0]) return res.status(404).json({ error: 'No active salon staff profile is linked to your account. Contact your salon owner.' });
      const [bookings] = await pool.execute(`SELECT b.id,
        DATE_FORMAT(b.appointment_at,'%Y-%m-%d %H:%i:%s') AS appointmentAt, b.status, b.notes,
        u.id AS customerId, u.full_name AS customerName, u.phone AS customerPhone,
        sv.name AS serviceName, sv.duration_minutes AS durationMinutes,
        tr.arrived_at AS arrivedAt, tr.auto_cancelled AS autoCancelled,
        CASE WHEN wd.stage_slot=b.appointment_at THEN wd.stage ELSE 'scheduled' END AS stage,
        wd.context,
        bc.id AS changeRequestId, DATE_FORMAT(bc.requested_at,'%Y-%m-%d %H:%i:%s') AS requestedAppointmentAt,bc.reason AS changeReason,
        (q.booking_id IS NOT NULL) AS isQueued
        FROM bookings b JOIN services sv ON sv.id=b.service_id JOIN users u ON u.id=b.user_id
        LEFT JOIN booking_queue q ON q.booking_id=b.id
        LEFT JOIN appointment_tracking tr ON tr.booking_id=b.id AND tr.appointment_at=b.appointment_at
        LEFT JOIN stylist_booking_details wd ON wd.booking_id=b.id
        LEFT JOIN booking_changes bc ON bc.booking_id=b.id AND bc.status='pending'
        WHERE b.stylist_id=? ORDER BY b.appointment_at ASC, b.id ASC`, [staff[0].id]);
      const [portfolio] = await pool.execute('SELECT id,caption,image_data AS imageUrl,created_at AS createdAt FROM stylist_portfolio WHERE stylist_id=? ORDER BY created_at DESC LIMIT 30', [staff[0].id]);
      const [reviews] = await pool.execute(`SELECT r.rating,r.comment,r.created_at AS createdAt,u.full_name AS customerName
        FROM stylist_reviews r JOIN bookings b ON b.id=r.booking_id JOIN users u ON u.id=b.user_id WHERE b.stylist_id=? ORDER BY r.created_at DESC`, [staff[0].id]);
      const [notifications] = await pool.execute('SELECT id,title,message,is_read AS isRead,created_at AS createdAt,reference_id AS bookingId FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50', [req.user.sub]);
      const { parse } = require('./services/stylist-workspace');
      res.json({ data: { ...staff[0], settings: parse(staff[0].settings), bookings: bookings.map(b => ({ ...b, context: parse(b.context, null) })), portfolio, reviews, notifications } });
    } catch (error) { next(error); }
  });
}
module.exports = { registerStylistRoutes };
