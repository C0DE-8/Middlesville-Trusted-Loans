const {
  disableTelegramAlertChat,
  getActiveTelegramAlertChats,
  upsertTelegramAlertChat,
} = require("./db");

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const alertPasscode = process.env.TELEGRAM_ALERT_PASSCODE || "123456";
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const configuredWebhookUrl = process.env.TELEGRAM_WEBHOOK_URL || "";
const telegramApiBase = botToken ? `https://api.telegram.org/bot${botToken}` : "";
let updateOffset = 0;
let isPolling = false;

function canUseTelegram() {
  return Boolean(botToken);
}

function buildTextUrl(method) {
  return `${telegramApiBase}/${method}`;
}

async function telegramRequest(method, body) {
  if (!canUseTelegram()) {
    return null;
  }

  const response = await fetch(buildTextUrl(method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const description = data.description || `Telegram ${method} failed.`;
    const error = new Error(description);
    error.status = response.status;
    throw error;
  }

  return data.result;
}

async function sendTelegramMessage(chatId, text) {
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}

function getTelegramWebhookSecret() {
  return webhookSecret;
}

function verifyTelegramPasscode(passcode) {
  return String(passcode || "").trim() === alertPasscode;
}

function buildWebhookUrl(baseUrl) {
  if (configuredWebhookUrl) {
    return configuredWebhookUrl;
  }

  const siteUrl = String(baseUrl || process.env.SITE_URL || "").replace(/\/$/, "");
  if (!siteUrl || !webhookSecret) {
    return "";
  }

  return `${siteUrl}/api/telegram/webhook/${encodeURIComponent(webhookSecret)}`;
}

async function setTelegramWebhook(baseUrl) {
  const url = buildWebhookUrl(baseUrl);

  if (!url) {
    throw new Error("TELEGRAM_WEBHOOK_URL or SITE_URL plus TELEGRAM_WEBHOOK_SECRET is required.");
  }

  return telegramRequest("setWebhook", {
    url,
    allowed_updates: ["message"],
  });
}

async function deleteTelegramWebhook() {
  return telegramRequest("deleteWebhook", {
    drop_pending_updates: false,
  });
}

async function getTelegramWebhookInfo() {
  return telegramRequest("getWebhookInfo", {});
}

async function sendTelegramAlert(text) {
  if (!canUseTelegram()) {
    console.warn("Telegram bot token is not configured; alert skipped.");
    return false;
  }

  const chats = await getActiveTelegramAlertChats();
  if (!chats.length) {
    console.warn("No Telegram alert chats are registered; alert skipped.");
    return false;
  }

  await Promise.all(
    chats.map(async (chat) => {
      try {
        await sendTelegramMessage(chat.chat_id, text);
      } catch (error) {
        if (error.status === 403 || error.status === 400) {
          await disableTelegramAlertChat(chat.chat_id);
        }
        console.error("Telegram alert delivery failed.");
        console.error(error.message);
      }
    })
  );

  return true;
}

async function handleTelegramMessage(message) {
  const text = String(message.text || "").trim();
  const chat = message.chat;
  if (!chat || !text) return;

  if (text === "/stop") {
    await disableTelegramAlertChat(chat.id);
    await sendTelegramMessage(chat.id, "Telegram alerts have been turned off for this chat.");
    return;
  }

  if (text === alertPasscode || text === `/start ${alertPasscode}`) {
    await upsertTelegramAlertChat(chat);
    await sendTelegramMessage(chat.id, "Telegram alerts are active for Middlesville Trusted Loans.");
    return;
  }

  await sendTelegramMessage(chat.id, "Send the alert passcode to activate Middlesville Trusted Loans alerts.");
}

async function handleTelegramUpdate(update) {
  if (update && update.message) {
    await handleTelegramMessage(update.message);
  }
}

async function pollTelegramUpdates() {
  if (!canUseTelegram() || isPolling) return;

  isPolling = true;

  try {
    const updates = await telegramRequest("getUpdates", {
      offset: updateOffset || undefined,
      timeout: 25,
      allowed_updates: ["message"],
    });

    for (const update of updates || []) {
      updateOffset = update.update_id + 1;
      if (update.message) {
        await handleTelegramMessage(update.message);
      }
    }
  } catch (error) {
    console.error("Telegram bot polling failed.");
    console.error(error.message);
  } finally {
    isPolling = false;
    setTimeout(pollTelegramUpdates, 1500);
  }
}

function startTelegramBotPolling() {
  if (!canUseTelegram()) {
    console.warn("Telegram bot token is not configured; bot polling skipped.");
    return;
  }

  if (process.env.TELEGRAM_ENABLE_POLLING === "false" || configuredWebhookUrl) {
    console.log("Telegram polling skipped; webhook mode is configured.");
    return;
  }

  pollTelegramUpdates();
}

module.exports = {
  canUseTelegram,
  deleteTelegramWebhook,
  getTelegramWebhookInfo,
  getTelegramWebhookSecret,
  handleTelegramUpdate,
  sendTelegramAlert,
  setTelegramWebhook,
  startTelegramBotPolling,
  verifyTelegramPasscode,
};
