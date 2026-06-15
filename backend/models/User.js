const db = require('../config/db');

class User {
  static async findByEmail(email) {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  }

  static async create({ name, email, password, role }) {
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, password, role || 'staff']
    );
    return result;
  }
}

module.exports = User;
