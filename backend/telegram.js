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

const menuKeyboard = {
  keyboard: [
    [{ text: "Activate Alerts" }, { text: "Alert Status" }],
    [{ text: "Stop Alerts" }],
  ],
  resize_keyboard: true,
  one_time_keyboard: false,
};

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

async function sendTelegramMessage(chatId, text, options = {}) {
  return telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...options,
  });
}

function getTelegramWebhookSecret() {
  return webhookSecret;
}

function verifyTelegramPasscode(passcode) {
  return String(passcode || "").trim() === alertPasscode;
}

function isAbsoluteUrl(value) {
  return /^https:\/\//i.test(String(value || ""));
}

function buildWebhookUrl(value) {
  if (isAbsoluteUrl(value)) {
    return value;
  }

  if (configuredWebhookUrl) {
    return configuredWebhookUrl;
  }

  const siteUrl = String(value || process.env.TELEGRAM_PUBLIC_URL || process.env.SITE_URL || "").replace(/\/$/, "");
  if (!siteUrl || !webhookSecret) {
    return "";
  }

  return `${siteUrl}/api/telegram/webhook/${encodeURIComponent(webhookSecret)}`;
}

async function setTelegramWebhook(value) {
  const url = buildWebhookUrl(value);

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

async function isTelegramAlertChatActive(chatId) {
  const chats = await getActiveTelegramAlertChats();
  return chats.some((chat) => String(chat.chat_id) === String(chatId));
}

async function handleTelegramMessage(message) {
  const text = String(message.text || "").trim();
  const chat = message.chat;
  if (!chat || !text) return;

  if (text === "/start") {
    await sendTelegramMessage(
      chat.id,
      "Choose an alert option. Use Activate Alerts, then send the passcode when asked.",
      { reply_markup: menuKeyboard }
    );
    return;
  }

  if (text === "Activate Alerts") {
    await sendTelegramMessage(chat.id, "Send the alert passcode to activate this chat.", {
      reply_markup: menuKeyboard,
    });
    return;
  }

  if (text === "Alert Status") {
    const isActive = await isTelegramAlertChatActive(chat.id);
    await sendTelegramMessage(
      chat.id,
      isActive ? "Alerts are active for this chat." : "Alerts are not active. Tap Activate Alerts and send the passcode.",
      { reply_markup: menuKeyboard }
    );
    return;
  }

  if (text === "/stop" || text === "Stop Alerts") {
    await disableTelegramAlertChat(chat.id);
    await sendTelegramMessage(chat.id, "Telegram alerts have been turned off for this chat.", {
      reply_markup: menuKeyboard,
    });
    return;
  }

  if (text === alertPasscode || text === `/start ${alertPasscode}`) {
    await upsertTelegramAlertChat(chat);
    await sendTelegramMessage(chat.id, "Telegram alerts are active for Middlesville Trusted Loans.", {
      reply_markup: menuKeyboard,
    });
    return;
  }

  await sendTelegramMessage(chat.id, "Use the buttons below to manage alerts.", {
    reply_markup: menuKeyboard,
  });
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
  buildWebhookUrl,
  canUseTelegram,
  deleteTelegramWebhook,
  getTelegramWebhookInfo,
  getTelegramWebhookSecret,
  handleTelegramUpdate,
  isTelegramAlertChatActive,
  sendTelegramAlert,
  sendTelegramMessage,
  setTelegramWebhook,
  startTelegramBotPolling,
  verifyTelegramPasscode,
};
