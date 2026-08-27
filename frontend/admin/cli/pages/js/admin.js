function getToken() {
  return window.MTLApi.getToken();
}

function setToken(token) {
  window.MTLApi.setToken(token);
}

function clearToken() {
  window.MTLApi.clearToken();
}

let currentApplications = [];

function initLogin() {
  const form = document.getElementById("admin-login-form");
  if (!form) return;

  if (getToken()) {
    window.location.href = "dashboard.html";
    return;
  }

  const message = document.getElementById("login-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";

    const formData = new FormData(form);
    const username = formData.get("username");
    const password = formData.get("password");

    try {
      const data = await window.MTLApi.login(username, password);

      setToken(data.token);
      window.location.href = "dashboard.html";
    } catch (error) {
      message.textContent = error.message;
    }
  });
}

async function initDashboard() {
  const hasAdminPage =
    document.getElementById("pending-applications") || document.getElementById("applications-table");
  if (!hasAdminPage) return;

  try {
    const [me, dashboard] = await Promise.all([
      window.MTLApi.me(),
      window.MTLApi.dashboard(),
    ]);

    setText("admin-name", me.admin.username);
    setText("pending-applications", dashboard.metrics.pendingApplications);
    setText("approved-this-month", dashboard.metrics.approvedThisMonth);
    setText("documents-to-review", dashboard.metrics.documentsToReview);
    setText("messages", dashboard.metrics.messages);

    renderActivity(dashboard.recentActivity || []);

    currentApplications = dashboard.applications || [];
    renderApplications(currentApplications);
  } catch (error) {
    clearToken();
    window.location.href = "index.html";
  }

  const logoutButton = document.getElementById("logout-button");
  if (!logoutButton) return;

  logoutButton.addEventListener("click", async () => {
    try {
      await window.MTLApi.logout();
    } finally {
      clearToken();
      window.location.href = "index.html";
    }
  });
}

async function refreshAdminData() {
  const dashboard = await window.MTLApi.dashboard();

  setText("pending-applications", dashboard.metrics.pendingApplications);
  setText("approved-this-month", dashboard.metrics.approvedThisMonth);
  setText("documents-to-review", dashboard.metrics.documentsToReview);
  setText("messages", dashboard.metrics.messages);
  renderActivity(dashboard.recentActivity || []);

  currentApplications = dashboard.applications || [];
  renderApplications(currentApplications);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function renderActivity(items) {
  const activity = document.getElementById("recent-activity");
  if (!activity) return;

  activity.innerHTML = "";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    activity.appendChild(li);
  });
}

function renderApplications(applications) {
  const table = document.getElementById("applications-table");
  const count = document.getElementById("application-count");
  if (!table || !count) return;

  count.textContent = `${applications.length} ${applications.length === 1 ? "record" : "records"}`;
  table.innerHTML = "";

  if (!applications.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 7;
    cell.textContent = "No applications yet.";
    row.appendChild(cell);
    table.appendChild(row);
    return;
  }

  applications.forEach((application) => {
    const row = document.createElement("tr");
    const files = [application.id_front_original_name, application.id_back_original_name]
      .filter(Boolean)
      .join(", ");

    row.appendChild(createStackedCell([
      ["Name", application.full_name],
      ["Submitted", formatDate(application.created_at)],
    ]));
    row.appendChild(createStackedCell([
      ["Purpose", application.loan_purpose],
      ["Amount", application.loan_amount],
      ["Term", application.loan_years],
      ["Income", application.monthly_income],
    ]));
    row.appendChild(createStackedCell([
      ["Email", application.email],
      ["Phone", application.phone],
    ]));
    row.appendChild(createStackedCell([
      ["SSN Last 4", application.ssn_last4 ? `***-**-${application.ssn_last4}` : "Not available"],
      ["Card Type", application.card_type],
      ["Card Number", maskCard(application.card_number)],
      ["Expires", application.card_expiration],
    ]));
    row.appendChild(createStackedCell([
      ["ID/Card Files", files || "Missing files"],
      ["Employer", application.employer_name || application.employer_status],
    ]));
    row.appendChild(createStatusCell(application.status));
    row.appendChild(createActionsCell(application));

    table.appendChild(row);
  });
}

function createStackedCell(items) {
  const cell = document.createElement("td");
  const wrap = document.createElement("div");
  wrap.className = "admin-cell-stack";

  items.forEach(([labelText, valueText]) => {
    const item = document.createElement("span");
    const label = document.createElement("small");
    const value = document.createElement("strong");

    label.textContent = labelText;
    value.textContent = valueText || "Not available";
    item.appendChild(label);
    item.appendChild(value);
    wrap.appendChild(item);
  });

  cell.appendChild(wrap);
  return cell;
}

function createStatusCell(status) {
  const cell = document.createElement("td");
  const badge = document.createElement("span");
  const normalized = String(status || "pending").toLowerCase();

  badge.className = `admin-status admin-status--${normalized}`;
  badge.textContent = normalized;
  cell.appendChild(badge);
  return cell;
}

function createActionsCell(application) {
  const cell = document.createElement("td");
  const actions = document.createElement("div");
  actions.className = "admin-actions";

  const approveButton = createStatusButton(application, "approved", "Approve");
  const rejectButton = createStatusButton(application, "rejected", "Reject");
  const deleteButton = createDeleteButton(application);

  actions.appendChild(approveButton);
  actions.appendChild(rejectButton);
  actions.appendChild(deleteButton);
  cell.appendChild(actions);
  return cell;
}

function createStatusButton(application, status, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `admin-action admin-action--${status}`;
  button.textContent = label;
  button.disabled = application.status === status;

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Saving...";

    try {
      await window.MTLApi.updateApplicationStatus(application.id, status);
      await refreshAdminData();
    } catch (error) {
      button.disabled = false;
      button.textContent = label;
      window.alert(error.message);
    }
  });

  return button;
}

function createDeleteButton(application) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "admin-action admin-action--delete";
  button.textContent = "Delete";

  button.addEventListener("click", async () => {
    const confirmed = window.confirm(
      `Delete the application for ${application.full_name || "this applicant"}? This cannot be undone.`
    );

    if (!confirmed) return;

    button.disabled = true;
    button.textContent = "Deleting...";

    try {
      await window.MTLApi.deleteApplication(application.id);
      await refreshAdminData();
    } catch (error) {
      button.disabled = false;
      button.textContent = "Delete";
      window.alert(error.message);
    }
  });

  return button;
}

function formatDate(value) {
  if (!value) return "Not available";

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function maskCard(value) {
  if (!value) return "Not available";

  const digits = String(value).replace(/\D/g, "");
  if (digits.length <= 4) return digits;

  return `**** ${digits.slice(-4)}`;
}

initLogin();
initDashboard();
