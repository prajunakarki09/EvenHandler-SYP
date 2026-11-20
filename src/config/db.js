const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('./env');
const { ROLES } = require('../constants/roles');
const { hashPasswordSync } = require('../utils/password');

// Resolve database path
const fullDbPath = path.isAbsolute(config.dbPath)
  ? config.dbPath
  : path.resolve(__dirname, '../../', config.dbPath);

// Ensure the directory for the database exists
const dbDir = path.dirname(fullDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Connect to SQLite
const db = new DatabaseSync(fullDbPath);

// Enable WAL mode for better concurrency and enforce foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Run a SQL statement (INSERT, UPDATE, DELETE)
 * @param {string} sql 
 * @param {Array} [params] 
 * @returns {{ changes: number, lastInsertRowid: number | bigint }}
 */
function run(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.run(...params);
}

/**
 * Query a single row from database
 * @param {string} sql 
 * @param {Array} [params] 
 * @returns {object|null}
 */
function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  const result = stmt.get(...params);
  return result ? { ...result } : null;
}

/**
 * Query multiple rows from database
 * @param {string} sql 
 * @param {Array} [params] 
 * @returns {Array<object>}
 */
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  return stmt.all(...params).map((row) => ({ ...row }));
}

/**
 * Initialize database schema and default seeds
 */
function initDb() {
  const schemaPath = path.resolve(__dirname, '../../database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Execute schema definitions
  db.exec(schemaSql);

  // Seed default roles if not already present
  const rolesToSeed = [
    { name: ROLES.CUSTOMER, desc: 'Public customer who registers to browse packages and book events' },
    { name: ROLES.ORGANIZER, desc: 'Event organizer or staff coordinating event logistics and activities' },
    { name: ROLES.ADMIN, desc: 'System administrator overseeing users, reports, and platform settings' },
  ];

  for (const r of rolesToSeed) {
    const existing = queryOne('SELECT id FROM roles WHERE name = ?', [r.name]);
    if (!existing) {
      run('INSERT INTO roles (name, description) VALUES (?, ?)', [r.name, r.desc]);
    }
  }

  // Retrieve seeded role IDs
  const adminRole = queryOne('SELECT id FROM roles WHERE name = ?', [ROLES.ADMIN]);
  const organizerRole = queryOne('SELECT id FROM roles WHERE name = ?', [ROLES.ORGANIZER]);
  const customerRole = queryOne('SELECT id FROM roles WHERE name = ?', [ROLES.CUSTOMER]);

  // Seed default Admin user: admin@eventhub.com / Admin@12345
  if (adminRole) {
    const existingAdmin = queryOne('SELECT id FROM users WHERE email = ?', ['admin@eventhub.com']);
    if (!existingAdmin) {
      const defaultAdminPass = hashPasswordSync('Admin@12345');
      run(
        `INSERT INTO users (role_id, name, email, phone, password_hash, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [adminRole.id, 'System Administrator', 'admin@eventhub.com', '+1-555-0100', defaultAdminPass]
      );
    }
  }

  // Seed default Organizer user: organizer@eventhub.com / Organizer@12345
  if (organizerRole) {
    const existingOrg = queryOne('SELECT id FROM users WHERE email = ?', ['organizer@eventhub.com']);
    if (!existingOrg) {
      const defaultOrgPass = hashPasswordSync('Organizer@12345');
      run(
        `INSERT INTO users (role_id, name, email, phone, password_hash, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [organizerRole.id, 'Lead Event Organizer', 'organizer@eventhub.com', '+1-555-0101', defaultOrgPass]
      );
    }
  }

  // Seed demo Customer user: customer@eventhub.com / Customer@12345
  if (customerRole) {
    const existingCust = queryOne('SELECT id FROM users WHERE email = ?', ['customer@eventhub.com']);
    if (!existingCust) {
      const defaultCustPass = hashPasswordSync('Customer@12345');
      run(
        `INSERT INTO users (role_id, name, email, phone, password_hash, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [customerRole.id, 'Demo Customer', 'customer@eventhub.com', '+1-555-0102', defaultCustPass]
      );
    }
  }
}

// Auto-initialize when module is loaded
initDb();

module.exports = {
  db,
  run,
  queryOne,
  queryAll,
  initDb,
};
