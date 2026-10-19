require('dotenv').config();

const app = require('./app');
const pool = require('./db');

const port = Number(process.env.PORT || 4000);
let server;
let stopReminders;
require('./booking-routes').ensureBookingSchema(pool).then(() => {
  stopReminders = require('./services/appointment-reminders').startAppointmentReminders(pool);
  server = app.listen(port, () => console.log(`FaceFit API running at http://localhost:${port}`));
}).catch(error => { console.error('Booking migration failed:', error.message); process.exit(1); });

async function shutdown(signal) {
  console.log(`${signal} received. Closing FaceFit API...`);
  stopReminders?.();
  server?.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
