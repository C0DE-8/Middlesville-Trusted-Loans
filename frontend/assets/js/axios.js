(function (window) {
  "use strict";

  const API_URL = window.MTL_API_URL || "https://api.middlesvilletrustedloans.com";
  const tokenKey = "mtl_admin_token";
  const client = window.axios.create({
    baseURL: API_URL,
    timeout: 20000,
  });

  client.interceptors.request.use(function (config) {
    const token = window.localStorage.getItem(tokenKey);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  function getErrorMessage(error) {
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
    getToken() {
      return window.localStorage.getItem(tokenKey);
    },
    setToken(token) {
      window.localStorage.setItem(tokenKey, token);
    },
    clearToken() {
      window.localStorage.removeItem(tokenKey);
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
    dashboard() {
      return request({ url: "/api/admin/dashboard", method: "GET" });
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
      try {
        const response = await client({
          url: `/api/admin/applications/${id}/documents/${side}`,
          method: "GET",
          responseType: "blob",
        });
        return response.data;
      } catch (error) {
        throw new Error(getErrorMessage(error));
      }
    },
    submitLoanApplication(formData) {
      return request({
        url: "/api/applications",
        method: "POST",
        data: formData,
      });
    },
    checkLoanStatus(email) {
      return request({
        url: "/api/applications/status",
        method: "POST",
        data: { email },
      });
    },
  };
})(window);
