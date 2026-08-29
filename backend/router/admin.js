const express = require("express");
const { requireAdminAuth } = require("../middleware/auth");
const {
  getDashboardData,
  getAgentsWithReferralStats,
  getLoanApplicationDocument,
  getReferralSettings,
  updateLoanApplicationStatus,
  updateReferralSettings,
  deleteLoanApplication,
} = require("../db");
const { sendAdminMessage, sendLoanDecisionNotice } = require("../mail");
const fs = require("fs");

const router = express.Router();
const allowedStatuses = new Set(["pending", "approved", "rejected"]);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.use(requireAdminAuth);

router.get("/dashboard", async (req, res, next) => {
  try {
    const dashboard = await getDashboardData();

    res.json({
      admin: req.admin.username,
      metrics: dashboard.metrics,
      applications: dashboard.applications,
      recentActivity: [
        "New loan applications are saved to MySQL",
        "Identity documents are stored for admin review",
        "Admin credentials are loaded from the database",
      ],
    });
  } catch (error) {
    next(error);
  }
});

router.get("/agents", async (req, res, next) => {
  try {
    const data = await getAgentsWithReferralStats();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/referral-settings", async (req, res, next) => {
  try {
    const settings = await getReferralSettings();
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

router.put("/referral-settings", async (req, res, next) => {
  try {
    const requiredApprovedApplications = Number(req.body.requiredApprovedApplications);
    const payoutAmount = Number(req.body.payoutAmount);

    if (!Number.isInteger(requiredApprovedApplications) || requiredApprovedApplications < 1) {
      return res.status(400).json({ message: "Required approved applications must be at least 1." });
    }

    if (!Number.isFinite(payoutAmount) || payoutAmount < 0) {
      return res.status(400).json({ message: "Payout amount must be 0 or more." });
    }

    const settings = await updateReferralSettings({
      required_approved_applications: requiredApprovedApplications,
      payout_amount: payoutAmount,
    });

    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

router.post("/mailer", async (req, res, next) => {
  try {
    const to = normalizeEmail(req.body.email);
    const subject = String(req.body.subject || "Message from Middlesville Trusted Loans").trim();
    const message = String(req.body.message || "").trim();

    if (!to || !message) {
      return res.status(400).json({ message: "Recipient email and message body are required." });
    }

    if (!isValidEmail(to)) {
      return res.status(400).json({ message: "Enter a valid recipient email address." });
    }

    if (message.length > 10000) {
      return res.status(400).json({ message: "Message body must be 10,000 characters or less." });
    }

    if (subject.length > 180) {
      return res.status(400).json({ message: "Subject must be 180 characters or less." });
    }

    const sent = await sendAdminMessage({ to, subject, message });
    if (!sent) {
      return res.status(503).json({ message: "SMTP is not configured on the server." });
    }

    res.json({ ok: true, message: "Email sent." });
  } catch (error) {
    next(error);
  }
});

router.patch("/applications/:id/status", async (req, res, next) => {
  try {
    const status = String(req.body.status || "").trim().toLowerCase();

    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ message: "Status must be pending, approved, or rejected." });
    }

    const application = await updateLoanApplicationStatus(req.params.id, status);
    if (!application) {
      return res.status(404).json({ message: "Loan application was not found." });
    }

    if (status === "approved" || status === "rejected") {
      sendLoanDecisionNotice(application).catch((error) => {
        console.error("Loan decision email failed.");
        console.error(error);
      });
    }

    res.json({
      application,
      emailQueued: status === "approved" || status === "rejected",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/applications/:id/documents/:side", async (req, res, next) => {
  try {
    const side = String(req.params.side || "").trim().toLowerCase();

    if (!["front", "back"].includes(side)) {
      return res.status(400).json({ message: "Document side must be front or back." });
    }

    const document = await getLoanApplicationDocument(req.params.id, side);
    if (!document || !document.file_path) {
      return res.status(404).json({ message: "Application document was not found." });
    }

    if (document.original_name) {
      res.setHeader("Content-Disposition", `inline; filename="${document.original_name.replace(/"/g, "")}"`);
    }
    res.sendFile(document.file_path);
  } catch (error) {
    next(error);
  }
});

router.delete("/applications/:id", async (req, res, next) => {
  try {
    const application = await deleteLoanApplication(req.params.id);

    if (!application) {
      return res.status(404).json({ message: "Loan application was not found." });
    }

    [application.id_front_path, application.id_back_path].filter(Boolean).forEach((filePath) => {
      fs.unlink(filePath, (error) => {
        if (error && error.code !== "ENOENT") {
          console.error(`Failed to remove application upload: ${filePath}`);
          console.error(error);
        }
      });
    });

    res.json({ ok: true, message: "Loan application was deleted." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
