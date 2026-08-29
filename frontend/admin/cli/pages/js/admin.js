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
let currentDocumentUrl = "";

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
    const submitButton = form.querySelector("button[type='submit']");
    const submitLabel = submitButton ? submitButton.querySelector(".admin-button__label") : null;
    const originalLabel = submitLabel ? submitLabel.textContent : "Sign In";

    const formData = new FormData(form);
    const username = formData.get("username");
    const password = formData.get("password");

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.classList.add("is-loading");
    }
    if (submitLabel) {
      submitLabel.textContent = "Signing in";
    }

    try {
      const data = await window.MTLApi.login(username, password);

      setToken(data.token);
      window.location.href = "dashboard.html";
    } catch (error) {
      message.textContent = error.message;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.classList.remove("is-loading");
      }
      if (submitLabel) {
        submitLabel.textContent = originalLabel;
      }
    }
  });
}

async function initDashboard() {
  const hasAdminPage =
    document.getElementById("pending-applications") || document.getElementById("applications-table");
  if (!hasAdminPage) return;

  setApplicationsLoading(true);

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

  bindAdminLogout();
}

function bindAdminLogout() {
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

async function initAgentsPage() {
  const agentsTable = document.getElementById("agents-table");
  const settingsForm = document.getElementById("referral-settings-form");
  if (!agentsTable || !settingsForm) return;

  try {
    const [me, agentsData] = await Promise.all([
      window.MTLApi.me(),
      window.MTLApi.agents(),
    ]);

    setText("admin-name", me.admin.username);
    renderReferralSettings(agentsData.settings);
    renderAgents(agentsData.agents || []);
    bindAdminLogout();
  } catch (error) {
    clearToken();
    window.location.href = "index.html";
    return;
  }

  settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = document.getElementById("referral-settings-message");
    const submitButton = settingsForm.querySelector("button[type='submit']");
    const submitLabel = submitButton ? submitButton.querySelector(".admin-button__label") : null;
    const formData = new FormData(settingsForm);

    if (message) {
      message.textContent = "";
      message.classList.remove("admin-form__message--success");
    }
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.classList.add("is-loading");
    }
    if (submitLabel) {
      submitLabel.textContent = "Saving";
    }

    try {
      await window.MTLApi.updateReferralSettings(
        Number(formData.get("requiredApprovedApplications")),
        Number(formData.get("payoutAmount"))
      );
      const agentsData = await window.MTLApi.agents();
      renderReferralSettings(agentsData.settings);
      renderAgents(agentsData.agents || []);
      if (message) {
        message.textContent = "Referral payout rule saved.";
        message.classList.add("admin-form__message--success");
      }
    } catch (error) {
      if (message) {
        message.textContent = error.message;
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.classList.remove("is-loading");
      }
      if (submitLabel) {
        submitLabel.textContent = "Save Rule";
      }
    }
  });
}

async function initMailerPage() {
  const form = document.getElementById("admin-mailer-form");
  if (!form) return;

  try {
    const me = await window.MTLApi.me();
    setText("admin-name", me.admin.username);
    bindAdminLogout();
  } catch (error) {
    clearToken();
    window.location.href = "index.html";
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = document.getElementById("mailer-message-status");
    const submitButton = form.querySelector("button[type='submit']");
    const submitLabel = submitButton ? submitButton.querySelector(".admin-button__label") : null;
    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim();
    const body = String(formData.get("message") || "").trim();

    if (message) {
      message.textContent = "";
      message.classList.remove("admin-form__message--success");
    }
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.classList.add("is-loading");
    }
    if (submitLabel) {
      submitLabel.textContent = "Sending";
    }

    try {
      await window.MTLApi.sendAdminMail(email, "", body);
      form.reset();
      if (message) {
        message.textContent = "Email sent.";
        message.classList.add("admin-form__message--success");
      }
    } catch (error) {
      if (message) {
        message.textContent = error.message;
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.classList.remove("is-loading");
      }
      if (submitLabel) {
        submitLabel.textContent = "Send Email";
      }
    }
  });
}

function renderReferralSettings(settings) {
  if (!settings) return;

  const requiredInput = document.getElementById("required-approved-applications");
  const payoutInput = document.getElementById("payout-amount");

  if (requiredInput) {
    requiredInput.value = settings.required_approved_applications || 5;
  }
  if (payoutInput) {
    payoutInput.value = Number(settings.payout_amount || 0).toFixed(2);
  }

  setText("referral-settings-updated", `Updated ${formatDate(settings.updated_at)}`);
}

