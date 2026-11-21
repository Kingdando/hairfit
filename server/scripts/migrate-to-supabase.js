require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { Client } = require('pg');

const tables = [
  'users', 'customer_profiles', 'salons', 'stylists', 'services', 'salon_hairstyles', 'bookings',
  'face_analyses', 'saved_hairstyles', 'favorite_salons', 'notifications', 'reviews', 'salon_portfolio_images',
  'review_replies', 'privacy_settings', 'booking_deposits', 'booking_changes', 'booking_queue',
  'stylist_settings', 'stylist_booking_details', 'stylist_portfolio', 'stylist_reviews', 'appointment_tracking',
];
const quote = value => `"${String(value).replace(/"/g, '""')}"`;
const quoteMysql = value => `\`${String(value).replace(/`/g, '``')}\``;
const booleanColumns = new Set(['is_active', 'is_available', 'is_read', 'notifications_enabled', 'save_scan_history', 'reminder_sent', 'due_sent', 'auto_cancelled']);

async function main() {
  if (!process.env.SUPABASE_DB_URL) throw new Error('Set SUPABASE_DB_URL for the target Supabase database.');
  const source = await mysql.createConnection({ host: process.env.SOURCE_DB_HOST || process.env.DB_HOST || 'localhost', port: Number(process.env.SOURCE_DB_PORT || process.env.DB_PORT || 3306), user: process.env.SOURCE_DB_USER || process.env.DB_USER || 'root', password: process.env.SOURCE_DB_PASSWORD ?? process.env.DB_PASSWORD ?? '', database: process.env.SOURCE_DB_NAME || process.env.DB_NAME || 'facefit' });
  const target = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: process.env.SUPABASE_DB_SSL === 'false' ? false : { rejectUnauthorized: false } });
  try {
    await target.connect();
    const schema = await fs.readFile(path.join(__dirname, '..', 'database', 'schema.supabase.sql'), 'utf8');
    await target.query(schema);
    await target.query('BEGIN');
    for (const table of tables) {
      const [available] = await source.query('SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?', [table]);
      if (!available.length) { console.log(`Skipped missing legacy table ${table}`); continue; }
      const [rows, fields] = await source.query(`SELECT * FROM ${quoteMysql(table)}`);
      if (!rows.length) continue;
      const columns = fields.map(field => field.name);
      for (const row of rows) {
        const values = columns.map(column => {
          if (row[column] === undefined) return null;
          if (booleanColumns.has(column)) return Boolean(Number(row[column]));
          return row[column];
        });
        const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
        await target.query(`INSERT INTO ${quote(table)} (${columns.map(quote).join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
      }
      console.log(`Migrated ${rows.length} rows from ${table}`);
    }
    for (const table of tables) {
      await target.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${quote(table)}), 1), true) WHERE pg_get_serial_sequence('${table}', 'id') IS NOT NULL`);
    }
    await target.query('COMMIT');
    console.log('Supabase migration completed successfully.');
  } catch (error) {
    await target.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { await source.end(); await target.end(); }
}
main().catch(error => { console.error('Supabase migration failed:', error.message); process.exit(1); });
