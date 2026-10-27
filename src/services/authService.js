// ============================================================================
// AUTHENTICATION CLIENT SERVICE (src/services/authService.js)
// ============================================================================
// Mengelola status login, session token di browser, register (1 IP = 1 Akun),
// dan request header otorisasi ke backend.

const TOKEN_KEY = "gamemail_auth_token";
const USER_KEY = "gamemail_auth_user";

export const authService = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  },

  getUser() {
    try {
      const u = localStorage.getItem(USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  isAdmin() {
    const user = this.getUser();
    return !!user?.isAdmin;
  },

  async getRegisteredUsers() {
    const token = this.getToken();
    if (!token) throw new Error("Anda belum login!");

    const res = await fetch("/api/auth?action=list_users", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Gagal mengambil daftar pengguna!");
    }
    return data;
  },

  setSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  async register(email, password) {
    const res = await fetch("/api/auth?action=register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Gagal registrasi!");
    }

    if (data.token && data.user) {
      this.setSession(data.token, data.user);
    }
    return data;
  },

  async verifyEmail(params) {
    // params: { token } atau { email, code }
    const res = await fetch("/api/auth?action=verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Verifikasi gagal!");
    }

    if (data.token && data.user) {
      this.setSession(data.token, data.user);
    }
    return data;
  },

  async login(email, password) {
    const res = await fetch("/api/auth?action=login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Gagal login!");
    }

    this.setSession(data.token, data.user);
    return data;
  },

  async checkAuth() {
    const token = this.getToken();
    if (!token) return null;

    try {
      const res = await fetch("/api/auth?action=me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        this.clearSession();
        return null;
      }
      const data = await res.json();
      if (data?.user) {
        this.setSession(token, data.user);
        return data.user;
      }
      return null;
    } catch {
      return this.getUser();
    }
  },

  async logout() {
    const token = this.getToken();
    try {
      if (token) {
        await fetch("/api/auth?action=logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } finally {
      this.clearSession();
      window.location.reload();
    }
  },
};
