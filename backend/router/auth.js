const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, requireAdminAuth, requireAgentAuth } = require("../middleware/auth");
const {
  createAgent,
  findAdminByUsername,
  findAgentByEmail,
  findAgentById,
  getAgentDashboardData,
  updateAgentLastLogin,
} = require("../db");

const router = express.Router();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function serializeAgent(agent) {
  return {
    id: agent.id,
    referralCode: agent.referral_code,
    fullName: agent.full_name,
    email: agent.email,
    phone: agent.phone,
    companyName: agent.company_name,
    status: agent.status,
    lastLoginAt: agent.last_login_at,
    createdAt: agent.created_at,
  };
}

function serializeReferralSettings(settings) {
  return {
    requiredApprovedApplications: settings.required_approved_applications,
    payoutAmount: Number(settings.payout_amount),
    updatedAt: settings.updated_at,
  };
}

function signAgentToken(agent) {
  return jwt.sign(
    {
      sub: String(agent.id),
      full_name: agent.full_name,
      email: agent.email,
      role: "agent",
      token_type: "agent",
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );
}

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  const admin = await findAdminByUsername(username);
  const passwordMatches = admin ? await bcrypt.compare(password, admin.password_hash) : false;

  if (!admin || !passwordMatches) {
    return res.status(401).json({ message: "Invalid admin credentials." });
  }

  const token = jwt.sign(
    {
      sub: String(admin.id),
      username: admin.username,
      role: admin.role,
    },
    JWT_SECRET,
    { expiresIn: "8h" }
  );

  return res.json({
    token,
    admin: {
      username: admin.username,
      role: admin.role,
    },
  });
});

router.post("/agent/register", async (req, res, next) => {
  try {
    const fullName = String(req.body.fullName || req.body.full_name || "").trim();
    const email = normalizeEmail(req.body.email);
    const phone = String(req.body.phone || "").trim();
    const companyName = String(req.body.companyName || req.body.company_name || "").trim();
    const password = String(req.body.password || "");

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    const existingAgent = await findAgentByEmail(email);
    if (existingAgent) {
      return res.status(409).json({ message: "An agent account already exists for this email." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const agent = await createAgent({
      full_name: fullName,
      email,
      phone,
      company_name: companyName,
      password_hash: passwordHash,
    });
    await updateAgentLastLogin(agent.id);

    const refreshedAgent = await findAgentById(agent.id);

    return res.status(201).json({
      token: signAgentToken(refreshedAgent),
      agent: serializeAgent(refreshedAgent),
    });
  } catch (error) {
    if (error && error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "An agent account already exists for this email." });
    }
    return next(error);
  }
});

router.post("/agent/login", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const agent = await findAgentByEmail(email);
    const passwordMatches = agent ? await bcrypt.compare(password, agent.password_hash) : false;

    if (!agent || !passwordMatches) {
      return res.status(401).json({ message: "Invalid agent credentials." });
    }

    if (agent.status !== "active") {
      return res.status(403).json({ message: "This agent account is not active." });
    }

    await updateAgentLastLogin(agent.id);
    const refreshedAgent = await findAgentById(agent.id);

    return res.json({
      token: signAgentToken(refreshedAgent),
      agent: serializeAgent(refreshedAgent),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/me", requireAdminAuth, (req, res) => {
  res.json({ admin: req.admin });
});

router.get("/agent/me", requireAgentAuth, async (req, res, next) => {
  try {
    const agent = await findAgentById(req.agent.id);

    if (!agent || agent.status !== "active") {
      return res.status(401).json({ message: "Agent account was not found." });
    }

    return res.json({ agent: serializeAgent(agent) });
  } catch (error) {
    return next(error);
  }
});

router.get("/agent/dashboard", requireAgentAuth, async (req, res, next) => {
  try {
    const dashboard = await getAgentDashboardData(req.agent.id);

    if (!dashboard.agent || dashboard.agent.status !== "active") {
      return res.status(401).json({ message: "Agent account was not found." });
    }

    return res.json({
      agent: serializeAgent(dashboard.agent),
      settings: serializeReferralSettings(dashboard.settings),
      metrics: dashboard.metrics,
      applications: dashboard.applications,
      recentActivity: dashboard.recentActivity,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
