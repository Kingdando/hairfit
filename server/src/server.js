require('dotenv').config();

const app = require('./app');
const pool = require('./db');

const port = Number(process.env.PORT || 4000);
let server;
let stopReminders;
require('./booking-routes').ensureBookingSchema(pool).then(() => {
  stopReminders = require('./services/appointment-reminders').startAppointmentReminders(pool);
  server = app.listen(port, () => console.log(`FaceFit API running at http://localhost:${port}`));
}).catch(async error => {
  console.error('Booking migration failed:', error.message || error.code || error.name || 'Unknown error');
  for (const cause of error.errors || []) {
    console.error(`  ${cause.code || 'Connection error'}: ${cause.message || `${cause.address}:${cause.port}`}`);
  }
  if ([error, ...(error.errors || [])].some(cause => ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(cause.code))) {
    console.error('Check that SUPABASE_DB_URL points to the Supabase Postgres connection string.');
  }
  await pool.end();
  process.exit(1);
});

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
