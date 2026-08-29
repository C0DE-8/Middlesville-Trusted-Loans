const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure =
  process.env.SMTP_SECURE === "true" || (!process.env.SMTP_SECURE && smtpPort === 465);
const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;
const smtpFrom = process.env.SMTP_FROM || smtpUser;
const adminNoticeTo = process.env.ADMIN_NOTICE_EMAIL || smtpUser;
const siteUrl = (process.env.SITE_URL || "https://middlesvilletrustedloans.com").replace(/\/$/, "");
const logoUrl =
  process.env.SITE_LOGO_URL || "https://middlesvilletrustedloans.com/assets/images/logo-dark.png";
const templatesDir = path.resolve(__dirname, "templates", "email");

function canSendMail() {
  return Boolean(smtpHost && smtpUser && smtpPassword && smtpFrom);
}

function createTransporter() {
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 15000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 15000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 30000),
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function loadTemplate(name) {
  return fs.readFileSync(path.join(templatesDir, name), "utf8");
}

function fillTemplate(template, context) {
  return template
    .replace(/\{\{\{(\w+)\}\}\}/g, (_, key) => String(context[key] ?? ""))
    .replace(/\{\{(\w+)\}\}/g, (_, key) => escapeHtml(context[key]));
}

function formatMessageHtml(message) {
  return escapeHtml(message)
    .split(/\r?\n{2,}/)
    .map((paragraph) => paragraph.replace(/\r?\n/g, "<br>"))
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("");
}

