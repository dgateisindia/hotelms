// backend/controllers/authController.js
const { createClerkClient } = require("@clerk/backend");
const crypto = require('crypto');
const db = require('../config/db');

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// ============================================================
//  NOTE ON AUTH ARCHITECTURE
// ============================================================
// All sign-in / sign-up / session / token-refresh logic is now handled
// entirely by Clerk on the frontend (signIn.create(), signUp.create(), etc.)
// and verified on the backend by the @clerk/express middleware
// (req.auth.userId). The old JWT access/refresh token system has been
// removed — there is no login(), refreshToken(), or manual bcrypt password
// check left in this file. MySQL only stores the app-specific profile
// (users / admins tables) keyed off Clerk's `clerk_id`.
// ============================================================

// ---- Super Admin registration (creates Clerk user + `admins` row) ----
// This is a one-time bootstrap action — only allowed if no super_admin
// exists yet. It creates the user in Clerk first (source of truth for
// credentials), then mirrors the profile into MySQL.
exports.registerSuperAdmin = async (req, res) => {
  const { full_name, email, password, confirmPassword } = req.body;

  if (!full_name || !email || !password || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [existingAdmin] = await connection.query('SELECT admin_id FROM admins WHERE email = ?', [email]);
    if (existingAdmin.length > 0) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const [superAdmins] = await connection.query("SELECT admin_id FROM admins WHERE role = 'super_admin'");
    if (superAdmins.length > 0) {
      await connection.rollback();
      return res.status(403).json({ success: false, message: 'Super admin already exists.' });
    }

    // Create the user in Clerk first — Clerk owns credentials now.
    let clerkUser;
    try {
      clerkUser = await clerkClient.users.createUser({
        emailAddress: [email],
        password,
        firstName: full_name,
      });

      // Mark the email verified so this account doesn't hit
      // needs_second_factor / unverified-email issues on first login.
      const emailAddressId = clerkUser.emailAddresses[0]?.id;
      if (emailAddressId) {
        await clerkClient.emailAddresses.updateEmailAddress(emailAddressId, {
          verified: true,
        });
      }
    } catch (clerkErr) {
      await connection.rollback();
      console.error('Clerk super admin creation error:', clerkErr);
      return res.status(400).json({
        success: false,
        message: clerkErr.errors?.[0]?.longMessage || 'Failed to create Clerk user.',
      });
    }

    const [userResult] = await connection.query(
      "INSERT INTO users (clerk_id, full_name, email, password, role, status) VALUES (?, ?, ?, NULL, 'super_admin', 'active')",
      [clerkUser.id, full_name, email]
    );
    const userId = userResult.insertId;

await connection.query(
`
INSERT INTO admins
(
    user_id,
    email,
    password,
    role,
    clerk_id
)
VALUES
(?,?,?,?,?)
`,
[
    userId,
    email,
    null,
    "super_admin",
    clerkUser.id,
]);

    await connection.commit();
    return res.status(201).json({
      success: true,
      message: 'Super admin registered successfully.',
      clerkId: clerkUser.id,
    });
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }
    console.error('Super admin registration error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  } finally {
    connection.release();
  }
};

// ---- Super Admin creates a Hotel ----
exports.createHotel = async (req, res) => {
  const {
    hotel_name, hotel_type, hotel_desc, star_rating,
    year_established, gst_number, pan_number, business_reg_number,
  } = req.body;

  if (!hotel_name) {
    return res.status(400).json({ success: false, message: 'Hotel name is required.' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO hotels
        (hotel_name, hotel_type, hotel_desc, star_rating, year_established,
         gst_number, pan_number, business_reg_number, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [hotel_name, hotel_type, hotel_desc, star_rating, year_established,
       gst_number, pan_number, business_reg_number]
    );

    return res.status(201).json({
      success: true,
      hotel_id: result.insertId,
      message: 'Hotel created successfully.',
    });
  } catch (err) {
    console.error('createHotel error:', err);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ---- Super Admin creates an Admin (Clerk-backed, temp password, must_change_password) ----
exports.registerAdmin = async (req, res) => {
  const { full_name, email, phone, hotel_id } = req.body;

  if (!full_name || !email || !hotel_id) {
    return res.status(400).json({
      success: false,
      message: "Full name, email and hotel ID are required.",
    });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Check if admin already exists in MySQL
    const [existing] = await connection.query(
      "SELECT user_id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      await connection.rollback();
      return res.status(409).json({
        success: false,
        message: "Email already exists.",
      });
    }

    // Temporary password
    const tempPassword = crypto.randomBytes(8).toString("hex");

    // Create user in Clerk
    const clerkUser = await clerkClient.users.createUser({
      emailAddress: [email],
      password: tempPassword,
      firstName: full_name,
    });

    // Mark email verified — backend-provisioned users otherwise hit
    // needs_second_factor / unverified email issues on first login.
    const emailAddressId = clerkUser.emailAddresses[0]?.id;
    if (emailAddressId) {
      await clerkClient.emailAddresses.updateEmailAddress(emailAddressId, {
        verified: true,
      });
    }

    // Get logged-in super admin
    const [creator] = await connection.query(
      "SELECT user_id FROM users WHERE clerk_id = ?",
      [req.auth.userId]
    );

    if (!creator.length) {
      await connection.rollback();

      return res.status(404).json({
        success: false,
        message: "Super admin not found.",
      });
    }

    const createdBy = creator[0].user_id;

    // Save in users table
    const [userResult] = await connection.query(
      `INSERT INTO users
      (clerk_id, full_name, email, phone, password, role, status)
      VALUES (?, ?, ?, ?, NULL, 'admin', 'active')`,
      [
        clerkUser.id,
        full_name,
        email,
        phone || null,
      ]
    );

    // Save in admins table
    await connection.query(
      `INSERT INTO admins
      (user_id, email, role, hotel_id, created_by, must_change_password)
      VALUES (?, ?, 'admin', ?, ?, true)`,
      [
        userResult.insertId,
        email,
        hotel_id,
        createdBy,
      ]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Admin created successfully.",
      temporaryPassword: tempPassword,
      clerkId: clerkUser.id,
    });

  } catch (err) {

    await connection.rollback();

    console.error("Register Admin Error:", err);

    return res.status(500).json({
      success: false,
      message: err.errors?.[0]?.longMessage || err.message,
    });

  } finally {

    connection.release();

  }
};
exports.clearMustChangePassword = async (req, res) => {
  try {
    await db.query(
      `UPDATE admins SET must_change_password = false WHERE user_id = ?`,
      [req.dbUser.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};