// ============================================================================
// MODUL RENDER MANAJEMEN EMAIL (src/ui/renderEmails.js)
// ============================================================================
// Modul ini bertugas menampilkan antarmuka tab "Manajemen Akun Email".
// 
// FUNGSI UTAMA:
// 1. Mengambil seluruh inventaris email dari `store.getEmails()`.
// 2. Menghubungkan setiap email dengan game-game yang didaftarkan.
// 3. Menghitung ringkasan status per email (berapa game Live, Praregist, dan Maintenance).
// 4. Merender kartu email dengan badge label, recovery email, catatan, dan chip game.
// 5. Menyediakan tombol aksi: Tambah Email Baru, Hubungkan Game, Edit Email, dan Hapus Email.

import { store } from "../data/store.js";
import {
  openEmailModal,
  openRegistrationModal,
  openConfirmModal,
} from "./modals.js";
import { showToast } from "./toast.js";

/**
 * renderEmails(container)
 * -----------------------
 * Merender daftar manajemen email ke dalam elemen HTML container yang diberikan.
 * 
 * @param {HTMLElement} container - Elemen DOM wadah tempat tampilan akan disisipkan
 */
export function renderEmails(container) {
  const emails = store.getEmails();
  const allRegistrations = store.getEnrichedRegistrations();

  container.innerHTML = `
    <!-- Header Halaman Email -->
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
      <div>
        <h2 style="font-family:var(--font-heading); font-size:1.4rem; color:#fff;">Manajemen Akun Email</h2>
        <p style="font-size:0.85rem; color:var(--text-muted);">Kelola alamat email dan pantau game apa saja yang terdaftar di masing-masing email.</p>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-add-email-tab">
        <span>+ Tambah Email Baru</span>
      </button>
    </div>

    ${
      // Tampilan Kosong (Empty State) jika belum ada email
      emails.length === 0
        ? `
      <div class="empty-state">
        <div class="empty-icon">✉️</div>
        <h3 class="empty-title">Belum Ada Email Terdaftar</h3>
        <p class="empty-desc">Tambahkan alamat email pertama Anda untuk mulai mengorganisir akun game.</p>
        <button class="btn btn-primary btn-sm" id="btn-empty-add-email">+ Tambah Email Baru</button>
      </div>
    `
        : `
      <!-- Grid Berisi Kartu-Kartu Email -->
      <div class="management-grid">
        ${emails
          .map((email) => {
            // Ambil semua game yang didaftarkan menggunakan email ini
            const linkedRegs = allRegistrations.filter(
              (r) => r.emailId === email.id,
            );
            // Hitung komposisi status game untuk email ini
            const liveCount = linkedRegs.filter(
              (r) => r.status === "live",
            ).length;
            const praregistCount = linkedRegs.filter(
              (r) => r.status === "praregist",
            ).length;
            const maintCount = linkedRegs.filter(
              (r) => r.status === "maintenance",
            ).length;

            return `
            <div class="manage-card">
              <!-- Header Kartu Email: Ikon, Alamat Email, Provider & Badge Total Game -->
              <div class="manage-card-header">
                <div style="display:flex; align-items:center; gap:0.6rem;">
                  <span style="font-size:1.3rem;">📬</span>
                  <div>
                    <div style="font-family:var(--font-mono); font-size:0.95rem; font-weight:600; color:#fff;">${email.address}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${email.provider || "Provider"} • <span style="color:var(--text-dim);">${email.label}</span></div>
                  </div>
                </div>
                <span class="badge-tag">${linkedRegs.length} Game</span>
              </div>

              <!-- Email Pemulihan (Recovery Email) jika ada -->
              ${
                email.recoveryEmail
                  ? `
                <div style="font-size:0.78rem; color:var(--text-dim);">
                  🛡️ Recovery: <span style="color:var(--text-muted);">${email.recoveryEmail}</span>
                </div>
              `
                  : ""
              }

              <!-- Catatan Tambahan Email jika ada -->
              ${
                email.notes
                  ? `
                <div class="card-notes">📝 ${email.notes}</div>
              `
                  : ""
              }

              <!-- Statistik Ringkas Status Game pada Email Ini -->
              <div style="display:flex; gap:0.5rem; font-size:0.75rem;">
                <span style="color:var(--status-live); font-weight:600;">🟢 ${liveCount} Live</span>
                <span style="color:var(--status-praregist); font-weight:600;">🟡 ${praregistCount} Prareg</span>
                ${maintCount > 0 ? `<span style="color:var(--status-maint); font-weight:600;">🔴 ${maintCount} Maint</span>` : ""}
              </div>

              <!-- Daftar Chip Game yang Terdaftar pada Email Ini -->
              <div>
                <div style="font-size:0.75rem; font-weight:600; color:var(--text-dim); text-transform:uppercase; margin-bottom:0.35rem;">Game Terdaftar:</div>
                ${
                  linkedRegs.length === 0
                    ? `
                  <div style="font-size:0.78rem; color:var(--text-dim); font-style:italic;">Belum terhubung ke game manapun</div>
                `
                    : `
                  <div class="linked-games-pillbox">
                    ${linkedRegs
                      .map((r) => {
                        const statusColor =
                          r.status === "live"
                            ? "var(--status-live)"
                            : r.status === "praregist"
                              ? "var(--status-praregist)"
                              : "var(--status-maint)";
                        return `
                        <div class="linked-game-chip" title="Status: ${r.status} | IGN: ${r.ign}">
                          <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${statusColor};"></span>
                          <span style="font-weight:600; color:#fff;">${r.game.title}</span>
                          <span style="color:var(--text-dim); font-size:0.7rem;">(${r.ign})</span>
                        </div>
                      `;
                      })
                      .join("")}
                  </div>
                `
                }
              </div>

              <!-- Tombol Aksi Bawah Kartu -->
              <div style="margin-top:auto; padding-top:0.75rem; border-top:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:space-between;">
                <button class="btn btn-secondary btn-sm" data-action="link-game-to-email" data-email-id="${email.id}">
                  + Hubungkan Game
                </button>
                <div style="display:flex; gap:0.35rem;">
                  <button class="btn btn-secondary btn-sm btn-icon-only" data-action="edit-email" data-id="${email.id}" title="Edit Email">✏️</button>
                  <button class="btn btn-danger btn-sm btn-icon-only" data-action="delete-email" data-id="${email.id}" title="Hapus Email">🗑️</button>
                </div>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    `
    }
  `;

  // ==========================================================================
  // MENDAFTARKAN EVENT LISTENER UNTUK AKSI INTERAKTIF
  // ==========================================================================

  // Tombol Tambah Email Baru
  container
    .querySelector("#btn-add-email-tab")
    ?.addEventListener("click", () => openEmailModal());
  container
    .querySelector("#btn-empty-add-email")
    ?.addEventListener("click", () => openEmailModal());

  // Tombol "+ Hubungkan Game" pada kartu email
  container
    .querySelectorAll('[data-action="link-game-to-email"]')
    .forEach((btn) => {
      btn.onclick = () => {
        openRegistrationModal(null, { emailId: btn.dataset.emailId });
      };
    });

  // Tombol Edit Email (Pensil)
  container.querySelectorAll('[data-action="edit-email"]').forEach((btn) => {
    btn.onclick = () => {
      openEmailModal(btn.dataset.id);
    };
  });

  // Tombol Hapus Email (Tong Sampah) dengan modal konfirmasi
  container.querySelectorAll('[data-action="delete-email"]').forEach((btn) => {
    btn.onclick = () => {
      const emailId = btn.dataset.id;
      const emailObj = emails.find((e) => e.id === emailId);
      openConfirmModal(
        "Hapus Alamat Email",
        `Apakah Anda yakin ingin menghapus email "${emailObj?.address}"? Semua riwayat registrasi game yang menggunakan email ini juga akan terhapus.`,
        () => {
          store.deleteEmail(emailId);
          showToast("Email berhasil dihapus");
        },
      );
    };
  });
}
