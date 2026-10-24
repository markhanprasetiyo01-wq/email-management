// ============================================================================
// MODUL RENDER KATALOG GAME (src/ui/renderGames.js)
// ============================================================================
// Modul ini bertugas menampilkan antarmuka halaman/tab "Katalog & Library Game".
// 
// FUNGSI UTAMA:
// 1. Mengambil seluruh data game dari `store.getGames()`.
// 2. Menghubungkan game dengan data pendaftaran (`store.getEnrichedRegistrations()`).
// 3. Menghitung countdown sisa hari menuju jadwal rilis game (jika ada releaseDate).
// 4. Merender kartu-kartu game dalam bentuk grid (`management-grid`).
// 5. Menampilkan daftar email yang terhubung langsung di dalam kartu game.
// 6. Menyediakan tombol aksi: Tambah Game, Hubungkan Email, Edit Game, dan Hapus Game.

import { store } from "../data/store.js";
import {
  openGameModal,
  openRegistrationModal,
  openConfirmModal,
} from "./modals.js";
import { showToast } from "./toast.js";

/**
 * renderGames(container)
 * ----------------------
 * Merender katalog game ke dalam elemen HTML container yang diberikan.
 * 
 * @param {HTMLElement} container - Elemen DOM wadah tempat tampilan akan disisipkan
 */
