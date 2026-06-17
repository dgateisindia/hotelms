require('dotenv').config();

const bcrypt = require('bcryptjs');
const db = require('./config/db');

async function seedAdmin() {
  try {
    const hash = await bcrypt.hash('Admin@123', 10);

    console.log('Generated hash:', hash);

    await db.query(
      `INSERT INTO users(name,email,password,role)
       VALUES(?,?,?,?)`,
      [
        'Admin',
        'admin@hotel.com',
        hash,
        'admin'
      ]
    );

    console.log('Admin created successfully');
    process.exit(0);

  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedAdmin();