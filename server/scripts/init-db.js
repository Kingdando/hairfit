require('dotenv').config();

const fs = require('node:fs/promises');
const path = require('node:path');
const { Client } = require('pg');

async function initializeDatabase() {
  if (!process.env.SUPABASE_DB_URL) throw new Error('SUPABASE_DB_URL is required.');
  const schema = await fs.readFile(path.join(__dirname, '..', 'database', 'schema.supabase.sql'), 'utf8');
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: process.env.SUPABASE_DB_SSL === 'false' ? false : { rejectUnauthorized: false } });
  try { await client.connect(); await client.query(schema); console.log('Supabase database schema initialized successfully.'); }
  finally { await client.end(); }
}

initializeDatabase().catch((error) => {
  console.error('Database initialization failed:', error.message);
  process.exit(1);
});