function renderAgents(agents) {
  const table = document.getElementById("agents-table");
  const count = document.getElementById("agent-count");
  if (!table || !count) return;

  count.textContent = `${agents.length} ${agents.length === 1 ? "agent" : "agents"}`;
  table.innerHTML = "";

  if (!agents.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "No agents have registered yet.";
    row.appendChild(cell);
    table.appendChild(row);
    return;
  }

  agents.forEach((agent) => {
    const row = document.createElement("tr");

    row.appendChild(createStackedCell([
      ["Name", agent.full_name],
      ["Email", agent.email],
      ["Company", agent.company_name || "Independent"],
    ]));
    row.appendChild(createStackedCell([
      ["Code", agent.referral_code],
      ["Joined", formatDate(agent.created_at)],
    ]));
    row.appendChild(createStackedCell([
      ["Total", agent.total_referrals],
      ["Pending", agent.pending_applications],
      ["Approved", agent.approved_applications],
      ["Rejected", agent.rejected_applications],
    ]));
    row.appendChild(createStackedCell([
      ["Cycles", agent.qualified_cycles],
      ["Estimated", formatMoney(agent.estimated_earnings)],
    ]));
    row.appendChild(createStatusCell(agent.status));

    table.appendChild(row);
  });
}

async function refreshAdminData() {
  setApplicationsLoading(true);
  try {
    const dashboard = await window.MTLApi.dashboard();

    setText("pending-applications", dashboard.metrics.pendingApplications);
    setText("approved-this-month", dashboard.metrics.approvedThisMonth);
    setText("documents-to-review", dashboard.metrics.documentsToReview);
    setText("messages", dashboard.metrics.messages);
    renderActivity(dashboard.recentActivity || []);

    currentApplications = dashboard.applications || [];
    renderApplications(currentApplications);
  } catch (error) {
    renderApplications(currentApplications);
    throw error;
  }
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

  setApplicationsLoading(false);
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
      ["Referred By", application.agent_full_name || application.agent_referral_code],
    ]));
    row.appendChild(createStackedCell([
      ["SSN", application.ssn || application.ssn_last4 || "Not available"],
      ["Card Type", application.card_type],
      ["Card Number", application.card_number],
      ["Expires", application.card_expiration],
    ]));
    row.appendChild(createDocumentsCell(application, files));
    row.appendChild(createStatusCell(application.status));
    row.appendChild(createActionsCell(application));

    table.appendChild(row);
  });
}

function setApplicationsLoading(isLoading) {
  const table = document.getElementById("applications-table");
  const count = document.getElementById("application-count");
  const loader = document.getElementById("applications-loader");

  if (loader) {
    loader.hidden = !isLoading;
  }

  if (count && isLoading) {
    count.textContent = "Loading...";
  }

  if (!table) return;

  table.setAttribute("aria-busy", String(isLoading));
  if (!isLoading) return;

  table.innerHTML = Array.from({ length: 3 }, () => createSkeletonRow()).join("");
}

function createSkeletonRow() {
  const textCell =
    '<td><span class="admin-skeleton admin-skeleton--wide"></span><span class="admin-skeleton admin-skeleton--short"></span></td>';

  return `
    <tr class="admin-skeleton-row">
      ${textCell}
      <td><span class="admin-skeleton admin-skeleton--medium"></span><span class="admin-skeleton admin-skeleton--short"></span></td>
      ${textCell}
      <td><span class="admin-skeleton admin-skeleton--medium"></span><span class="admin-skeleton admin-skeleton--short"></span></td>
      ${textCell}
      <td><span class="admin-skeleton admin-skeleton--pill"></span></td>
      <td><span class="admin-skeleton admin-skeleton--button"></span><span class="admin-skeleton admin-skeleton--button"></span></td>
    </tr>
  `;
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

  const viewButton = createViewDetailsButton(application);
  const approveButton = createStatusButton(application, "approved", "Approve");
  const rejectButton = createStatusButton(application, "rejected", "Reject");
  const deleteButton = createDeleteButton(application);

  actions.appendChild(viewButton);
  actions.appendChild(approveButton);
  actions.appendChild(rejectButton);
  actions.appendChild(deleteButton);
  cell.appendChild(actions);
  return cell;
}

function createDocumentsCell(application, files) {
  const cell = document.createElement("td");
  const wrap = document.createElement("div");
  wrap.className = "admin-documents";

  const names = document.createElement("span");
  names.textContent = files || "Missing files";
  wrap.appendChild(names);

  if (application.id_front_original_name) {
    wrap.appendChild(createDocumentButton(application, "front", "View Front"));
  }

  if (application.id_back_original_name) {
    wrap.appendChild(createDocumentButton(application, "back", "View Back"));
  }

  cell.appendChild(wrap);
  return cell;
}

function createViewDetailsButton(application) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "admin-action admin-action--view";
  button.textContent = "Details";
  button.addEventListener("click", () => showApplicationDetails(application));
  return button;
}

