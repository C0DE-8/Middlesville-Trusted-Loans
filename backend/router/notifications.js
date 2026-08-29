const express = require("express");
const { sendTelegramAlert } = require("../telegram");

const router = express.Router();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

router.post("/newsletter", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body.email || req.body.EMAIL);

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    sendTelegramAlert(
      [
        "New newsletter signup",
        `Email: ${email}`,
      ].join("\n")
    ).catch((error) => {
      console.error("Telegram newsletter alert failed.");
      console.error(error.message);
    });

    res.status(201).json({
      ok: true,
      message: "Thank you for subscribing.",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/contact", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const phone = String(req.body.phone || "").trim();
    const subject = String(req.body.subject || "Website message").trim();
    const message = String(req.body.message || "").trim();

    if (!name || !email || !phone || !message) {
      return res.status(400).json({ message: "Name, email, phone number, and message are required." });
    }

    sendTelegramAlert(
      [
        "New contact message",
        `Name: ${name}`,
        `Email: ${email}`,
        `Phone: ${phone}`,
        `Subject: ${subject}`,
        `Message: ${message}`,
      ].join("\n")
    ).catch((error) => {
      console.error("Telegram contact alert failed.");
      console.error(error.message);
    });

    res.status(201).json({
      ok: true,
      message: "Your message was sent successfully.",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
