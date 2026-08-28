(function (window, document) {
  "use strict";

  const dashboardPath = "pages/dashboard.html";

  function setMessage(element, message, isError) {
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("login-page__form-message--error", Boolean(isError));
  }

  function setLoading(form, isLoading, fallbackLabel) {
    const button = form.querySelector("button[type='submit']");
    const label = button ? button.querySelector("span:not(.form-loader)") : null;

    if (!button) return;

    if (!button.dataset.originalLabel && label) {
      button.dataset.originalLabel = label.textContent.trim() || fallbackLabel;
    }

    button.disabled = isLoading;
    button.classList.toggle("is-loading", isLoading);

    if (label) {
      label.textContent = isLoading ? "Please wait" : button.dataset.originalLabel || fallbackLabel;
    }
  }

  function activateTab(targetSelector) {
    const target = document.querySelector(targetSelector);
    const tabBox = target ? target.closest(".tabs-box") : null;
    if (!target || !tabBox) return;

    tabBox.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.remove("active-tab");
      tab.style.display = "none";
    });

    tabBox.querySelectorAll(".tab-btn").forEach((button) => {
      button.classList.toggle("active-btn", button.dataset.tab === targetSelector);
    });

    target.classList.add("active-tab");
    target.style.display = "block";
  }

  function initAgentAuth() {
    const loginForm = document.getElementById("agent-login-form");
    const registerForm = document.getElementById("agent-register-form");

    if (!loginForm && !registerForm) return;

    if (window.MTLApi.getAgentToken()) {
      window.location.href = dashboardPath;
      return;
    }

    document.querySelectorAll("[data-agent-tab]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        activateTab(link.dataset.agentTab);
      });
    });

    if (loginForm) {
      loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const message = document.getElementById("agent-login-message");
        const formData = new FormData(loginForm);

        setMessage(message, "");
        setLoading(loginForm, true, "log in");

        try {
          const data = await window.MTLApi.agentLogin(formData.get("email"), formData.get("password"));
          window.MTLApi.setAgentToken(data.token);
          window.location.href = dashboardPath;
        } catch (error) {
          setMessage(message, error.message, true);
          setLoading(loginForm, false, "log in");
        }
      });
    }

    if (registerForm) {
      registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const message = document.getElementById("agent-register-message");
        const formData = new FormData(registerForm);

        setMessage(message, "");
        setLoading(registerForm, true, "Register");

        try {
          const data = await window.MTLApi.agentRegister({
            fullName: formData.get("fullName"),
            email: formData.get("email"),
            phone: formData.get("phone"),
            companyName: formData.get("companyName"),
            password: formData.get("password"),
          });
          window.MTLApi.setAgentToken(data.token);
          window.location.href = dashboardPath;
        } catch (error) {
          setMessage(message, error.message, true);
          setLoading(registerForm, false, "Register");
        }
      });
    }
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  function formatDate(value) {
    if (!value) return "Not yet";
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

  function createReferralUrl(code) {
    return `${window.location.origin}${window.location.pathname.replace(/\/pages\/dashboard\.html$/, "")}/apply-loan.html?ref=${encodeURIComponent(code)}`;
  }

  function renderAgentApplications(applications) {
    const table = document.getElementById("agent-applications-table");
    const count = document.getElementById("agent-application-count");
    if (!table || !count) return;

    count.textContent = `${applications.length} ${applications.length === 1 ? "record" : "records"}`;
    table.innerHTML = "";

    if (!applications.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = "No referred applications yet.";
      row.appendChild(cell);
      table.appendChild(row);
      return;
    }

    applications.forEach((application) => {
      const row = document.createElement("tr");

      [
        `${application.full_name || "Borrower"}\n${application.email || ""}`,
        `${application.loan_purpose || "Loan"}\n${formatMoney(application.loan_amount)}`,
        application.status || "pending",
        formatDate(application.created_at),
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });

      table.appendChild(row);
    });
  }

  async function initAgentDashboard() {
    const dashboard = document.getElementById("agent-dashboard");
    if (!dashboard) return;

    if (!window.MTLApi.getAgentToken()) {
      window.location.href = "../login.html";
      return;
    }

    try {
      const data = await window.MTLApi.agentDashboard();
      const agent = data.agent || {};
      const metrics = data.metrics || {};
      const settings = data.settings || {};
      const referralCode = agent.referralCode || "";
      const referralUrl = createReferralUrl(referralCode);
      const requiredApproved = Number(settings.requiredApprovedApplications || 5);
      const approvedApplications = Number(metrics.approvedApplications || 0);
      const progressCount = requiredApproved > 0 ? approvedApplications % requiredApproved : 0;
      const progressPercent = requiredApproved > 0 ? Math.min((progressCount / requiredApproved) * 100, 100) : 0;

      setText("agent-name", agent.fullName || "Agent");
      setText("agent-email", agent.email || "");
      setText("agent-phone", agent.phone || "Not added");
      setText("agent-company", agent.companyName || "Independent agent");
      setText("agent-created", formatDate(agent.createdAt));
      setText("agent-last-login", formatDate(agent.lastLoginAt));
      setText("agent-referral-code", referralCode);
      setText("agent-referrals", metrics.referrals || 0);
      setText("agent-pending", metrics.pendingApplications || 0);
      setText("agent-approved", metrics.approvedApplications || 0);
      setText("agent-messages", formatMoney(metrics.estimatedEarnings));
      setText(
        "agent-payout-rule",
        `${requiredApproved} approved applications = ${formatMoney(settings.payoutAmount)}`
      );
      setText(
        "agent-progress-text",
        `${progressCount} of ${requiredApproved} approved applications toward the next payout cycle.`
      );

      const referralLink = document.getElementById("agent-referral-link");
      const referralUrlInput = document.getElementById("agent-referral-url");
      const progressBar = document.getElementById("agent-progress-bar");

      if (referralLink) {
        referralLink.href = referralUrl;
      }
      if (referralUrlInput) {
        referralUrlInput.value = referralUrl;
      }
      if (progressBar) {
        progressBar.style.width = `${progressPercent}%`;
      }

      const activityList = document.getElementById("agent-activity");
      if (activityList) {
        activityList.innerHTML = "";
        (data.recentActivity || []).forEach((item) => {
          const li = document.createElement("li");
          li.textContent = item;
          activityList.appendChild(li);
        });
      }

      renderAgentApplications(data.applications || []);

      dashboard.classList.remove("agent-dashboard--loading");
    } catch (error) {
      window.MTLApi.clearAgentToken();
      window.location.href = "../login.html";
    }

    const logoutButton = document.getElementById("agent-logout-button");
    if (logoutButton) {
      logoutButton.addEventListener("click", async () => {
        try {
          await window.MTLApi.agentLogout();
        } finally {
          window.MTLApi.clearAgentToken();
          window.location.href = "../login.html";
        }
      });
    }

    const copyButton = document.getElementById("copy-referral-link");
    if (copyButton) {
      copyButton.addEventListener("click", async () => {
        const referralUrlInput = document.getElementById("agent-referral-url");
        const value = referralUrlInput ? referralUrlInput.value : "";
        if (!value) return;

        try {
          await navigator.clipboard.writeText(value);
          copyButton.textContent = "Copied";
          window.setTimeout(() => {
            copyButton.textContent = "Copy Link";
          }, 1500);
        } catch (error) {
          referralUrlInput.select();
          document.execCommand("copy");
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initAgentAuth();
    initAgentDashboard();
  });
})(window, document);
