// ============================================================================
// AUTHENTICATION MODAL (src/ui/authModal.js)
// ============================================================================
// Modal dialog untuk Register (dengan proteksi 1 IP = 1 Akun) & Login
// Mengikuti tema visual website: Dark Cyber Indigo, Clean Typography, SVG Icons

import { authService } from "../services/authService.js";
import { showToast } from "./toast.js";

const AUTH_SVGS = {
  gamepad: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect width="20" height="12" x="2" y="6" rx="6"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  key: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-2 2m-1.5 1.5L16 7l-1.5-1.5-1.5 1.5 1.5 1.5-1.5 1.5-1.5-1.5-3.5 3.5a6.5 6.5 0 1 0 3 3l3.5-3.5Z"/></svg>`,
  userPlus: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" x2="20" y1="8" y2="14"/><line x1="23" x2="17" y1="11" y2="11"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>`,
  close: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
};

let authModalEl = null;

export function openAuthModal(defaultMode = "login") {
  if (!authModalEl) {
    authModalEl = document.createElement("div");
    authModalEl.className = "modal-overlay";
    document.body.appendChild(authModalEl);
  }

  let mode = defaultMode; // 'login' | 'register'

  function renderModal() {
    const isRegister = mode === "register";

    authModalEl.innerHTML = `
      <div class="modal-box auth-modal-card">
        <!-- Header Modal Bertema Game Hub -->
        <div class="auth-header-wrapper">
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <div class="auth-brand-badge">
              ${AUTH_SVGS.gamepad}
            </div>
            <div>
              <h2 class="modal-title" style="font-size: 1.15rem; font-weight: 800; letter-spacing: -0.01em;">
                ${isRegister ? "Daftar Akun Baru" : "Masuk ke GameHub"}
              </h2>
              <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.2rem;">
                ${isRegister ? "1 IP hanya dapat membuat 1 akun terenkripsi" : "Akses aman ke portofolio game & email Anda"}
              </div>
            </div>
          </div>
          ${
            authService.isLoggedIn()
              ? `<button class="btn btn-icon-only btn-sm" id="auth-close-btn" style="border: none; background: transparent; color: var(--text-muted);" title="Tutup">${AUTH_SVGS.close}</button>`
              : ""
          }
        </div>

        <div class="modal-body" style="padding: 1.4rem;">
          <!-- Tab Switcher Navigasi: Masuk vs Daftar -->
          <div class="auth-tab-nav">
            <button type="button" class="auth-tab-btn ${!isRegister ? "active" : ""}" id="tab-auth-login">
              <span>${AUTH_SVGS.key}</span>
              <span>Masuk Akun</span>
            </button>
            <button type="button" class="auth-tab-btn ${isRegister ? "active" : ""}" id="tab-auth-register">
              <span>${AUTH_SVGS.userPlus}</span>
              <span>Daftar Baru</span>
            </button>
          </div>

          <!-- Formulir Kredensial Pengguna -->
          <form id="auth-form" style="display: flex; flex-direction: column; gap: 1rem;">
            <div class="form-group">
              <label class="form-label" for="auth-email">Alamat Email *</label>
              <div class="auth-input-container">
                <span class="auth-input-icon">${AUTH_SVGS.mail}</span>
                <input 
                  type="email" 
                  class="form-input auth-input-field" 
                  id="auth-email" 
                  placeholder="nama@email.com" 
                  required 
                  autocomplete="username"
                  autofocus
                >
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="auth-password">Kata Sandi (Password) *</label>
              <div class="auth-input-container">
                <span class="auth-input-icon">${AUTH_SVGS.lock}</span>
                <input 
                  type="password" 
                  class="form-input auth-input-field" 
                  id="auth-password" 
                  placeholder="Minimal 6 karakter" 
                  required 
                  minlength="6"
                  autocomplete="${isRegister ? "new-password" : "current-password"}"
                  style="padding-right: 2.5rem !important;"
                >
                <button 
                  type="button" 
                  id="btn-toggle-password" 
                  style="position: absolute; right: 0.65rem; background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 0.25rem; font-size: 1rem; display: flex; align-items: center; justify-content: center;" 
                  title="Lihat / Sembunyikan Password"
                >
                  ${AUTH_SVGS.eye}
                </button>
              </div>
            </div>

            <button type="submit" class="btn btn-primary" id="btn-submit-auth" style="width: 100%; padding: 0.75rem 1rem; margin-top: 0.35rem; font-weight: 700; font-size: 0.9rem; letter-spacing: 0.01em;">
              ${isRegister ? "Daftar Akun Baru" : "Masuk Sekarang"}
            </button>
          </form>

          <!-- Footer Switcher Link -->
          <div style="text-align: center; margin-top: 1.15rem; font-size: 0.8rem; color: var(--text-secondary);">
            ${
              !isRegister
                ? `Belum memiliki akun? <a href="#" id="toggle-auth-mode" style="color: #818cf8; font-weight: 700; text-decoration: none; margin-left: 0.25rem;">Daftar di sini</a>`
                : `Sudah memiliki akun? <a href="#" id="toggle-auth-mode" style="color: #818cf8; font-weight: 700; text-decoration: none; margin-left: 0.25rem;">Masuk di sini</a>`
            }
          </div>
        </div>
      </div>
    `;

    // Listener tombol close jika ada
    const closeBtn = document.getElementById("auth-close-btn");
    if (closeBtn) {
      closeBtn.onclick = () => {
        authModalEl.classList.remove("active");
      };
    }

    // Listener Tab Tombol
    document.getElementById("tab-auth-login").onclick = () => {
      if (mode !== "login") {
        mode = "login";
        renderModal();
      }
    };
    document.getElementById("tab-auth-register").onclick = () => {
      if (mode !== "register") {
        mode = "register";
        renderModal();
      }
    };

    // Listener Toggle Text Link
    document.getElementById("toggle-auth-mode").onclick = (e) => {
      e.preventDefault();
      mode = mode === "login" ? "register" : "login";
      renderModal();
    };

    // Listener Lihat / Sembunyikan Password (Show / Hide)
    const togglePassBtn = document.getElementById("btn-toggle-password");
    const passwordInput = document.getElementById("auth-password");
    if (togglePassBtn && passwordInput) {
      togglePassBtn.onclick = () => {
        const isPassword = passwordInput.getAttribute("type") === "password";
        passwordInput.setAttribute("type", isPassword ? "text" : "password");
        togglePassBtn.innerHTML = isPassword ? AUTH_SVGS.eyeOff : AUTH_SVGS.eye;
        togglePassBtn.title = isPassword
          ? "Sembunyikan Password"
          : "Lihat Password";
      };
    }

    // Form Submit
    const form = document.getElementById("auth-form");
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById("auth-email").value.trim();
        const password = document.getElementById("auth-password").value.trim();
        const btn = document.getElementById("btn-submit-auth");

        btn.disabled = true;
        btn.textContent = "⏳ Memproses...";

        try {
          if (mode === "login") {
            await authService.login(email, password);
            showToast("Berhasil masuk! Selamat datang kembali.");
            authModalEl.classList.remove("active");
            window.location.reload();
          } else {
            const res = await authService.register(email, password);
            if (res.pending) {
              // Tampilkan layar konfirmasi kode verifikasi email
              renderVerifyStep(email);
              showToast(
                "Email verifikasi telah dikirim! Cek inbox Anda.",
                "info",
              );
            } else {
              showToast("Akun berhasil dibuat! Ruang kerja Anda telah siap.");
              authModalEl.classList.remove("active");
              window.location.reload();
            }
          }
        } catch (err) {
          showToast(err.message || "Terjadi kesalahan!", "error");
          btn.disabled = false;
          btn.textContent =
            mode === "login" ? "Masuk Sekarang 🚀" : "Daftar Akun Baru ✨";
        }
      };
    }
  }

  function renderVerifyStep(targetEmail) {
    authModalEl.innerHTML = `
      <div class="modal-box auth-modal-card">
        <div class="auth-header-wrapper">
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <div class="auth-brand-badge" style="background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.35);">
              <span>📬</span>
            </div>
            <div>
              <h2 class="modal-title" style="font-size: 1.15rem; font-weight: 800; letter-spacing: -0.01em;">
                Verifikasi Email Anda
              </h2>
              <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.2rem;">
                Tautan & kode verifikasi telah dikirim ke email Anda
              </div>
            </div>
          </div>
        </div>

        <div class="modal-body" style="padding: 1.4rem;">
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: var(--radius-md); padding: 0.85rem 1rem; margin-bottom: 1.1rem;">
            <div style="font-size: 0.82rem; color: #a7f3d0; line-height: 1.5;">
              ✉️ Kami telah mengirimkan email aktivasi ke: <strong style="color: #fff; word-break: break-all;">${targetEmail}</strong>.
            </div>
            <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.35rem;">
              Silakan <strong>klik tombol di dalam email</strong> atau masukkan <strong>kode verifikasi 6-digit</strong> di bawah:
            </div>
            <div style="margin-top: 0.5rem; font-size: 0.73rem; color: #fef08a; background: rgba(245, 158, 11, 0.1); padding: 0.35rem 0.5rem; border-radius: 4px; border-left: 2px solid #f59e0b;">
              💡 <em>Tips: Jika tidak ada di Kotak Masuk (Inbox), silakan periksa folder <strong>Spam / Promosi</strong> dan tandai sebagai "Bukan Spam".</em>
            </div>
          </div>

          <form id="verify-form" style="display: flex; flex-direction: column; gap: 1rem;">
            <div class="form-group">
              <label class="form-label" for="verify-code">Kode Verifikasi 6-Digit</label>
              <div class="auth-input-container">
                <span class="auth-input-icon">🔑</span>
                <input 
                  type="text" 
                  class="form-input auth-input-field" 
                  id="verify-code" 
                  placeholder="Contoh: 123456" 
                  maxlength="6"
                  required 
                  autofocus
                  style="letter-spacing: 4px; font-weight: 800; font-size: 1.1rem; text-align: center;"
                >
              </div>
            </div>

            <button type="submit" class="btn btn-primary" id="btn-submit-verify" style="width: 100%; padding: 0.75rem 1rem; font-weight: 700; font-size: 0.9rem;">
              ✅ Aktivasi Akun Sekarang
            </button>
          </form>

          <div style="text-align: center; margin-top: 1.15rem; font-size: 0.8rem; color: var(--text-secondary);">
            Salah memasukkan email? <a href="#" id="back-to-register" style="color: #818cf8; font-weight: 700; text-decoration: none;">Daftar ulang</a>
          </div>
        </div>
      </div>
    `;

    document.getElementById("back-to-register").onclick = (e) => {
      e.preventDefault();
      mode = "register";
      renderModal();
    };

    const verifyForm = document.getElementById("verify-form");
    verifyForm.onsubmit = async (e) => {
      e.preventDefault();
      const code = document.getElementById("verify-code").value.trim();
      const btn = document.getElementById("btn-submit-verify");

      btn.disabled = true;
      btn.textContent = "⏳ Memvalidasi kode...";

      try {
        await authService.verifyEmail({ email: targetEmail, code });
        showToast("Email berhasil diverifikasi! Selamat datang.");
        authModalEl.classList.remove("active");
        window.location.reload();
      } catch (err) {
        showToast(
          err.message || "Kode verifikasi salah atau kedaluwarsa!",
          "error",
        );
        btn.disabled = false;
        btn.textContent = "✅ Aktivasi Akun Sekarang";
      }
    };
  }

  renderModal();
  authModalEl.classList.add("active");
}
