const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { JWT_SECRET, requireAdminAuth } = require("../middleware/auth");
const { findAdminByUsername } = require("../db");

const router = express.Router();

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

router.get("/me", requireAdminAuth, (req, res) => {
  res.json({ admin: req.admin });
});

router.post("/logout", (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
