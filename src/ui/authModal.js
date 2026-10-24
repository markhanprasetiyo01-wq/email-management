// ============================================================================
// AUTHENTICATION MODAL (src/ui/authModal.js)
// ============================================================================
// Modal dialog untuk Register (dengan proteksi 1 IP = 1 Akun) & Login
// Mengikuti tema visual website: Dark Cyber Indigo, Clean Typography, SVG Icons

import { authService } from "../services/authService.js";
import { showToast } from "./toast.js";

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
              <span>🎮</span>
            </div>
            <div>
              <h2 class="modal-title" style="font-size: 1.15rem; font-weight: 800; letter-spacing: -0.01em;">
                ${isRegister ? "Buat Akun Hub Baru" : "Masuk ke Game & Email Hub"}
              </h2>
              <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.2rem;">
                ${isRegister ? "1 IP hanya dapat membuat 1 akun pribadi" : "Akses aman ke data game & email terhubung"}
              </div>
            </div>
          </div>
          ${
            authService.isLoggedIn()
              ? `<button class="btn btn-icon-only btn-sm" id="auth-close-btn" style="border: none; background: transparent; color: var(--text-muted);" title="Tutup">✕</button>`
              : ""
          }
        </div>

        <div class="modal-body" style="padding: 1.4rem;">
          <!-- Tab Switcher Navigasi: Masuk vs Daftar -->
          <div class="auth-tab-nav">
            <button type="button" class="auth-tab-btn ${!isRegister ? "active" : ""}" id="tab-auth-login">
              <span>🔑</span>
              <span>Masuk Akun</span>
            </button>
            <button type="button" class="auth-tab-btn ${isRegister ? "active" : ""}" id="tab-auth-register">
              <span>✨</span>
              <span>Daftar Baru</span>
            </button>
          </div>

          <!-- Formulir Kredensial Pengguna -->
          <form id="auth-form" style="display: flex; flex-direction: column; gap: 1rem;">
            <div class="form-group">
              <label class="form-label" for="auth-email">Alamat Email *</label>
              <div class="auth-input-container">
                <span class="auth-input-icon">✉️</span>
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
                <span class="auth-input-icon">🔒</span>
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
                  👁️
                </button>
              </div>
            </div>

          

            <button type="submit" class="btn btn-primary" id="btn-submit-auth" style="width: 100%; padding: 0.75rem 1rem; margin-top: 0.35rem; font-weight: 700; font-size: 0.9rem; letter-spacing: 0.01em;">
              ${isRegister ? "Daftar Akun Baru ✨" : "Masuk Sekarang 🚀"}
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
        togglePassBtn.textContent = isPassword ? "🙈" : "👁️";
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
