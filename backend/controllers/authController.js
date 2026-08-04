const { createClerkClient } = require("@clerk/backend");
const db = require("../config/db").promisePool;

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

function normalizeOptionalPhone(phone) {
  if (phone === undefined || phone === null || phone === "") {
    return null;
  }

  return String(phone).trim();
}

/**
 * Creates the Super Admin profile in MySQL.
 *
 * Clerk already handles:
 * - Account creation
 * - Password storage
 * - Email verification
 * - Login sessions
 *
 * This controller stores only the HMS profile.
 */
exports.registerSuperAdmin = async (req, res) => {
  const clerkUserId = req.clerkAuth?.userId;
  const fullName = String(req.body.full_name || "").trim();
  const phone = normalizeOptionalPhone(req.body.phone);

  if (!clerkUserId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (!fullName) {
    return res.status(400).json({
      success: false,
      message: "Full name is required.",
    });
  }

  if (fullName.length > 150) {
    return res.status(400).json({
      success: false,
      message: "Full name must not exceed 150 characters.",
    });
  }

  if (phone && phone.length > 30) {
    return res.status(400).json({
      success: false,
      message: "Phone number must not exceed 30 characters.",
    });
  }

  let clerkUser;

  try {
    clerkUser = await clerkClient.users.getUser(clerkUserId);
  } catch (error) {
    console.error("Unable to read Clerk user:", error);

    return res.status(502).json({
      success: false,
      message: "Unable to verify the Clerk user.",
    });
  }

  const primaryEmail = clerkUser.emailAddresses.find(
    (emailAddress) =>
      emailAddress.id === clerkUser.primaryEmailAddressId
  );

  if (!primaryEmail?.emailAddress) {
    return res.status(400).json({
      success: false,
      message: "A primary email address is required.",
    });
  }

  if (primaryEmail.verification?.status !== "verified") {
    return res.status(403).json({
      success: false,
      message: "Verify your email address before registration.",
    });
  }

  const email = primaryEmail.emailAddress.trim().toLowerCase();

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    /*
     * Check whether this Clerk account or email is already present
     * in the Super Admin table.
     */
    const [existingSuperAdmins] = await connection.query(
      `
        SELECT
          superadmin_id,
          clerk_id,
          full_name,
          email,
          phone,
          role,
          status
        FROM superadmins
        WHERE clerk_id = ? OR email = ?
        FOR UPDATE
      `,
      [clerkUserId, email]
    );

    const existingSuperAdmin = existingSuperAdmins[0];

    /*
     * Return the existing profile for repeated registration requests.
     */
    if (existingSuperAdmin) {
      if (existingSuperAdmin.clerk_id !== clerkUserId) {
        await connection.rollback();

        return res.status(409).json({
          success: false,
          message: "This email is already linked to another account.",
        });
      }

      await connection.commit();

      return res.status(200).json({
        success: true,
        message: "Super Admin account is already registered.",
        user: {
          superadminId: existingSuperAdmin.superadmin_id,
          clerkId: existingSuperAdmin.clerk_id,
          fullName: existingSuperAdmin.full_name,
          email: existingSuperAdmin.email,
          phone: existingSuperAdmin.phone,
          role: existingSuperAdmin.role,
          status: existingSuperAdmin.status,
        },
      });
    }

    /*
     * A Clerk user or email cannot be both an Admin
     * and a Super Admin.
     */
    const [existingAdmins] = await connection.query(
      `
        SELECT admin_id
        FROM admins
        WHERE clerk_id = ? OR email = ?
        LIMIT 1
        FOR UPDATE
      `,
      [clerkUserId, email]
    );

    if (existingAdmins.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "This Clerk account is already registered as an Admin.",
      });
    }

    const [result] = await connection.query(
      `
        INSERT INTO superadmins
          (clerk_id, full_name, email, phone)
        VALUES (?, ?, ?, ?)
      `,
      [clerkUserId, fullName, email, phone]
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: "Super Admin registered successfully.",
      user: {
        superadminId: result.insertId,
        clerkId: clerkUserId,
        fullName,
        email,
        phone,
        role: "super_admin",
        status: "active",
      },
    });
  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "This Clerk account or email is already registered.",
      });
    }

    console.error("registerSuperAdmin error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to register the Super Admin.",
    });
  } finally {
    connection.release();
  }
};