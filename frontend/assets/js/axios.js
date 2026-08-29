(function (window) {
  "use strict";

  const API_URL = window.MTL_API_URL || "https://api.middlesvilletrustedloans.com";
  const tokenKey = "mtl_admin_token";
  const agentTokenKey = "mtl_agent_token";
  const client = window.axios.create({
    baseURL: API_URL,
    timeout: 20000,
  });

  client.interceptors.request.use(function (config) {
    const token = window.localStorage.getItem(tokenKey);
    config.headers = config.headers || {};
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  function getErrorMessage(error) {
    if (error.code === "ECONNABORTED" || /timeout/i.test(error.message || "")) {
      return "The request is taking longer than expected. Please check your connection and try again.";
    }

    return error.response?.data?.message || error.message || "Request failed.";
  }

  async function request(config) {
    try {
      const response = await client(config);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  window.MTLApi = {
    apiUrl: API_URL,
    tokenKey,
    agentTokenKey,
    getToken() {
      return window.localStorage.getItem(tokenKey);
    },
    setToken(token) {
      window.localStorage.setItem(tokenKey, token);
    },
    clearToken() {
      window.localStorage.removeItem(tokenKey);
    },
    getAgentToken() {
      return window.localStorage.getItem(agentTokenKey);
    },
    setAgentToken(token) {
      window.localStorage.setItem(agentTokenKey, token);
    },
    clearAgentToken() {
      window.localStorage.removeItem(agentTokenKey);
    },
    login(username, password) {
      return request({
        url: "/api/auth/login",
        method: "POST",
        data: { username, password },
      });
    },
    me() {
      return request({ url: "/api/auth/me", method: "GET" });
    },
    logout() {
      return request({ url: "/api/auth/logout", method: "POST" });
    },
    agentLogin(email, password) {
      return request({
        url: "/api/auth/agent/login",
        method: "POST",
        data: { email, password },
      });
    },
    agentRegister(agent) {
      return request({
        url: "/api/auth/agent/register",
        method: "POST",
        data: agent,
      });
    },
    agentMe() {
      return request({
        url: "/api/auth/agent/me",
        method: "GET",
        headers: { Authorization: `Bearer ${window.localStorage.getItem(agentTokenKey) || ""}` },
      });
    },
    agentDashboard() {
      return request({
        url: "/api/auth/agent/dashboard",
        method: "GET",
        headers: { Authorization: `Bearer ${window.localStorage.getItem(agentTokenKey) || ""}` },
      });
    },
    agentLogout() {
      return request({
        url: "/api/auth/logout",
        method: "POST",
        headers: { Authorization: `Bearer ${window.localStorage.getItem(agentTokenKey) || ""}` },
      });
    },
    dashboard() {
      return request({ url: "/api/admin/dashboard", method: "GET" });
    },
    agents() {
      return request({ url: "/api/admin/agents", method: "GET" });
    },
    updateReferralSettings(requiredApprovedApplications, payoutAmount) {
      return request({
        url: "/api/admin/referral-settings",
        method: "PUT",
        data: { requiredApprovedApplications, payoutAmount },
      });
    },
    sendAdminMail(email, subject, message) {
      return request({
        url: "/api/admin/mailer",
        method: "POST",
        data: { email, subject, message },
      });
    },
    updateApplicationStatus(id, status) {
      return request({
        url: `/api/admin/applications/${id}/status`,
        method: "PATCH",
        data: { status },
      });
    },
    deleteApplication(id) {
      return request({
        url: `/api/admin/applications/${id}`,
        method: "DELETE",
      });
    },
    async getApplicationDocument(id, side) {
      const config = {
        url: `/api/admin/applications/${id}/documents/${side}`,
        method: "GET",
        responseType: "blob",
        timeout: 90000,
      };

      try {
        const response = await client(config);
        return response.data;
      } catch (error) {
        if (error.code === "ECONNABORTED") {
          try {
            const response = await client(config);
            return response.data;
          } catch (retryError) {
            throw new Error(getErrorMessage(retryError));
          }
        }

        throw new Error(getErrorMessage(error));
      }
    },
    submitLoanApplication(formData) {
      return request({
        url: "/api/applications",
        method: "POST",
        data: formData,
        timeout: 120000,
      });
    },
    checkLoanStatus(email) {
      return request({
        url: "/api/applications/status",
        method: "POST",
        data: { email },
      });
    },
    submitNewsletter(email) {
      return request({
        url: "/api/newsletter",
        method: "POST",
        data: { email },
      });
    },
    submitContactMessage(message) {
      return request({
        url: "/api/contact",
        method: "POST",
        data: message,
      });
    },
  };
})(window);
