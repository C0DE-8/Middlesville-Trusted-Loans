const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
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

async function findAgentByEmail(email) {
  const [rows] = await pool.query(
    `SELECT id, referral_code, full_name, email, phone, company_name, password_hash, status, last_login_at, created_at
     FROM agents
     WHERE email = ?
     LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

async function findAgentById(id) {
  const [rows] = await pool.query(
    `SELECT id, referral_code, full_name, email, phone, company_name, status, last_login_at, created_at
     FROM agents
     WHERE id = ?
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function findAgentByReferralCode(referralCode) {
  const [rows] = await pool.query(
    `SELECT id, referral_code, full_name, email, phone, company_name, status, last_login_at, created_at
     FROM agents
     WHERE referral_code = ?
     LIMIT 1`,
    [referralCode]
  );
  return rows[0] || null;
}

function createReferralCode(fullName) {
  const prefix = String(fullName || "agent")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 8)
    .toUpperCase() || "AGENT";
  return `${prefix}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function createAgent(agent) {
  let result;

  for (let attempts = 0; attempts < 5; attempts += 1) {
    try {
      [result] = await pool.query(
        `INSERT INTO agents (referral_code, full_name, email, phone, company_name, password_hash)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          createReferralCode(agent.full_name),
          agent.full_name,
          agent.email,
          agent.phone || null,
          agent.company_name || null,
          agent.password_hash,
        ]
      );
      break;
    } catch (error) {
      if (error && error.code === "ER_DUP_ENTRY" && attempts < 4) {
        continue;
      }
      throw error;
    }
  }

  return findAgentById(result.insertId);
}

