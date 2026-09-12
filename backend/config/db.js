const mysql = require("mysql2");

/* ============================================================
   DATABASE ENVIRONMENT VALIDATION
============================================================ */

const requiredEnvironmentVariables = [
  "DB_HOST",
  "DB_USER",
  "DB_NAME",
];

const missingEnvironmentVariables =
  requiredEnvironmentVariables.filter(
    (variableName) =>
      !String(
        process.env[variableName] || ""
      ).trim()
  );

if (
  missingEnvironmentVariables.length > 0
) {
  throw new Error(
    `Missing database environment variables: ${missingEnvironmentVariables.join(
      ", "
    )}`
  );
}

/* ============================================================
   DATABASE CONFIGURATION
============================================================ */

const configuredPort =
  Number.parseInt(
    process.env.DB_PORT,
    10
  );

const configuredConnectionLimit =
  Number.parseInt(
    process.env.DB_CONNECTION_LIMIT,
    10
  );

const pool = mysql.createPool({
  host: process.env.DB_HOST,

  port:
    Number.isInteger(configuredPort) &&
    configuredPort > 0
      ? configuredPort
      : 3306,

  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,

  connectionLimit:
    Number.isInteger(
      configuredConnectionLimit
    ) &&
    configuredConnectionLimit > 0
      ? configuredConnectionLimit
      : 10,

  queueLimit: 0,

  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

/* ============================================================
   SAFE STARTUP CONNECTION CHECK

   Never log:
   - Database password
   - Connection URI
   - Clerk secrets
============================================================ */

pool.query(
  "SELECT 1 AS health_check",
  (error) => {
    if (error) {
      console.error(
        `[DATABASE] MySQL connection failed: ${
          error.code ||
          "UNKNOWN_DATABASE_ERROR"
        }`
      );

      return;
    }

    console.log(
      "[DATABASE] MySQL connected."
    );
  }
);

/* ============================================================
   EXPORTS

   Callback controllers:
   const db = require("../config/db");

   Async controllers:
   const db =
     require("../config/db").promisePool;
============================================================ */

module.exports = pool;
module.exports.promisePool =
  pool.promise();