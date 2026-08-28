const {
  disableTelegramAlertChat,
  getActiveTelegramAlertChats,
  upsertTelegramAlertChat,
} = require("./db");

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const alertPasscode = process.env.TELEGRAM_ALERT_PASSCODE || "123456";
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

  pollTelegramUpdates();
}

module.exports = {
  sendTelegramAlert,
  startTelegramBotPolling,
};
