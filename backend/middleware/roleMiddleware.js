const db = require("../config/db").promisePool;

function attachDbUser() {
  return async (req, res, next) => {
    try {
      console.log("\n========== attachDbUser ==========");

      const auth =
        typeof req.auth === "function"
          ? req.auth()
          : req.auth;

      console.log("req.auth =", auth);

      const { userId } = auth || {};

      console.log("Clerk userId =", userId);

      if (!userId) {
        console.log("❌ No Clerk userId found");
        return res.status(401).json({
          success: false,
          message: "Not authenticated.",
        });
      }

      // --------------------------------------------------
      // CHECK ADMINS TABLE
      // --------------------------------------------------

      const [adminRows] = await db.query(
        `
        SELECT
          admin_id,
          user_id,
          email,
          role,
          hotel_id,
          clerk_id,
          must_change_password
        FROM admins
        WHERE clerk_id = ?
        `,
        [userId]
      );

      console.log("Admins Found:", adminRows.length);
      console.log(adminRows);

      if (adminRows.length > 0) {
        const row = adminRows[0];

        req.dbUser = {
          userId: row.user_id,
          adminId: row.admin_id,
          email: row.email,
          role: row.role,
          hotelId: row.hotel_id,
          fullName: null,
          status: "active",
          mustChangePassword: !!row.must_change_password,
        };

        console.log("✅ Logged in as ADMIN");
        console.log(req.dbUser);

        return next();
      }

      // --------------------------------------------------
      // CHECK USERS TABLE
      // --------------------------------------------------

      const [userRows] = await db.query(
        `
        SELECT
            u.user_id,
            u.full_name,
            u.email,
            u.role AS user_role,
            u.status,
            u.clerk_id,

            a.admin_id,
            a.role AS admin_role,
            a.hotel_id,
            a.must_change_password

        FROM users u

        LEFT JOIN admins a
               ON a.user_id = u.user_id

        WHERE u.clerk_id = ?
        `,
        [userId]
      );

      console.log("Users Found:", userRows.length);
      console.log(userRows);

      if (!userRows.length) {
        console.log("❌ No account found for Clerk ID:", userId);

        return res.status(404).json({
          success: false,
          message: "No matching account found.",
        });
      }

      const row = userRows[0];

      req.dbUser = {
        userId: row.user_id,
        adminId: row.admin_id,
        fullName: row.full_name,
        email: row.email,
        role: row.admin_role || row.user_role,
        hotelId: row.hotel_id,
        status: row.status,
        mustChangePassword: !!row.must_change_password,
      };

      console.log("✅ Logged in as USER");
      console.log(req.dbUser);

      next();

    } catch (err) {
      console.error("attachDbUser ERROR");
      console.error(err);

      res.status(500).json({
        success: false,
        message: "Server error.",
      });
    }
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.dbUser) {
      return res.status(401).json({
        success: false,
        message: "No user attached.",
      });
    }

    console.log(
      "Role Check:",
      req.dbUser.role,
      "Allowed:",
      roles
    );

    if (!roles.includes(req.dbUser.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden.",
      });
    }

    next();
  };
}

module.exports = {
  attachDbUser,
  requireRole,
};