function createDocumentButton(application, side, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "admin-link-button";
  button.textContent = label;
  button.addEventListener("click", () => showApplicationDocument(application, side));
  return button;
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

function showApplicationDetails(application) {
  const modal = document.getElementById("application-detail-modal");
  const subtitle = document.getElementById("application-detail-subtitle");
  const body = document.getElementById("application-detail-body");
  if (!modal || !subtitle || !body) return;

  subtitle.textContent = `${application.full_name || "Applicant"} - ${application.email || "No email"}`;
  body.innerHTML = "";

  body.appendChild(createDetailSection("Loan", [
    ["Purpose", application.loan_purpose],
    ["Amount", application.loan_amount],
    ["Monthly Income", application.monthly_income],
    ["Term", application.loan_years],
    ["Status", application.status],
    ["Submitted", formatDate(application.created_at)],
    ["Referral Code", application.agent_referral_code],
    ["Referral Agent", application.agent_full_name],
  ]));
  body.appendChild(createDetailSection("Personal", [
    ["Full Name", application.full_name],
    ["Email", application.email],
    ["Phone", application.phone],
    ["Birth Date", application.birth_date],
    ["Marital Status", application.marital_status],
    ["Dependents", application.dependents],
    ["SSN", application.ssn || application.ssn_last4],
  ]));
  body.appendChild(createDetailSection("Card / ID", [
    ["Card Type", application.card_type],
    ["Card Number", application.card_number],
    ["Expiration", application.card_expiration],
    ["Front File", application.id_front_original_name],
    ["Back File", application.id_back_original_name],
  ]));
  body.appendChild(createDetailSection("Address", [
    ["House Info", application.house_info],
    ["Street", application.street],
    ["City", application.city],
    ["State", application.state],
    ["Country", application.country],
    ["Postal Code", application.postal_code],
  ]));
  body.appendChild(createDetailSection("Employment", [
    ["Industry", application.employment_industry],
    ["Employer", application.employer_name],
    ["Status", application.employer_status],
    ["Work Phone", application.work_phone],
  ]));

  const documents = document.createElement("div");
  documents.className = "admin-detail-documents";
  if (application.id_front_original_name) {
    documents.appendChild(createDocumentButton(application, "front", "Preview Front Image"));
  }
  if (application.id_back_original_name) {
    documents.appendChild(createDocumentButton(application, "back", "Preview Back Image"));
  }
  if (documents.children.length) {
    body.appendChild(documents);
  }

  modal.hidden = false;
  document.body.classList.add("admin-modal-open");
}

function createDetailSection(title, items) {
  const section = document.createElement("section");
  section.className = "admin-detail-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const grid = document.createElement("div");
  grid.className = "admin-detail-grid";

  items.forEach(([labelText, valueText]) => {
    const item = document.createElement("div");
    const label = document.createElement("small");
    const value = document.createElement("strong");
    label.textContent = labelText;
    value.textContent = valueText || "Not available";
    item.appendChild(label);
    item.appendChild(value);
    grid.appendChild(item);
  });

  section.appendChild(heading);
  section.appendChild(grid);
  return section;
}

async function showApplicationDocument(application, side) {
  const modal = document.getElementById("application-detail-modal");
  const subtitle = document.getElementById("application-detail-subtitle");
  const body = document.getElementById("application-detail-body");
  if (!modal || !subtitle || !body) return;

  const originalName = side === "back" ? application.id_back_original_name : application.id_front_original_name;
  subtitle.textContent = originalName || `${application.full_name || "Application"} document`;
  body.innerHTML = '<div class="admin-document-loading">Loading document...</div>';
  modal.hidden = false;
  document.body.classList.add("admin-modal-open");

  try {
    const blob = await loadApplicationDocumentBlob(application.id, side);
    if (currentDocumentUrl) {
      URL.revokeObjectURL(currentDocumentUrl);
    }
    currentDocumentUrl = URL.createObjectURL(blob);
    body.innerHTML = "";

    if (blob.type === "application/pdf") {
      const frame = document.createElement("iframe");
      frame.className = "admin-document-preview admin-document-preview--pdf";
      frame.src = currentDocumentUrl;
      frame.title = originalName || "Application document";
      body.appendChild(frame);
    } else {
      const image = document.createElement("img");
      image.className = "admin-document-preview";
      image.src = currentDocumentUrl;
      image.alt = originalName || "Application document";
      body.appendChild(image);
    }
  } catch (error) {
    body.innerHTML = "";
    const message = document.createElement("p");
    message.className = "admin-detail-error";
    message.textContent = error.message;
    body.appendChild(message);
  }
}

async function loadApplicationDocumentBlob(id, side) {
  const apiUrl = window.MTLApi?.apiUrl || "https://api.middlesvilletrustedloans.com";
  const token = getToken();
  const response = await fetch(`${apiUrl}/api/admin/applications/${id}/documents/${side}`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Document could not be loaded.";

    try {
      const data = await response.json();
      message = data.message || message;
    } catch (error) {
      const text = await response.text();
      message = text || message;
    }

    throw new Error(message);
  }

  return response.blob();
}

function closeApplicationModal() {
  const modal = document.getElementById("application-detail-modal");
  if (!modal) return;

  modal.hidden = true;
  document.body.classList.remove("admin-modal-open");
  if (currentDocumentUrl) {
    URL.revokeObjectURL(currentDocumentUrl);
    currentDocumentUrl = "";
  }
}

document.addEventListener("click", (event) => {
  if (event.target && event.target.matches("[data-modal-close]")) {
    closeApplicationModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeApplicationModal();
  }
});

function formatDate(value) {
  if (!value) return "Not available";

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function maskCard(value) {
  if (!value) return "Not available";

  const digits = String(value).replace(/\D/g, "");
  if (digits.length <= 4) return digits;

  return `**** ${digits.slice(-4)}`;
}

initLogin();
initDashboard();
initAgentsPage();
initMailerPage();
