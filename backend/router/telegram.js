const express = require("express");
const {
  canUseTelegram,
  deleteTelegramWebhook,
  getTelegramWebhookInfo,
  getTelegramWebhookSecret,
  handleTelegramUpdate,
  setTelegramWebhook,
  verifyTelegramPasscode,
} = require("../telegram");

const router = express.Router();

function getPasscode(req) {
  return req.body.passcode || req.query.passcode || req.header("x-telegram-passcode");
}

function requireTelegramPasscode(req, res, next) {
  if (!verifyTelegramPasscode(getPasscode(req))) {
    return res.status(401).json({ message: "Telegram passcode is required." });
  }

  return next();
}

function requireTelegramConfig(req, res, next) {
  if (!canUseTelegram()) {
    return res.status(503).json({ message: "Telegram bot token is not configured." });
  }

  return next();
}

router.post("/set-webhook", requireTelegramPasscode, requireTelegramConfig, async (req, res, next) => {
  try {
    const result = await setTelegramWebhook(req.body.webhookUrl);
    res.json({
      ok: true,
      result,
      message: "Telegram webhook was set.",
    });
  } catch (error) {
    next(error);
  }
});

router.post("/delete-webhook", requireTelegramPasscode, requireTelegramConfig, async (req, res, next) => {
  try {
    const result = await deleteTelegramWebhook();
    res.json({
      ok: true,
      result,
      message: "Telegram webhook was deleted.",
    });
  } catch (error) {
    next(error);
  }
});

router.get("/webhook-info", requireTelegramPasscode, requireTelegramConfig, async (req, res, next) => {
  try {
    const result = await getTelegramWebhookInfo();
    res.json({
      ok: true,
      result,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/webhook/:secret", requireTelegramConfig, async (req, res, next) => {
  try {
    const webhookSecret = getTelegramWebhookSecret();

    if (!webhookSecret || req.params.secret !== webhookSecret) {
      return res.status(404).json({ message: "Webhook was not found." });
    }

    await handleTelegramUpdate(req.body);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
