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

      setText("agent-name", agent.fullName || "Agent");
      setText("agent-email", agent.email || "");
      setText("agent-phone", agent.phone || "Not added");
      setText("agent-company", agent.companyName || "Independent agent");
      setText("agent-created", formatDate(agent.createdAt));
      setText("agent-last-login", formatDate(agent.lastLoginAt));
      setText("agent-referrals", metrics.referrals || 0);
      setText("agent-pending", metrics.pendingApplications || 0);
      setText("agent-approved", metrics.approvedApplications || 0);
      setText("agent-messages", metrics.messages || 0);

      const activityList = document.getElementById("agent-activity");
      if (activityList) {
        activityList.innerHTML = "";
        (data.recentActivity || []).forEach((item) => {
          const li = document.createElement("li");
          li.textContent = item;
          activityList.appendChild(li);
        });
      }

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
  }

  document.addEventListener("DOMContentLoaded", () => {
    initAgentAuth();
    initAgentDashboard();
  });
})(window, document);
