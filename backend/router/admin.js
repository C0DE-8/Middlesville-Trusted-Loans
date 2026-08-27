const express = require("express");
const { requireAdminAuth } = require("../middleware/auth");
const { getDashboardData, updateLoanApplicationStatus, deleteLoanApplication } = require("../db");
const { sendLoanDecisionNotice } = require("../mail");
const fs = require("fs");

const router = express.Router();
const allowedStatuses = new Set(["pending", "approved", "rejected"]);

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
