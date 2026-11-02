require('dotenv').config({ quiet: true });
const bcrypt = require('bcryptjs');
const pool = require('../src/db');
const descriptions = require('./stylist-descriptions.json');

async function main() {
  const [columns] = await pool.execute("SHOW COLUMNS FROM stylists LIKE 'description'");
  if (!columns.length) await pool.execute('ALTER TABLE stylists ADD COLUMN description VARCHAR(500) NULL');
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const [king] = await db.execute(`SELECT st.salon_id FROM stylists st JOIN users u ON u.id=st.user_id WHERE u.email=? AND st.deleted_at IS NULL`, ['king@gmail.com']);
    if (!king[0]) throw new Error('King must have an active staff profile first.');
    const specialties = 'Textured, Fringe, Fade, Taper, Layers, Layered, Bob, Pixie, Shag, Waves, Wavy, Curly, Crop, Quiff, Undercut, Pompadour, Crew, Buzz, Part, Slick, Bangs, Lob, Cut, Curtains, Mullet, Tapered, Sweep, Flow';
    for (const name of ['Alex', 'Marco', 'Sofia', 'Mia']) {
      const email = `facefit.demo.${name.toLowerCase()}@example.com`;
      const [existing] = await db.execute('SELECT id FROM users WHERE email=?', [email]);
      if (existing.length) throw new Error(`Account ${email} already exists; no accounts changed.`);
      const hash = await bcrypt.hash(`${name}123456`, 12);
      const [user] = await db.execute("INSERT INTO users (full_name,email,password_hash,role) VALUES (?,?,?,'stylist')", [name, email, hash]);
      await db.execute('INSERT INTO stylists (user_id,salon_id,specialties,is_available) VALUES (?,?,?,TRUE)', [user.insertId, king[0].salon_id, specialties]);
    }
    await db.execute(`UPDATE stylists st JOIN users u ON u.id=st.user_id SET st.specialties=? WHERE u.email=? AND (st.specialties IS NULL OR st.specialties='')`, [specialties, 'king@gmail.com']);
    for (const [email, description] of Object.entries(descriptions)) {
      await db.execute('UPDATE stylists st JOIN users u ON u.id=st.user_id SET st.description=? WHERE u.email=?', [description, email]);
    }
    await db.commit();
    console.log('Created four demo hairstylists in King’s salon and filled empty King specialties for the demo.');
  } catch (error) { await db.rollback(); throw error; }
  finally { db.release(); await pool.end(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