function formatDate(value) {
  if (!value) {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date());
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function normalizeApplication(application) {
  return {
    full_name: application.full_name || "Applicant",
    email: application.email || "",
    phone: application.phone || "",
    loan_purpose: application.loan_purpose || "Loan request",
    loan_amount: application.loan_amount || "",
    status: application.status || "pending",
    submitted_at: formatDate(application.created_at),
    status_url: `${siteUrl}/apply-loan.html`,
  };
}

function renderEmail(title, templateName, application) {
  const styles = loadTemplate("styles.css");
  const contentTemplate = loadTemplate(templateName);
  const content = fillTemplate(contentTemplate, normalizeApplication(application));
  const base = loadTemplate("base.html");

  return fillTemplate(base, {
    title,
    styles,
    content,
    logo_url: logoUrl,
  });
}

function renderAdminMessageEmail(title, message) {
  const styles = loadTemplate("styles.css");
  const contentTemplate = loadTemplate("admin-message.html");
  const content = fillTemplate(contentTemplate, {
    message_html: formatMessageHtml(message),
  });
  const base = loadTemplate("base.html");

  return fillTemplate(base, {
    title,
    styles,
    content,
    logo_url: logoUrl,
  });
}

function buildApplicationText(application) {
  const data = normalizeApplication(application);
  return [
    `Hello ${data.full_name},`,
    "",
    "We received your Middlesville Trusted Loans application and placed it in review.",
    "",
    `Status: ${data.status}`,
    `Loan purpose: ${data.loan_purpose}`,
    `Loan amount: ${data.loan_amount}`,
    `Submitted: ${data.submitted_at}`,
    "",
    `Check your status: ${data.status_url}`,
    "",
    "Middlesville Trusted Loans",
    "Email: info@middlesvilletrustedloans.com",
    "Phone: +1(412) 228-4101",
  ].join("\n");
}

function buildAdminText(application) {
  const data = normalizeApplication(application);
  return [
    "A new loan application was submitted.",
    "",
    `Applicant: ${data.full_name}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone}`,
    `Loan purpose: ${data.loan_purpose}`,
    `Loan amount: ${data.loan_amount}`,
    `Status: ${data.status}`,
    `Submitted: ${data.submitted_at}`,
  ].join("\n");
}

function buildStatusText(application) {
  const data = normalizeApplication(application);
  return [
    `Hello ${data.full_name},`,
    "",
    "Your loan status was checked from the Middlesville Trusted Loans website.",
    "",
    `Status: ${data.status}`,
    `Loan purpose: ${data.loan_purpose}`,
    `Loan amount: ${data.loan_amount}`,
    `Submitted: ${data.submitted_at}`,
    "",
    "If this was not you, contact Middlesville Trusted Loans.",
    "",
    "Middlesville Trusted Loans",
    "Email: info@middlesvilletrustedloans.com",
    "Phone: +1(412) 228-4101",
  ].join("\n");
}

function buildDecisionText(application) {
  const data = normalizeApplication(application);
  return [
    `Hello ${data.full_name},`,
    "",
    "Your Middlesville Trusted Loans application has been reviewed.",
    "",
    `Decision: ${data.status}`,
    `Loan purpose: ${data.loan_purpose}`,
    `Loan amount: ${data.loan_amount}`,
    `Submitted: ${data.submitted_at}`,
    "",
    "If you have questions about this decision, contact Middlesville Trusted Loans.",
    "",
    "Middlesville Trusted Loans",
    "Email: info@middlesvilletrustedloans.com",
    "Phone: +1(412) 228-4101",
  ].join("\n");
}

function buildAdminMessageText(message) {
  return [
    message,
    "",
    "Middlesville Trusted Loans",
    "Email: info@middlesvilletrustedloans.com",
    "Phone: +1(412) 228-4101",
  ].join("\n");
}

async function sendApplicationNotices(application) {
  if (!canSendMail()) {
    console.warn("SMTP is not configured; application email notice skipped.");
    return;
  }

  const transporter = createTransporter();
  const applicationWithStatus = {
    ...application,
    status: application.status || "pending",
  };

  await Promise.all([
    transporter.sendMail({
      from: smtpFrom,
      to: application.email,
      subject: "Middlesville Trusted Loans application received",
      text: buildApplicationText(applicationWithStatus),
      html: renderEmail(
        "Application received",
        "application-received.html",
        applicationWithStatus
      ),
    }),
    transporter.sendMail({
      from: smtpFrom,
      to: adminNoticeTo,
      subject: `New loan application from ${application.full_name}`,
      text: buildAdminText(applicationWithStatus),
      html: renderEmail("New loan application", "admin-application.html", applicationWithStatus),
    }),
  ]);
}

async function sendLoanDecisionNotice(application) {
  if (!canSendMail()) {
    console.warn("SMTP is not configured; loan decision email skipped.");
    return false;
  }

  const statusLabel = String(application.status || "updated").replace(/^\w/, (letter) =>
    letter.toUpperCase()
  );
  const transporter = createTransporter();

  await transporter.sendMail({
    from: smtpFrom,
    to: application.email,
    subject: `Middlesville Trusted Loans application ${statusLabel}`,
    text: buildDecisionText(application),
    html: renderEmail(`Application ${statusLabel}`, "loan-decision.html", application),
  });

  return true;
}

async function sendStatusCheckNotice(application) {
  if (!canSendMail()) {
    console.warn("SMTP is not configured; loan status check email skipped.");
    return false;
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from: smtpFrom,
    to: application.email,
    subject: "Middlesville Trusted Loans status checked",
    text: buildStatusText(application),
    html: renderEmail("Loan status checked", "status-check.html", application),
  });

  return true;
}

async function sendAdminMessage({ to, subject, message }) {
  if (!canSendMail()) {
    console.warn("SMTP is not configured; admin message email skipped.");
    return false;
  }

  const title = subject || "Message from Middlesville Trusted Loans";
  const transporter = createTransporter();

  await transporter.sendMail({
    from: smtpFrom,
    to,
    subject: title,
    text: buildAdminMessageText(message),
    html: renderAdminMessageEmail(title, message),
  });

  return true;
}

module.exports = {
  sendApplicationNotices,
  sendLoanDecisionNotice,
  sendStatusCheckNotice,
  sendAdminMessage,
};
