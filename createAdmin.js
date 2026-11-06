
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (question) => new Promise((resolve) => {
  rl.question(question, resolve);
});

async function createAdmin() {
  let connection;

  try {
    const fullName = (await ask('Enter administrator full name: ')).trim();
    const username = (await ask('Choose administrator username: ')).trim();
    const password = await ask('Choose a strong administrator password: ');

    if (!fullName || !username || password.length < 12) {
      throw new Error(
        'Full name and username are required. Password must be at least 12 characters.'
      );
    }

    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'batloung_fruits'
    });

    const [existing] = await connection.execute(
      'SELECT user_id FROM users WHERE username = ?',
      [username]
    );

    if (existing.length > 0) {
      throw new Error('That username already exists. Choose another username.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await connection.execute(
      `INSERT INTO users (full_name, username, password_hash, role)
       VALUES (?, ?, ?, 'Administrator')`,
      [fullName, username, passwordHash]
    );

    console.log('Administrator account created successfully!');
    console.log('Username:', username);
    console.log('Keep your password private.');
  } catch (error) {
    console.error('Could not create administrator:', error.message);
  } finally {
    if (connection) await connection.end();
    rl.close();
  }
}

createAdmin();
