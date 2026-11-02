// All fixture writes share a transaction and are rolled back at the end.
require('dotenv').config({ quiet: true });
const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/db');
const { ensureBookingSchema, registerBookingRoutes } = require('../src/booking-routes');
const { registerStylistWorkspaceRoutes } = require('../src/stylist-workspace-routes');
const { registerStylistRoutes } = require('../src/stylist-routes');
const { philippineDateTime } = require('../src/services/appointment-reminders');

test('stylist workspace protects assignments, checks in clients, advances services, reviews reschedules and saves profiles', async () => {
  await ensureBookingSchema(pool);
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const insert = async (sql, args) => (await db.execute(sql, args))[0].insertId;
    const suffix = `${Date.now()}-${process.pid}`;
    const user = async (role, tag) => insert('INSERT INTO users(full_name,email,password_hash,role) VALUES (?,?,?,?)', [`Workspace ${tag}`, `${tag}-${suffix}@example.invalid`, 'fixture-no-login', role]);
    const owner = await user('owner', 'owner'), client = await user('customer', 'client'), otherClient = await user('customer', 'other-client');
    const stylist = await user('stylist', 'stylist'), otherStylist = await user('stylist', 'other-stylist');
    const salon = await insert("INSERT INTO salons(owner_id,name,address,city,opening_time,closing_time) VALUES (?,'Workspace test','Test address','Nasugbu','00:00','23:59')", [owner]);
    const staff = await insert('INSERT INTO stylists(user_id,salon_id,specialties) VALUES (?,?,?)', [stylist, salon, 'Bob, Fade']);
    await insert('INSERT INTO stylists(user_id,salon_id,specialties) VALUES (?,?,?)', [otherStylist, salon, 'Bob']);
    const service = await insert("INSERT INTO services(salon_id,name,price,duration_minutes) VALUES (?,'Test haircut',500,30)", [salon]);
    const slot = philippineDateTime(new Date(Math.ceil((Date.now() + 60000) / 60000) * 60000));
    const booking = await insert("INSERT INTO bookings(user_id,service_id,stylist_id,appointment_at,status) VALUES (?,?,?,?,'confirmed')", [client, service, staff, slot]);
    const handlers = new Map(); const app = {};
    for (const method of ['get', 'post', 'patch', 'put', 'delete']) app[method] = (path, auth, fn) => handlers.set(`${method.toUpperCase()} ${path}`, fn || auth);
    const scoped = { execute: db.execute.bind(db), beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {} };
    const scopedPool = { getConnection: async () => scoped, execute: db.execute.bind(db) };
    registerStylistWorkspaceRoutes(app, scopedPool, () => {}); registerBookingRoutes(app, scopedPool, () => {}); registerStylistRoutes(app, scopedPool, () => {});
    const call = async (key, role, sub, body = {}, params = { id: booking }) => {
      let status = 200, payload;
      await handlers.get(key)({ user: { role, sub }, body, params }, { status(code) { status = code; return this; }, json(value) { payload = value; } }, error => { throw error; });
      return { status, ...payload };
    };
    assert.equal(handlers.has('PATCH /api/stylist/appointments/:id/consultation'), false);
    assert.equal((await call('PATCH /api/stylist/appointments/:id/status', 'customer', client, { status: 'arrived' })).status, 403);
    assert.equal((await call('PATCH /api/stylist/appointments/:id/status', 'stylist', otherStylist, { status: 'arrived' })).status, 404);
    assert.equal((await call('PATCH /api/stylist/appointments/:id/status', 'stylist', stylist, { status: 'in_progress' })).status, 409);
    assert.equal((await call('POST /api/bookings/:id/arrival', 'customer', otherClient)).status, 404);
    assert.equal((await call('POST /api/bookings/:id/arrival', 'customer', client)).status, 200);
    assert.equal((await call('POST /api/bookings/:id/arrival', 'customer', client)).status, 200);
    const [notices] = await db.execute("SELECT id FROM notifications WHERE user_id=? AND reference_id=? AND title='Your client has arrived'", [stylist, booking]);
    assert.equal(notices.length, 1);
    assert.equal((await call('PATCH /api/stylist/appointments/:id/status', 'stylist', stylist, { status: 'no_show' })).status, 409);
    assert.equal((await call('PATCH /api/stylist/appointments/:id/status', 'stylist', stylist, { status: 'completed' })).status, 409);
    assert.equal((await call('PATCH /api/stylist/appointments/:id/status', 'stylist', stylist, { status: 'in_progress' })).status, 200);
    assert.equal((await call('PATCH /api/stylist/appointments/:id/status', 'stylist', stylist, { status: 'completed' })).status, 200);
    assert.equal((await call('POST /api/bookings/:id/stylist-review', 'customer', otherClient, { rating: 5, comment: 'Invalid' })).status, 403);
    assert.equal((await call('POST /api/bookings/:id/stylist-review', 'customer', client, { rating: 5, comment: 'Great haircut' })).status, 200);
    const profile = { fullName: 'Workspace Stylist', phone: '09123456789', specialties: 'Bob, Fade', description: 'Careful finishing.', experience: 'Haircut training.' };
    assert.equal((await call('PATCH /api/stylist/profile', 'stylist', stylist, profile)).status, 200);
    const settings = { isAvailable: true, weekly: Array.from({ length: 7 }, () => ({ enabled: true, start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' })), blocks: [] };
    assert.equal((await call('PUT /api/stylist/availability', 'stylist', stylist, settings)).status, 200);
    // Breaks cannot be bypassed by the waiting queue.
    let response = await call('POST /api/bookings', 'customer', client, { serviceId: service, stylistId: staff, appointmentAt: '2099-01-01 12:00:00', joinQueue: true }, {});
    assert.equal(response.status, 400);
    response = await call('POST /api/bookings', 'customer', client, { serviceId: service, stylistId: staff, appointmentAt: '2099-01-01 10:00:00', context: { hairstyle: 'Bob', faceShape: 'oval', hairLength: 'short' } }, {});
    assert.equal(response.status, 200); const pendingBooking = response.data.id;
    await db.execute('INSERT INTO booking_changes(booking_id,requested_at,reason) VALUES (?,?,?)', [pendingBooking, '2099-01-02 11:00:00', 'Test reschedule']);
    assert.equal((await call('PATCH /api/stylist/appointments/:id/reschedule', 'stylist', otherStylist, { status: 'approved' }, { id: pendingBooking })).status, 404);
    assert.equal((await call('PATCH /api/stylist/appointments/:id/reschedule', 'stylist', stylist, { status: 'approved' }, { id: pendingBooking })).status, 200);
    const changed = { ...settings, weekly: settings.weekly.map(day => ({ ...day, enabled: false })) };
    assert.equal((await call('PUT /api/stylist/availability', 'stylist', stylist, changed)).status, 409);
    const imageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
    assert.equal((await call('POST /api/stylist/portfolio', 'stylist', stylist, { caption: 'Bob', imageData, clientPermission: false })).status, 400);
    response = await call('POST /api/stylist/portfolio', 'stylist', stylist, { caption: 'Bob', imageData, clientPermission: true });
    assert.equal(response.status, 200); const photo = response.data.id;
    assert.equal((await call('DELETE /api/stylist/portfolio/:id', 'stylist', otherStylist, {}, { id: photo })).status, 404);
    response = await call('GET /api/stylist/dashboard', 'stylist', stylist);
    assert.equal(response.status, 200);
    assert.equal(response.data.bookings.length, 2); assert.equal(response.data.reviews[0].rating, 5);
    assert.equal(response.data.bookings.find(b => b.id === pendingBooking).context.hairLength, 'short');
    assert.equal(response.data.portfolio.length, 1); assert.equal(response.data.settings.experience, profile.experience);
    assert.equal((await call('DELETE /api/stylist/portfolio/:id', 'stylist', stylist, {}, { id: photo })).status, 200);
  } finally { await db.rollback(); db.release(); await pool.end(); }
});
