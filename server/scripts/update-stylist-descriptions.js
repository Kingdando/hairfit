require('dotenv').config({ quiet: true });
const pool = require('../src/db');
const descriptions = require('./stylist-descriptions.json');
async function main() {
  const [columns] = await pool.execute("SHOW COLUMNS FROM stylists LIKE 'description'");
  if (!columns.length) await pool.execute('ALTER TABLE stylists ADD COLUMN description VARCHAR(500) NULL');
  for (const [email, description] of Object.entries(descriptions)) {
    await pool.execute('UPDATE stylists st JOIN users u ON u.id=st.user_id SET st.description=? WHERE u.email=? AND u.role=?', [description, email, 'stylist']);
  }
  console.log('Updated the five stylist descriptions.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => pool.end());
