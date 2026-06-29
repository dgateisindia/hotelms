const bcrypt = require('bcrypt');
const db = require('../config/db');

const seedSuperAdmin = async () => {
  const name = 'Super Admin';
  const email = 'superadmin@hotelierpms.com'; // change this
  const plainPassword = 'ChangeThisPassword123!'; // change this, then delete/rotate after first login

  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  try {
    await db.query(
      `INSERT INTO users (name, email, password, role, created_at) VALUES (?, ?, ?, 'super_admin', NOW())`,
      [name, email, hashedPassword]
    );
    console.log('Super admin created successfully');
  } catch (err) {
    console.error('Error seeding super admin:', err);
  } finally {
    process.exit();
  }
};

seedSuperAdmin();