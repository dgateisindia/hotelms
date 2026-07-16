const { createClerkClient } = require("@clerk/backend");
const db = require("../config/db");

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const createStaffUser = async (req, res) => {
  const connection = await db.getConnection();

  try {
    console.log("===== CREATE ADMIN START =====");
    console.log(req.body);

    const {
      fullName,
      email,
      phone,
      password,
      hotel,
    } = req.body;

    if (
      !fullName ||
      !email ||
      !phone ||
      !password ||
      !hotel
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    await connection.beginTransaction();

    // Check duplicate email
    const [existing] = await connection.query(
      "SELECT user_id FROM users WHERE email=?",
      [email]
    );

    if (existing.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        success: false,
        message: "Email already exists",
      });
    }

    console.log("Creating Clerk user...");

    const clerkUser = await clerkClient.users.createUser({
      emailAddress: [email],
      password,
      firstName: fullName,
      skipPasswordChecks: true,
    });

    console.log("Clerk user created:", clerkUser.id);

    // Create hotel
    const [hotelResult] = await connection.query(
      `
      INSERT INTO hotels
      (
        hotel_name,
        hotel_type,
        hotel_desc,
        star_rating,
        year_established,
        gst_number,
        pan_number,
        business_reg_number
      )
      VALUES (?,?,?,?,?,?,?,?)
      `,
      [
        hotel.hotel_name,
        hotel.hotel_type,
        hotel.hotel_desc,
        hotel.star_rating,
        hotel.year_established,
        hotel.gst_number,
        hotel.pan_number,
        hotel.business_reg_number,
      ]
    );

    const hotelId = hotelResult.insertId;

    console.log("Hotel created:", hotelId);

    // Create user
    const [userResult] = await connection.query(
      `
      INSERT INTO users
      (
        clerk_id,
        full_name,
        email,
        phone,
        role,
        status
      )
      VALUES
      (?,?,?,?,?,?)
      `,
      [
        clerkUser.id,
        fullName,
        email,
        phone,
        "admin",
        "active",
      ]
    );

    const userId = userResult.insertId;

    console.log("User created:", userId);

    // Create admin
  // Create admin
await connection.query(
  `
  INSERT INTO admins
  (
    user_id,
    hotel_id,
    email,
    password,
    role,
    clerk_id,
    must_change_password
  )
  VALUES
  (?,?,?,?,?,?,?)
  `,
  [
    userId,
    hotelId,
    email,
    password,        // Store this only if your design requires it.
    "admin",
    clerkUser.id,
    1,
  ]
);

    await connection.commit();

    console.log("===== SUCCESS =====");

    return res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: {
        clerkId: clerkUser.id,
        hotelId,
        userId,
      },
    });

  } catch (err) {
    await connection.rollback();

    console.error("CREATE ADMIN ERROR");
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });

  } finally {
    connection.release();
  }
};
module.exports = {
  createStaffUser,
};