
console.log('PASSWORD LOADED:', process.env.DB_PASSWORD);
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Enable promise-based queries so `await db.query(...)` works in controllers
const db = pool.promise();

// Quick connectivity check at startup (pools don't need an explicit .connect())
db.query('SELECT 1')
  .then(() => console.log('MySQL connected'))
  .catch((err) => console.log('Database connection failed:', err));

module.exports = db;