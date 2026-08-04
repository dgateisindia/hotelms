const { getAuth } = require("@clerk/express");
const db = require("../config/db").promisePool;

/**
 * Verifies that Clerk has authenticated the request.
 *
 * clerkMiddleware() must already be registered in server.js
 * before this middleware is used.
 */
function requireClerkSession(req, res, next) {
  const auth = getAuth(req);

  if (!auth.isAuthenticated || !auth.userId) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  req.clerkAuth = {
    userId: auth.userId,
    sessionId: auth.sessionId,
  };

  return next();
}

/**
 * Finds the authenticated Clerk user inside the HMS database.
 *
 * Super Admin:
 *   superadmins.clerk_id
 *
 * Admin:
 *   admins.clerk_id
 *
 * Passwords and Clerk sessions are never read from or stored in MySQL.
 */
function attachDbUser() {
  return async (req, res, next) => {
    try {
      const clerkUserId =
        req.clerkAuth?.userId ||
        getAuth(req).userId;

      if (!clerkUserId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required.",
        });
      }

      const [accounts] = await db.query(
        `
          SELECT
            'super_admin' AS role,
            superadmin_id,
            NULL AS admin_id,
            NULL AS hotel_id,
            full_name,
            email,
            status
          FROM superadmins
          WHERE clerk_id = ?

          UNION ALL

          SELECT
            'admin' AS role,
            NULL AS superadmin_id,
            admin_id,
            hotel_id,
            full_name,
            email,
            status
          FROM admins
          WHERE clerk_id = ?
        `,
        [clerkUserId, clerkUserId]
      );

      if (accounts.length === 0) {
        return res.status(403).json({
          success: false,
          message: "No HMS account is linked to this Clerk user.",
        });
      }

      /*
       * A Clerk user must never be linked to both a Super Admin
       * and an Admin account.
       */
      if (accounts.length > 1) {
        console.error(
          `Security error: Clerk user ${clerkUserId} is linked to multiple HMS accounts.`
        );

        return res.status(500).json({
          success: false,
          message: "Account configuration error.",
        });
      }

      const account = accounts[0];

      if (account.status !== "active") {
        return res.status(403).json({
          success: false,
          message: "This account is inactive.",
        });
      }

      req.dbUser = {
        clerkId: clerkUserId,
        role: account.role,

        superadminId: account.superadmin_id,
        adminId: account.admin_id,
        hotelId: account.hotel_id,

        fullName: account.full_name,
        email: account.email,
        status: account.status,
      };

      return next();
    } catch (error) {
      console.error("attachDbUser error:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to verify the HMS account.",
      });
    }
  };
}

/**
 * Restricts a route to one or more HMS roles.
 *
 * Examples:
 * requireRole("super_admin")
 * requireRole("super_admin", "admin")
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.dbUser) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!allowedRoles.includes(req.dbUser.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource.",
      });
    }

    return next();
  };
}

module.exports = {
  requireClerkSession,
  attachDbUser,
  requireRole,
};