async function updateAgentLastLogin(id) {
  await pool.query("UPDATE agents SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [id]);
}

async function getAgentDashboardData(agentId) {
  const agent = await findAgentById(agentId);
  const settings = await getReferralSettings();
  const [[totalReferrals]] = await pool.query(
    "SELECT COUNT(*) AS count FROM loan_applications WHERE agent_id = ?",
    [agentId]
  );
  const [[pendingApplications]] = await pool.query(
    "SELECT COUNT(*) AS count FROM loan_applications WHERE agent_id = ? AND status = 'pending'",
    [agentId]
  );
  const [[approvedApplications]] = await pool.query(
    "SELECT COUNT(*) AS count FROM loan_applications WHERE agent_id = ? AND status = 'approved'",
    [agentId]
  );
  const [applications] = await pool.query(
    `SELECT id, loan_amount, loan_purpose, full_name, email, status, created_at
     FROM loan_applications
     WHERE agent_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 10`,
    [agentId]
  );
  const earnedCycles = settings.required_approved_applications > 0
    ? Math.floor(approvedApplications.count / settings.required_approved_applications)
    : 0;

  return {
    agent,
    settings,
    metrics: {
      referrals: totalReferrals.count,
      pendingApplications: pendingApplications.count,
      approvedApplications: approvedApplications.count,
      qualifiedCycles: earnedCycles,
      estimatedEarnings: Number(settings.payout_amount) * earnedCycles,
      messages: 0,
    },
    applications,
    recentActivity: [
      "Agent account is active",
      "Referral earnings count approved loan applications",
      "Share your referral link with borrowers before they apply",
    ],
  };
}

async function getReferralSettings() {
  const [rows] = await pool.query(
    `SELECT required_approved_applications, payout_amount, updated_at
     FROM referral_settings
     WHERE id = 1
     LIMIT 1`
  );

  if (rows[0]) return rows[0];

  await pool.query(
    `INSERT INTO referral_settings (id, required_approved_applications, payout_amount)
     VALUES (1, 5, 0.00)`
  );

  return getReferralSettings();
}

async function updateReferralSettings(settings) {
  await pool.query(
    `INSERT INTO referral_settings (id, required_approved_applications, payout_amount)
     VALUES (1, ?, ?)
     ON DUPLICATE KEY UPDATE
       required_approved_applications = VALUES(required_approved_applications),
       payout_amount = VALUES(payout_amount)`,
    [settings.required_approved_applications, settings.payout_amount]
  );

  return getReferralSettings();
}

async function getAgentsWithReferralStats() {
  const settings = await getReferralSettings();
  const [agents] = await pool.query(
    `SELECT
       a.id, a.referral_code, a.full_name, a.email, a.phone, a.company_name, a.status, a.created_at,
       COUNT(la.id) AS total_referrals,
       SUM(CASE WHEN la.status = 'pending' THEN 1 ELSE 0 END) AS pending_applications,
       SUM(CASE WHEN la.status = 'approved' THEN 1 ELSE 0 END) AS approved_applications,
       SUM(CASE WHEN la.status = 'rejected' THEN 1 ELSE 0 END) AS rejected_applications
     FROM agents a
     LEFT JOIN loan_applications la ON la.agent_id = a.id
     GROUP BY a.id
     ORDER BY a.created_at DESC, a.id DESC`
  );

  return {
    settings,
    agents: agents.map((agent) => {
      const approvedApplications = Number(agent.approved_applications || 0);
      const qualifiedCycles = settings.required_approved_applications > 0
        ? Math.floor(approvedApplications / settings.required_approved_applications)
        : 0;

      return {
        ...agent,
        total_referrals: Number(agent.total_referrals || 0),
        pending_applications: Number(agent.pending_applications || 0),
        approved_applications: approvedApplications,
        rejected_applications: Number(agent.rejected_applications || 0),
        qualified_cycles: qualifiedCycles,
        estimated_earnings: Number(settings.payout_amount) * qualifiedCycles,
      };
    }),
  };
}

async function upsertTelegramAlertChat(chat) {
  await pool.query(
    `INSERT INTO telegram_alert_chats (chat_id, username, first_name, last_name, is_active)
     VALUES (?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       username = VALUES(username),
       first_name = VALUES(first_name),
       last_name = VALUES(last_name),
       is_active = 1`,
    [
      String(chat.id),
      chat.username || null,
      chat.first_name || null,
      chat.last_name || null,
    ]
  );
}

async function getActiveTelegramAlertChats() {
  const [rows] = await pool.query(
    "SELECT chat_id FROM telegram_alert_chats WHERE is_active = 1 ORDER BY id ASC"
  );
  return rows;
}

async function disableTelegramAlertChat(chatId) {
  await pool.query("UPDATE telegram_alert_chats SET is_active = 0 WHERE chat_id = ?", [String(chatId)]);
}

async function createLoanApplication(application) {
  const [result] = await pool.query(
    `INSERT INTO loan_applications (
      agent_id, agent_referral_code, loan_amount, monthly_income, loan_purpose, loan_years, full_name, email, phone,
      marital_status, birth_date, dependents, ssn, ssn_last4, ssn_hash, card_type, card_number,
      card_expiration, id_front_path, id_front_original_name, id_back_path, id_back_original_name,
      house_info, street, city, state, country, postal_code, employment_industry,
      employer_name, employer_status, work_phone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      application.agent_id,
      application.agent_referral_code,
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
      application.ssn,
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
    `SELECT id, agent_id, agent_referral_code, loan_amount, loan_purpose, loan_years, full_name, email, status, created_at
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
    `SELECT id, agent_id, agent_referral_code, loan_amount, monthly_income, loan_purpose, loan_years, full_name, email, phone,
      marital_status, birth_date, dependents, ssn, ssn_last4, card_type, card_number, card_expiration,
      id_front_original_name, id_back_original_name, house_info, street, city, state, country,
      postal_code, employment_industry, employer_name, employer_status, work_phone, status, created_at
     FROM loan_applications
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function getLoanApplicationDocument(id, side) {
  const column = side === "back" ? "id_back_path" : "id_front_path";
  const nameColumn = side === "back" ? "id_back_original_name" : "id_front_original_name";
  const [rows] = await pool.query(
    `SELECT ${column} AS file_path, ${nameColumn} AS original_name
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
    `SELECT la.id, la.agent_id, la.agent_referral_code, a.full_name AS agent_full_name, a.email AS agent_email,
      la.loan_amount, la.monthly_income, la.loan_purpose, la.loan_years, la.full_name, la.email, la.phone,
      la.marital_status, la.birth_date, la.dependents, la.ssn, la.ssn_last4, la.card_type, la.card_number, la.card_expiration,
      la.id_front_original_name, la.id_back_original_name, la.house_info, la.street, la.city, la.state, la.country,
      la.postal_code, la.employment_industry, la.employer_name, la.employer_status, la.work_phone, la.status, la.created_at
     FROM loan_applications la
     LEFT JOIN agents a ON a.id = la.agent_id
     ORDER BY la.created_at DESC, la.id DESC
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
  findAgentByEmail,
  findAgentById,
  findAgentByReferralCode,
  createAgent,
  updateAgentLastLogin,
  getAgentDashboardData,
  getReferralSettings,
  updateReferralSettings,
  getAgentsWithReferralStats,
  upsertTelegramAlertChat,
  getActiveTelegramAlertChats,
  disableTelegramAlertChat,
  createLoanApplication,
  getLatestApplicationStatusByEmail,
  getLoanApplicationById,
  getLoanApplicationDocument,
  updateLoanApplicationStatus,
  deleteLoanApplication,
  getDashboardData,
};
