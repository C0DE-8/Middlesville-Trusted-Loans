const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const { createLoanApplication, getLatestApplicationStatusByEmail } = require("../db");
const { sendApplicationNotices, sendStatusCheckNotice } = require("../mail");

const router = express.Router();
const uploadDir = path.resolve(__dirname, "../uploads/loan-applications");
const statusEmailCooldownMs =
  Number(process.env.STATUS_EMAIL_COOLDOWN_MINUTES || 15) * 60 * 1000;
const statusEmailLastSentAt = new Map();

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
    cb(null, allowedTypes.includes(file.mimetype));
  },
});

function required(body, fields) {
  return fields.filter((field) => !body[field] || !String(body[field]).trim());
}

function canQueueStatusEmail(email) {
  const now = Date.now();
  const lastSentAt = statusEmailLastSentAt.get(email) || 0;

  if (now - lastSentAt < statusEmailCooldownMs) {
    return false;
  }

  statusEmailLastSentAt.set(email, now);
  return true;
}

router.post("/status", async (req, res, next) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const application = await getLatestApplicationStatusByEmail(email);
    if (!application) {
      return res.status(404).json({ message: "No loan application was found for that email." });
    }

    const emailQueued = canQueueStatusEmail(email);

    if (emailQueued) {
      sendStatusCheckNotice(application).catch((error) => {
        statusEmailLastSentAt.delete(email);
        console.error("Loan status check email failed.");
        console.error(error);
      });
    }

    res.json({ application, emailQueued });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  upload.fields([
    { name: "id_front", maxCount: 1 },
    { name: "id_back", maxCount: 1 },
  ]),
  async (req, res) => {
    const missing = required(req.body, [
      "loan_amount",
      "monthly_income",
      "loan_purpose",
      "loan_years",
      "full_name",
      "email",
      "phone",
      "ssn",
      "card_type",
      "card_number",
      "card_expiration",
    ]);

    if (missing.length) {
      return res.status(400).json({ message: `Missing required fields: ${missing.join(", ")}` });
    }

    const ssnDigits = String(req.body.ssn).replace(/\D/g, "");
    if (ssnDigits.length < 4) {
      return res.status(400).json({ message: "A valid SSN is required." });
    }

    const idFront = req.files?.id_front?.[0];
    const idBack = req.files?.id_back?.[0];

    if (!idFront || !idBack) {
      return res.status(400).json({ message: "ID card front and back uploads are required." });
    }

    const ssnHash = crypto.createHash("sha256").update(ssnDigits).digest("hex");
    const application = {
      loan_amount: req.body.loan_amount,
      monthly_income: req.body.monthly_income,
      loan_purpose: req.body.loan_purpose,
      loan_years: req.body.loan_years,
      full_name: req.body.full_name,
      email: req.body.email,
      phone: req.body.phone,
      marital_status: req.body.marital_status || null,
      birth_date: req.body.birth_date || null,
      dependents: req.body.dependents || null,
      ssn_last4: ssnDigits.slice(-4),
      ssn_hash: ssnHash,
      card_type: req.body.card_type,
      card_number: req.body.card_number,
      card_expiration: req.body.card_expiration,
      id_front_path: idFront.path,
      id_front_original_name: idFront.originalname,
      id_back_path: idBack.path,
      id_back_original_name: idBack.originalname,
      house_info: req.body.house_info || null,
      street: req.body.street || null,
      city: req.body.city || null,
      state: req.body.state || null,
      country: req.body.country || null,
      postal_code: req.body.postal_code || null,
      employment_industry: req.body.employment_industry || null,
      employer_name: req.body.employer_name || null,
      employer_status: req.body.employer_status || null,
      work_phone: req.body.work_phone || null,
    };
    const applicationId = await createLoanApplication(application);

    sendApplicationNotices(application).catch((error) => {
      console.error("Application email notice failed. Check SMTP credentials, host, port, and mailbox delivery.");
      console.error(error);
    });

    res.status(201).json({
      ok: true,
      applicationId,
      message: "Your loan application was submitted successfully.",
    });
  }
);

module.exports = router;
