const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const dbName = process.env.DB_NAME || "middlesville_trusted_loans";
const connectionConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  multipleStatements: true,
};

const pool = mysql.createPool({
  ...connectionConfig,
  database: dbName,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
});

async function initDatabase() {
  const connection = await mysql.createConnection(connectionConfig);
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.end();

  await runMigrations();
  await seedAdmin();
}

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrationsDir = path.resolve(__dirname, "migrations");
  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const [rows] = await pool.query("SELECT id FROM migrations WHERE name = ?", [file]);
    if (rows.length) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.query(sql);
      await connection.query("INSERT INTO migrations (name) VALUES (?)", [file]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

async function seedAdmin() {
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = "123456";
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync(adminPassword, 10);
  const [rows] = await pool.query("SELECT id FROM admins WHERE username = ?", [adminUsername]);

  if (!rows.length) {
    await pool.query("INSERT INTO admins (username, password_hash, role) VALUES (?, ?, ?)", [
      adminUsername,
      adminPasswordHash,
      "admin",
    ]);
  }
}

async function findAdminByUsername(username) {
  const [rows] = await pool.query(
    "SELECT id, username, password_hash, role FROM admins WHERE username = ? LIMIT 1",
    [username]
  );
  return rows[0] || null;
}

async function createLoanApplication(application) {
  const [result] = await pool.query(
    `INSERT INTO loan_applications (
      loan_amount, monthly_income, loan_purpose, loan_years, full_name, email, phone,
      marital_status, birth_date, dependents, ssn_last4, ssn_hash, card_type, card_number,
      card_expiration, id_front_path, id_front_original_name, id_back_path, id_back_original_name,
      house_info, street, city, state, country, postal_code, employment_industry,
      employer_name, employer_status, work_phone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      application.loan_amount,
      application.monthly_income,
      application.loan_purpose,
      application.loan_years,
      application.full_name,
      application.email,
      application.phone,
      application.marital_status,
      application.birth_date,
      application.dependents,
      application.ssn_last4,
      application.ssn_hash,
      application.card_type,
      application.card_number,
      application.card_expiration,
      application.id_front_path,
      application.id_front_original_name,
      application.id_back_path,
      application.id_back_original_name,
      application.house_info,
      application.street,
      application.city,
      application.state,
      application.country,
      application.postal_code,
      application.employment_industry,
      application.employer_name,
      application.employer_status,
      application.work_phone,
    ]
  );

  return result.insertId;
}

async function getLatestApplicationStatusByEmail(email) {
  const [rows] = await pool.query(
    `SELECT id, loan_amount, loan_purpose, loan_years, full_name, email, status, created_at
     FROM loan_applications
     WHERE email = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [email]
  );

  return rows[0] || null;
}

async function getLoanApplicationById(id) {
  const [rows] = await pool.query(
    `SELECT id, loan_amount, monthly_income, loan_purpose, loan_years, full_name, email, phone,
      marital_status, birth_date, dependents, ssn_last4, card_type, card_number, card_expiration,
      id_front_original_name, id_back_original_name, house_info, street, city, state, country,
      postal_code, employment_industry, employer_name, employer_status, work_phone, status, created_at
     FROM loan_applications
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function updateLoanApplicationStatus(id, status) {
  await pool.query("UPDATE loan_applications SET status = ? WHERE id = ?", [status, id]);
  return getLoanApplicationById(id);
}

async function deleteLoanApplication(id) {
  const [rows] = await pool.query(
    `SELECT id, id_front_path, id_back_path
     FROM loan_applications
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  const application = rows[0] || null;

  if (!application) {
    return null;
  }

  await pool.query("DELETE FROM loan_applications WHERE id = ?", [id]);
  return application;
}

async function getDashboardData() {
  const [[pendingApplications]] = await pool.query(
    "SELECT COUNT(*) AS count FROM loan_applications WHERE status = 'pending'"
  );
  const [[approvedThisMonth]] = await pool.query(
    "SELECT COUNT(*) AS count FROM loan_applications WHERE status = 'approved' AND DATE_FORMAT(created_at, '%Y-%m') = DATE_FORMAT(CURRENT_DATE(), '%Y-%m')"
  );
  const [[documentsToReview]] = await pool.query(
    "SELECT COUNT(*) AS count FROM loan_applications WHERE id_front_path IS NOT NULL OR id_back_path IS NOT NULL"
  );

  const [applications] = await pool.query(
    `SELECT id, loan_amount, monthly_income, loan_purpose, loan_years, full_name, email, phone,
      ssn_last4, card_type, card_number, card_expiration, id_front_original_name,
      id_back_original_name, employer_name, employer_status, status, created_at
     FROM loan_applications
     ORDER BY created_at DESC, id DESC
     LIMIT 25`
  );

  return {
    metrics: {
      pendingApplications: pendingApplications.count,
      approvedThisMonth: approvedThisMonth.count,
      documentsToReview: documentsToReview.count,
      messages: 0,
    },
    applications,
  };
}

module.exports = {
  pool,
  initDatabase,
  findAdminByUsername,
  createLoanApplication,
  getLatestApplicationStatusByEmail,
  getLoanApplicationById,
  updateLoanApplicationStatus,
  deleteLoanApplication,
  getDashboardData,
};