export function renderGames(container) {
  const games = store.getGames();
  const allRegistrations = store.getEnrichedRegistrations();

  // Susun template HTML untuk halaman Katalog Game
  container.innerHTML = `
    <!-- Header Halaman Katalog -->
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
      <div>
        <h2 style="font-family:var(--font-heading); font-size:1.4rem; color:#fff;">Katalog & Library Game</h2>
        <p style="font-size:0.85rem; color:var(--text-muted);">Daftar game yang sedang Anda mainkan atau nantikan masa pra-registrasinya.</p>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-add-game-tab">
        <span>+ Tambah Game Baru</span>
      </button>
    </div>

    ${
      // Jika belum ada game sama sekali di database, tampilkan Empty State
      games.length === 0
        ? `
      <div class="empty-state">
        <div class="empty-icon">🎮</div>
        <h3 class="empty-title">Belum Ada Game Dalam Library</h3>
        <p class="empty-desc">Tambahkan game yang ingin Anda lacak pendaftaran akun atau pra-registrasinya.</p>
        <button class="btn btn-primary btn-sm" id="btn-empty-add-game">+ Tambah Game Baru</button>
      </div>
    `
        : `
      <!-- Grid Berisi Kartu-Kartu Game -->
      <div class="management-grid">
        ${games
          .map((game) => {
            // Filter akun-akun yang terdaftar di game ini
            const linkedRegs = allRegistrations.filter(
              (r) => r.gameId === game.id,
            );
            const gameColor = game.color || "#6366f1";

            // Hitung sisa hari menuju peluncuran (Countdown)
            let countdownText = "";
            return `
            <div class="manage-card" style="border-top:3px solid ${gameColor};">
              <!-- Header Kartu: Avatar Singkatan & Judul -->
              <div class="manage-card-header">
                <div style="display:flex; align-items:center; gap:0.75rem;">
                  <div class="game-avatar-badge" style="background:${gameColor};">
                    ${game.title.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style="font-family:var(--font-heading); font-size:1.1rem; font-weight:700; color:#fff;">${game.title}</div>
                  </div>
                </div>
                <span class="badge-tag">${linkedRegs.length} Akun</span>
              </div>

              <!-- Info Platform, Tipe Ekonomi, dan Contract Address -->
              <div style="display:flex; flex-direction:column; gap:0.35rem; font-size:0.78rem; color:var(--text-muted);">
                <div style="display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                  <span>🕹️ Platform: <strong style="color:#fff;">${game.platform || "PC, Mobile"}</strong></span>
                  ${
                    game.economyType === "nft" || game.contractAddress
                      ? `<span style="background:rgba(99,102,241,0.2); color:#a5b4fc; border:1px solid rgba(99,102,241,0.4); padding:0.1rem 0.4rem; border-radius:4px; font-size:0.7rem; font-weight:600;">⚡ Web3 / NFT</span>`
                      : `<span style="background:rgba(16,185,129,0.15); color:#6ee7b7; border:1px solid rgba(16,185,129,0.3); padding:0.1rem 0.4rem; border-radius:4px; font-size:0.7rem; font-weight:600;">🎮 Web2 / RMT</span>`
                  }
                </div>
                ${
                  (game.economyType === "nft" || game.contractAddress) && game.contractAddress
                    ? `<div style="font-family:var(--font-mono); font-size:0.72rem; color:#93c5fd;">🔗 CA: ${game.contractAddress.slice(0, 8)}...${game.contractAddress.slice(-6)}</div>`
                    : ""
                }
                ${
                  game.officialUrl
                    ? `
                  <div>🌐 <a href="${game.officialUrl}" target="_blank" rel="noopener noreferrer" style="color:#93c5fd; text-decoration:none;">Kunjungi Link ↗</a></div>
                `
                    : ""
                }
              </div>

              <!-- Daftar Akun Email yang Terhubung -->
              <div>
                <div style="font-size:0.75rem; font-weight:600; color:var(--text-dim); text-transform:uppercase; margin-bottom:0.35rem;">Email Terhubung:</div>
                ${
                  linkedRegs.length === 0
                    ? `
                  <div style="font-size:0.78rem; color:var(--text-dim); font-style:italic;">Belum ada email yang didaftarkan ke game ini</div>
                `
                    : `
                  <div style="display:flex; flex-direction:column; gap:0.35rem;">
                    ${linkedRegs
                      .map((r) => {
                        const statusColor =
                          r.status === "live"
                            ? "var(--status-live)"
                            : r.status === "praregist"
                              ? "var(--status-praregist)"
                              : "var(--status-maint)";
                        const statusText = r.status.toUpperCase();
                        return `
                        <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-surface-elevated); padding:0.35rem 0.6rem; border-radius:6px; font-size:0.75rem;">
                          <div style="display:flex; align-items:center; gap:0.4rem; overflow:hidden;">
                            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${statusColor}; flex-shrink:0;"></span>
                            <span style="font-family:var(--font-mono); color:#93c5fd; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${r.email.address}</span>
                          </div>
                          <div style="display:flex; align-items:center; gap:0.4rem; flex-shrink:0;">
                            <span style="color:#fff; font-weight:600;">${r.ign}</span>
                            <span style="font-size:0.65rem; color:${statusColor}; font-weight:700;">${statusText}</span>
                          </div>
                        </div>
                      `;
                      })
                      .join("")}
                  </div>
                `
                }
              </div>

              <!-- Tombol Aksi di Bawah Kartu -->
              <div style="margin-top:auto; padding-top:0.75rem; border-top:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:space-between;">
                <button class="btn btn-secondary btn-sm" data-action="link-email-to-game" data-game-id="${game.id}">
                  + Daftarkan Email
                </button>
                <div style="display:flex; gap:0.35rem;">
                  <button class="btn btn-secondary btn-sm btn-icon-only" data-action="edit-game" data-id="${game.id}" title="Edit Game">✏️</button>
                  <button class="btn btn-danger btn-sm btn-icon-only" data-action="delete-game" data-id="${game.id}" title="Hapus Game">🗑️</button>
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
  // MENDAFTARKAN EVENT LISTENER PADA ELEMEN YANG TELAH DI-RENDER
  // ==========================================================================

  // Tombol Tambah Game Baru di bagian atas dan di empty state
  container
    .querySelector("#btn-add-game-tab")
    ?.addEventListener("click", () => openGameModal());
  container
    .querySelector("#btn-empty-add-game")
    ?.addEventListener("click", () => openGameModal());

  // Tombol "+ Daftarkan Email" pada masing-masing kartu game
  container
    .querySelectorAll('[data-action="link-email-to-game"]')
    .forEach((btn) => {
      btn.onclick = () => {
        openRegistrationModal(null, { gameId: btn.dataset.gameId });
      };
    });

  // Tombol Edit Game (Pensil)
  container.querySelectorAll('[data-action="edit-game"]').forEach((btn) => {
    btn.onclick = () => {
      openGameModal(btn.dataset.id);
    };
  });

  // Tombol Hapus Game (Tong Sampah) dengan modal konfirmasi
  container.querySelectorAll('[data-action="delete-game"]').forEach((btn) => {
    btn.onclick = () => {
      const gameId = btn.dataset.id;
      const gameObj = games.find((g) => g.id === gameId);
      openConfirmModal(
        "Hapus Game dari Library",
        `Apakah Anda yakin ingin menghapus "${gameObj?.title}"? Seluruh data akun email yang terdaftar di game ini juga akan terhapus.`,
        () => {
          store.deleteGame(gameId);
          showToast("Game berhasil dihapus");
        },
      );
    };
  });
}
