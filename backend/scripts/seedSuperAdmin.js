// scripts/seedSuperAdmin.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { createClerkClient } = require('@clerk/backend');
const db = require('../config/db');

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function seedSuperAdmin() {
  const email = 'dgateengine@gmail.com';
  const password = process.env.SUPER_ADMIN_SEED_PASSWORD;

  // 1. Check if the Clerk user already exists
  const existing = await clerkClient.users.getUserList({ emailAddress: [email] });

  let clerkUser;
  if (existing.data.length > 0) {
    clerkUser = existing.data[0];
    console.log('ℹ️ Clerk user already exists, reusing:', clerkUser.id);
  } else {
    clerkUser = await clerkClient.users.createUser({
      emailAddress: [email],
      password,
    });
    console.log('✅ Created new Clerk user:', clerkUser.id);
  }

  // 2. Insert matching row in MySQL `admins` table (matches your actual schema)
  await db.query(
    `INSERT INTO admins (email, password, role, clerk_id)
     VALUES (?, ?, 'super_admin', ?)`,
    [email, 'managed_by_clerk', clerkUser.id]
  );

  console.log('✅ Super admin row inserted for:', clerkUser.id);
}

seedSuperAdmin();