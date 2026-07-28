console.log('PASSWORD LOADED:', process.env.DB_PASSWORD);
const mysql = require('mysql2'); // callback-style base import

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Quick connectivity check at startup (callback style works here since pool is callback-based)
pool.query('SELECT 1', (err) => {
  if (err) console.log('Database connection failed:', err);
  else console.log('MySQL connected');
});

// Default export: callback-style pool.
// Used by controllers written as db.query(sql, values, (err, result) => {...})
// e.g. customerRequestController.js and most other controllers.
module.exports = pool;

// Promise-style pool, attached as a property on the same export.
// Used by controllers written with async/await, e.g. bookingController.js
// (await db.query(...), await db.getConnection(), connection.beginTransaction()).
module.exports.promisePool = pool.promise();