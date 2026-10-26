// ============================================================================
// MAIN APPLICATION ENTRY POINT (src/main.js)
// ============================================================================
// Ini adalah file utama yang pertama kali dieksekusi saat halaman web dibuka.
// 
// ALUR LOGIKA UTAMA (LIFECYCLE):
// 1. Mengimpor file CSS styling dan modul state `store`.
// 2. Mengelola State Lokal UI:
//    - `currentSearch`: kata kunci pencarian yang diketik user.
//    - `currentStatusFilter`: filter status aktif ('all' | 'live' | 'praregist' | 'maintenance').
//    - `selectedGameIds`: Set ID game yang dicentang pada checklist filter atas.
//    - `collapsedGameIds`: Set ID game yang daftar emailnya sedang diciutkan/ditutup (accordion).
// 3. Fungsi `renderApp()`:
//    - Mengambil data terbaru dari `store`.
//    - Melakukan filtering (pencarian teks, checklist game, filter status).
//    - Menghitung kalkulasi finansial (total koin LIVE, rate IDR, dan estimasi Rupiah).
//    - Membangun HTML dan memasukkannya ke elemen `#app`.
//    - Menghubungkan seluruh Event Listener (klik tombol, input pencarian, dropdown status).
// 4. Pola Reaktif:
//    - `store.subscribe(() => renderApp())` memastikan setiap ada data baru di store,
//      layar otomatis dirender ulang tanpa perlu refresh halaman manual (F5).

import "./style.css";
import { store } from "./data/store.js";
import {
  openAddGameModal,
  openConnectEmailToGameModal,
  openEditGameAccountModal,
  openConfirmModal,
  openBackupModal,
  openBulkEmailModal,
  openEditEmailDetailsModal,
} from "./ui/modals.js";
import { showToast } from "./ui/toast.js";
import { fetchTokenByContractAddress } from "./services/cryptoService.js";
import { authService } from "./services/authService.js";
import { openAuthModal } from "./ui/authModal.js";

// ============================================================================
// STATE LOKAL HALAMAN (UI STATE)
// ============================================================================
let currentSearch = ""; // Kata kunci pencarian
let currentStatusFilter = "all"; // Filter status: 'all', 'live', 'praregist', 'maintenance'
let selectedGameIds = null; // Set ID game yang dicentang di filter atas (null = pilih semua)
let knownGameIds = new Set(); // Melacak game yang sudah ada agar uncheck user tidak ditimpa ulang
let collapsedGameIds = null; // Set ID game yang daftar emailnya sedang disembunyikan/ciut (null = default ciut/collapse semua)

/**
 * getCollapsedGameIds(games)
 * Secara default seluruh game diciutkan / collapsed (email tidak terlihat sampai diklik).
 */
function getCollapsedGameIds(games) {
  if (collapsedGameIds === null) {
    collapsedGameIds = new Set(games.map((g) => g.id));
  }
  return collapsedGameIds;
}

/**
 * getGameIconEmoji(iconName)
 * --------------------------
 * Menerjemahkan kode nama ikon dari database menjadi karakter Emoji visual.
 * 
 * @param {string} iconName - Nama ikon (misal: "cpu", "gamepad-2", "swords")
 * @returns {string} Karakter emoji yang sesuai
 */
function getGameIconEmoji(iconName) {
  const map = {
    cpu: "💻",
    "gamepad-2": "🎮",
    swords: "⚔️",
    shield: "🛡️",
    zap: "⚡",
    sparkles: "✨",
    target: "🎯",
    flame: "🔥",
    crown: "👑",
    rocket: "🚀",
  };
  return map[iconName] || "🎮";
}

// Kumpulan template SVG icon untuk tombol antarmuka yang tajam dan modern
const SVG_ICONS = {
  chevronDown: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
  chevronUp: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  close: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
};

/**
 * getSelectedGameIds(games)
 * -------------------------
 * Mengembalikan kumpulan ID game yang dicentang.
 * Jika `selectedGameIds` bernilai null (saat aplikasi pertama kali dibuka),
 * fungsi ini akan otomatis mencentang SEMUA game yang ada.
 */
function getSelectedGameIds(games) {
  if (selectedGameIds === null) {
    selectedGameIds = new Set(games.map((g) => g.id));
    knownGameIds = new Set(games.map((g) => g.id));
  } else {
    // Hanya otomatis centang game BARU yang belum pernah dikenal sebelumnya
    games.forEach((g) => {
      if (!knownGameIds.has(g.id)) {
        knownGameIds.add(g.id);
        selectedGameIds.add(g.id);
      }
    });
  }
  return selectedGameIds;
}

/**
 * renderApp()
 * -----------
 * Fungsi paling krusial di UI!
 * Berjalan setiap kali ada perubahan data atau interaksi filter dari pengguna.
 */
function renderApp() {
  const app = document.getElementById("app");
  
  // 1. Ambil data dari Store
  const games = store.getGames();
  const allRegistrations = store.getEnrichedRegistrations();

  const currentSelectedGameIds = getSelectedGameIds(games);
  const q = currentSearch.toLowerCase().trim();

  // 2. Hitung jumlah akun berdasarkan status untuk ditampilkan pada tombol filter (Pills)
  const totalLive = allRegistrations.filter((r) => r.status === "live").length;
  const totalPraregist = allRegistrations.filter(
    (r) => r.status === "praregist",
  ).length;
  const totalMaintenance = allRegistrations.filter(
    (r) => r.status === "maintenance",
  ).length;

  // 3. Filter Game: Tentukan game mana saja yang lolos seleksi untuk dirender ke layar
  const displayedGames = games.filter((game) => {
    // A. Filter Checklist: Pastikan game ini dicentang oleh user di panel atas
    if (!currentSelectedGameIds.has(game.id)) {
      return false;
    }

    // B. Filter Status: Jika user memilih status tertentu (selain 'all'),
    // periksa apakah game ini memiliki akun dengan status tersebut
    const gameRegs = allRegistrations.filter((r) => r.gameId === game.id);
    if (currentStatusFilter !== "all") {
      const hasMatchingStatus = gameRegs.some(
        (r) => r.status === currentStatusFilter,
      );
      if (!hasMatchingStatus) return false;
    }

    // C. Filter Pencarian: Cek apakah nama game, publisher, email, atau nickname cocok dengan teks pencarian
    if (q) {
      const matchGameTitle =
        game.title.toLowerCase().includes(q) ||
        (game.publisher || "").toLowerCase().includes(q);
      const matchAnyEmail = gameRegs.some(
        (r) =>
          r.email.address.toLowerCase().includes(q) ||
          r.ign.toLowerCase().includes(q) ||
          (r.notes || "").toLowerCase().includes(q),
      );
      return matchGameTitle || matchAnyEmail;
    }

    return true;
  });

  // 4. Kalkulasi Pendapatan Finansial Per Game (untuk baris Footer dan Badge Saldo)
  // Formula: Estimasi IDR = (Total Saldo Akun LIVE / Satuan Unit) * Harga Kurs IDR
  const gameEarnings = games.map((game) => {
    // Hanya akun dengan status LIVE yang dihitung saldonya
    const gameLiveRegs = allRegistrations.filter(
      (r) => r.gameId === game.id && r.status === "live",
    );
    const totalLiveCurrency = gameLiveRegs.reduce(
      (sum, r) => sum + (Number(r.currency) || 0),
      0,
    );
    const rateIdr = Number(game.currencyRateIdr) || 0;
    const rateUnit = Math.max(1, Number(game.currencyRateUnit) || 1000);
    const estimatedIdr =
      rateIdr > 0 ? Math.round((totalLiveCurrency / rateUnit) * rateIdr) : 0;

    return {
      game,
      totalLiveCurrency,
      rateIdr,
      rateUnit,
      estimatedIdr,
    };
  });

  // Grand Total IDR: Jumlahkan estimasi IDR dari semua game
  const grandTotalIdr = gameEarnings.reduce((sum, g) => sum + g.estimatedIdr, 0);

  // Susun string rumus rincian, contoh: "🪙 Architech (Rp 150.000) + 💎 Game B (Rp 50.000) = Rp 200.000"
  const formulaParts = gameEarnings.map(
    (g) => `${g.game.currencyIcon || "🪙"} ${g.game.title} (Rp ${g.estimatedIdr.toLocaleString("id-ID")})`,
  );
  const formulaString =
    formulaParts.length > 0
      ? formulaParts.join(" + ") +
        ` = <strong class="footer-formula-total">Rp ${grandTotalIdr.toLocaleString("id-ID")}</strong>`
      : "Belum ada game";

  // 5. Informasi Mode Penyimpanan (Mutlak Cloud Database Upstash Redis)
  const syncInfo = store.getSyncInfo();
  let badgeLabel = "Cloud Database";
  let badgeTitle = "Tersimpan aman & permanen di Cloud Database (Upstash Redis). Aman walau cache browser dibersihkan.";
  if (!syncInfo.isConnected) {
    badgeLabel = "Cloud Terhubung";
    badgeTitle = "Tersimpan aman di database cloud pribadi Anda.";
  }

  // 6. MEMBUAT STRUKTUR HTML UTAMA
  app.innerHTML = `
    <!-- Header Bagian Atas -->
    <header class="app-header">
      <div class="container header-inner">
        <div class="logo-area">
          <span class="logo-icon">🎮</span>
          <div class="logo-text-group">
            <div class="logo-title">Game & Email Hub</div>
            <div class="logo-subtitle">Pilih game untuk melihat email mana saja yang terhubung dan statusnya</div>
          </div>
        </div>

        <div class="header-right-panel">
          <div class="header-status-row">
            <div class="storage-badge" title="${badgeTitle}">
              <span class="badge-dot"></span>
              <span>${badgeLabel}</span>
            </div>
            ${
              authService.isLoggedIn()
                ? `
              <div class="user-pill">
                <span class="user-pill-email" title="${authService.getUser()?.email || "User"}">👤 ${authService.getUser()?.email || "User"}</span>
                <button type="button" id="btn-logout" class="user-pill-logout" title="Keluar / Logout">🚪 Logout</button>
              </div>
            `
                : `
              <button class="btn btn-secondary btn-sm" id="btn-open-login" style="border-color:#818cf8; color:#a5b4fc;">
                <span>🔑 Masuk / Daftar</span>
              </button>
            `
            }
          </div>

          <div class="header-buttons">
            <button class="btn btn-secondary btn-sm" id="btn-backup-data" title="Cadangan Data">
              <span>💾 Backup</span>
            </button>
            <button class="btn btn-secondary btn-sm btn-bulk-email" id="btn-bulk-email" title="Paste banyak email sekaligus">
              <span>📥 + Bulk Email</span>
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-add-game">
              <span>🎮 + Tambah Game</span>
            </button>
            <button class="btn btn-primary btn-sm btn-connect-primary" id="btn-connect-email">
              <span>✉️ + Hubungkan Email</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Konten Utama Halaman -->
    <main class="container">
      <!-- Baris Kontrol: Kotak Pencarian & Filter Status -->
      <div class="filter-bar">
        <div class="search-wrapper">
          <input 
            type="text" 
            class="search-input" 
            id="search-input" 
            placeholder="🔍 Cari nama game atau email..." 
            value="${currentSearch}"
          >
        </div>

        <div class="status-pills-group">
          <button class="status-pill ${currentStatusFilter === "all" ? "active" : ""}" data-status="all">
            Semua Status
          </button>
          <button class="status-pill ${currentStatusFilter === "live" ? "active" : ""}" data-status="live">
            🟢 Live (${totalLive})
          </button>
          <button class="status-pill ${currentStatusFilter === "praregist" ? "active" : ""}" data-status="praregist">
            🟡 Praregist (${totalPraregist})
          </button>
          <button class="status-pill ${currentStatusFilter === "maintenance" ? "active" : ""}" data-status="maintenance">
            🔴 Maintenance (${totalMaintenance})
          </button>
        </div>
      </div>

      <!-- Bagian Checklist Filter Game (Centang / Hapus Centang) -->
      <div class="game-checklist-section">
        <div class="checklist-header">
          <div class="checklist-title-group">
            <span class="checklist-title">🎮 Daftar Game (Centang untuk Menampilkan):</span>
            <span class="checklist-count-badge">
              (${currentSelectedGameIds.size} dari ${games.length} game dicentang)
            </span>
          </div>
          <div class="checklist-quick-actions">
            <button type="button" class="btn-text-link" id="btn-select-all-games">✓ Pilih Semua</button>
            <span class="checklist-action-divider">•</span>
            <button type="button" class="btn-text-link" id="btn-deselect-all-games">✕ Hapus Centang</button>
          </div>
        </div>

        <div class="checklist-grid">
          ${games
            .map((game) => {
              const isChecked = currentSelectedGameIds.has(game.id);
              const gameEmailCount = allRegistrations.filter(
                (r) => r.gameId === game.id,
              ).length;
              return `
              <label class="game-check-pill ${isChecked ? "checked" : ""}">
                <input type="checkbox" data-game-check-id="${game.id}" ${isChecked ? "checked" : ""}>
                <span class="game-check-title">🎮 ${game.title}</span>
                <span class="game-check-badge">${gameEmailCount} email</span>
              </label>
            `;
            })
            .join("")}
        </div>
      </div>

      <!-- Daftar Kartu Game Berdasarkan Hasil Filter -->
      <div class="games-list-container">
        ${
          !authService.isLoggedIn()
            ? `
          <div class="empty-state" style="background:rgba(99,102,241,0.06); border:1px dashed rgba(99,102,241,0.3); border-radius:var(--radius-lg); padding:3rem 1.5rem;">
            <span style="font-size:3rem; margin-bottom:0.5rem; display:block;">🔒</span>
            <h3 style="font-size:1.35rem; color:#fff; margin-bottom:0.4rem;">Akses Dilindungi & Terisolasi</h3>
            <p style="font-size:0.9rem; color:var(--text-secondary); max-width:480px; margin:0 auto 1.25rem; line-height:1.5;">
              Seluruh data game, akun, dan email terisolasi secara privat di database terenkripsi. Silakan masuk atau daftarkan akun baru Anda (1 IP = 1 Akun) untuk mulai mengelola data.
            </p>
            <button class="btn btn-primary" id="btn-guest-login" style="padding:0.7rem 1.5rem; font-weight:700;">
              🔑 Masuk / Daftar Akun Sekarang
            </button>
          </div>
        `
            : games.length === 0
              ? `
          <div class="empty-state">
            <span style="font-size:2.8rem;">🎮</span>
            <h3 style="font-size:1.2rem; color:#fff; margin-bottom:0.35rem;">Ruang Kerja Anda Masih Kosong</h3>
            <p style="font-size:0.85rem; color:var(--text-secondary); max-width:420px; margin:0 auto 1.2rem;">
              Database baru Anda telah siap! Mulailah dengan menambahkan game pertama Anda.
            </p>
            <button class="btn btn-primary btn-sm" id="btn-empty-add-game">🎮 + Tambah Game Pertama</button>
          </div>
        `
            : currentSelectedGameIds.size === 0
            ? `
          <!-- Tampilan saat semua game di-uncheck -->
          <div class="empty-state">
            <span style="font-size:2.5rem;">☑️</span>
            <h3 style="font-size:1.15rem; color:#fff;">Tidak Ada Game yang Dicentang</h3>
            <p style="font-size:0.85rem; color:var(--text-secondary);">
              Silakan centang game pada daftar di atas untuk melihat email dan status akun yang terhubung.
            </p>
            <button class="btn btn-primary btn-sm" id="btn-empty-select-all">✓ Centang Semua Game</button>
          </div>
        `
            : displayedGames.length === 0
              ? `
          <!-- Tampilan saat hasil pencarian tidak menemukan kecocokan -->
          <div class="empty-state">
            <span style="font-size:2.5rem;">🔍</span>
            <h3 style="font-size:1.15rem; color:#fff;">Tidak Ada Data yang Cocok</h3>
            <p style="font-size:0.85rem; color:var(--text-secondary);">
              Game yang dicentang tidak memiliki akun yang sesuai dengan pencarian atau filter status saat ini.
            </p>
          </div>
        `
              : displayedGames
                  .map((game) => {
                    // Ambil pendaftaran untuk game ini
                    let gameRegs = allRegistrations.filter(
                      (r) => r.gameId === game.id,
                    );

                    // Saring berdasarkan status jika ada filter aktif
                    if (currentStatusFilter !== "all") {
                      gameRegs = gameRegs.filter(
                        (r) => r.status === currentStatusFilter,
                      );
                    }

                    // Saring berdasarkan teks pencarian
                    if (q) {
                      const matchGame =
                        game.title.toLowerCase().includes(q) ||
                        (game.publisher || "").toLowerCase().includes(q);
                      if (!matchGame) {
                        gameRegs = gameRegs.filter(
                          (r) =>
                            r.email.address.toLowerCase().includes(q) ||
                            r.ign.toLowerCase().includes(q) ||
                            (r.notes || "").toLowerCase().includes(q),
                        );
                      }
                    }

                    const currentCollapsedIds = getCollapsedGameIds(games);
                    const isCollapsed = currentCollapsedIds.has(game.id);
                    const totalLiveCurrency = gameRegs
                      .filter((r) => r.status === "live")
                      .reduce((sum, r) => sum + (Number(r.currency) || 0), 0);

                    const rateIdr = Number(game.currencyRateIdr) || 0;
                    const rateUnit = Math.max(1, Number(game.currencyRateUnit) || 1000);
                    const estimatedTotalIdr =
                      rateIdr > 0 ? (totalLiveCurrency / rateUnit) * rateIdr : 0;

                    return `
            <div class="game-main-card ${isCollapsed ? "collapsed" : ""}" data-game-id="${game.id}" style="border-left: 4px solid ${game.color || "#6366f1"};">
              <!-- Header Kartu Game -->
              <div class="game-card-header">
                <!-- Baris 1: Judul Game & Identitas + Tombol Collapse -->
                <div class="game-header-top-row">
                  <div class="game-title-group" data-action="toggle-collapse-game" data-game-id="${game.id}" title="Klik untuk ${isCollapsed ? "membuka" : "menciutkan"} list email">
                    <div class="game-icon-avatar" style="background:${game.color || "#6366f1"}22; border:1px solid ${game.color || "#6366f1"}44;">
                      ${getGameIconEmoji(game.badgeIcon)}
                    </div>
                    <div class="game-title-meta">
                      <span class="game-title-text">${game.title}</span>
                      <span class="game-count-badge">${gameRegs.length} Email Terhubung</span>
                    </div>
                  </div>

                  <button class="btn btn-secondary btn-icon-square btn-collapse-toggle" data-action="toggle-collapse-game" data-game-id="${game.id}" title="${isCollapsed ? "Buka list email game ini" : "Sembunyikan / ciutkan list email game ini"}">
                    ${isCollapsed ? SVG_ICONS.chevronDown : SVG_ICONS.chevronUp}
                  </button>
                </div>

                <!-- Baris 2: Sejajar - Badge Detail Game (Kiri) & Badge Aksi/Edit (Kanan) -->
                <div class="game-header-bottom-row">
                  <!-- Sebelah Kiri: Badge Detail Game & Tipe Ekonomi -->
                  <div class="game-meta-row">
                    ${
                      game.economyType === "nft" || game.contractAddress
                        ? `<span class="game-meta-tag tag-web3" title="Game Web3 / NFT">⚡ Web3 / NFT</span>`
                        : `<span class="game-meta-tag tag-web2" title="Game Web2 / RMT">🎮 Web2 / RMT</span>`
                    }
                    ${game.platform ? `<span class="game-meta-tag tag-platform">💻 ${game.platform}</span>` : ""}
                    ${
                      (game.economyType === "nft" || game.contractAddress) && game.contractAddress
                        ? `
                      <span class="game-meta-tag tag-ca" title="Smart Contract Address: ${game.contractAddress}">
                        <span class="ca-text">🔗 CA: ${game.contractAddress.slice(0, 6)}...${game.contractAddress.slice(-4)}</span>
                        <button type="button" class="btn-copy-ca" data-ca="${game.contractAddress}" style="background:none; border:none; color:#93c5fd; cursor:pointer; padding:0 0.2rem;" title="Salin Contract Address">📋</button>
                      </span>
                    `
                        : ""
                    }
                    ${
                      rateIdr > 0
                        ? `
                      <span class="game-meta-tag rate-pill" title="Rate Konversi: Rp ${rateIdr.toLocaleString("id-ID")} per ${rateUnit.toLocaleString("id-ID")} ${game.currencyIcon || "🪙"}">
                        <span class="rate-text">${game.economyType === "nft" ? "⚡ Live Rate:" : "💱 Rate:"} Rp ${rateIdr.toLocaleString("id-ID")} / ${rateUnit.toLocaleString("id-ID")} ${game.currencyIcon || "🪙"}</span>
                        ${
                          (game.economyType === "nft" || game.contractAddress) && game.contractAddress
                            ? `<button type="button" class="btn-refresh-crypto" data-game-id="${game.id}" data-ca="${game.contractAddress}" style="background:none; border:none; color:#fef08a; cursor:pointer; font-size:0.75rem; padding:0 0.2rem;" title="Perbarui harga token real-time">🔄</button>`
                            : ""
                        }
                      </span>
                    `
                        : ""
                    }
                    ${
                      game.officialUrl
                        ? `
                      <a href="${game.officialUrl}" target="_blank" rel="noopener noreferrer" class="game-link-pill" title="Kunjungi Tautan" onclick="event.stopPropagation();">
                        🌐 Link ↗
                      </a>
                    `
                        : ""
                    }
                  </div>

                  <!-- Sebelah Kanan: Badge Edit, Mata Uang, & Aksi Lainnya -->
                  <div class="game-card-actions">
                    <div class="game-total-currency-badge" title="Total saldo LIVE: ${totalLiveCurrency.toLocaleString("id-ID")}${rateIdr > 0 ? ` (Estimasi IDR: Rp ${Math.round(estimatedTotalIdr).toLocaleString("id-ID")})` : ""}">
                      <span class="currency-symbol">${game.currencyIcon || "🪙"}</span>
                      <span class="currency-total-amount">${totalLiveCurrency.toLocaleString("id-ID")}</span>
                      ${
                        rateIdr > 0 && totalLiveCurrency > 0
                          ? `
                          <span class="currency-badge-divider"></span>
                          <span class="currency-idr-estimate">
                            ≈ Rp ${Math.round(estimatedTotalIdr).toLocaleString("id-ID")}
                          </span>`
                          : ""
                      }
                    </div>
                    <div class="game-buttons-group">
                      <button class="btn btn-primary btn-connect-game" data-action="connect-email-to-this-game" data-game-id="${game.id}">
                        ${SVG_ICONS.plus}
                        <span>Hubungkan Email</span>
                      </button>
                      <button class="btn btn-secondary btn-icon-square btn-action-edit" data-action="edit-game" data-id="${game.id}" title="Edit Detail Game">
                        ${SVG_ICONS.edit}
                      </button>
                      <button class="btn btn-secondary btn-icon-square btn-action-delete" data-action="delete-game" data-id="${game.id}" title="Hapus Game">
                        ${SVG_ICONS.trash}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              ${
                isCollapsed
                  ? `
                <!-- Ringkasan Singkat Saat Card Diciutkan (Collapsed) -->
                <div class="collapsed-email-summary" data-action="toggle-collapse-game" data-game-id="${game.id}" title="Klik untuk membuka rincian email game ini">
                  <span style="font-weight:700; color:#fff;">📁 ${gameRegs.length} Email Terhubung:</span>
                  <span class="status-summary-tag live">🟢 ${gameRegs.filter((r) => r.status === "live").length} Live</span>
                  <span class="status-summary-tag praregist">🟡 ${gameRegs.filter((r) => r.status === "praregist").length} Praregist</span>
                  ${gameRegs.some((r) => r.status === "maintenance") ? `<span class="status-summary-tag maintenance">🔴 ${gameRegs.filter((r) => r.status === "maintenance").length} Maint</span>` : ""}
                  ${totalLiveCurrency > 0 ? `<span class="status-summary-tag" style="background:rgba(234,179,8,0.15); color:#fde047; border:1px solid rgba(234,179,8,0.35);">${game.currencyIcon || "🪙"} Total: ${totalLiveCurrency.toLocaleString("id-ID")}${estimatedTotalIdr > 0 ? ` <strong style="color:#6ee7b7; margin-left:0.25rem;">(≈ Rp ${Math.round(estimatedTotalIdr).toLocaleString("id-ID")})</strong>` : ""}</span>` : ""}
                  <span style="margin-left:auto; font-size:0.75rem; color:var(--primary); font-weight:600;">Klik untuk membuka list email ▼</span>
                </div>
              `
                  : `
                <!-- Daftar Baris Email yang Terhubung dengan Game Ini -->
                <div class="emails-in-game-list">
                  ${
                    gameRegs.length === 0
                      ? `
                    <div class="empty-emails-msg">
                      Belum ada email yang terhubung ke game <strong>${game.title}</strong>. Klik <strong>+ Hubungkan Email</strong> di atas untuk mendaftarkan akun.
                    </div>
                  `
                      : gameRegs
                          .map((reg) => {
                            // Hitung berapa game lain yang juga menggunakan email ini
                            const totalGamesForThisEmail =
                              allRegistrations.filter(
                                (r) => r.emailId === reg.emailId,
                              );
                            const otherGameNames = totalGamesForThisEmail
                              .map((r) => r.game.title)
                              .join(", ");

                            return `
                      <div class="email-item-row" data-reg-id="${reg.id}">
                        <div class="email-info-cell">
                          <div class="email-address-text">
                            <span>✉️</span>
                            <span class="email-addr-text">${reg.email.address}</span>
                            <span class="multi-game-badge" title="Email ini juga terdaftar di game: ${otherGameNames}">
                              🔗 Terhubung di ${totalGamesForThisEmail.length} game
                            </span>
                          </div>
                          <div class="email-sub-detail">
                            ${reg.ign && reg.ign !== "-" ? `<span>IGN / Akun: <strong style="color:#fff;">${reg.ign}</strong></span>` : ""}
                            ${reg.notes ? `<span style="color:var(--text-muted); font-style:italic;">(${reg.notes})</span>` : ""}
                          </div>
                        </div>

                        <div class="email-actions-cell">
                          <div class="email-status-group">
                            ${
                              reg.status === "live"
                                ? `
                              <div class="email-currency-badge" data-action="edit-reg" data-reg-id="${reg.id}" title="Mata uang in-game akun ini: ${(Number(reg.currency) || 0).toLocaleString("id-ID")}${rateIdr > 0 ? ` (Estimasi IDR: Rp ${Math.round(((Number(reg.currency) || 0) / rateUnit) * rateIdr).toLocaleString("id-ID")})` : ""} - Klik untuk edit">
                                <span>${game.currencyIcon || "🪙"}</span>
                                <span>${(Number(reg.currency) || 0).toLocaleString("id-ID")}</span>
                                ${
                                  rateIdr > 0 && Number(reg.currency) > 0
                                    ? `<span style="font-size:0.72rem; color:#6ee7b7; font-weight:600; opacity:0.95; margin-left:0.2rem;">(≈ Rp ${Math.round(((Number(reg.currency) || 0) / rateUnit) * rateIdr).toLocaleString("id-ID")})</span>`
                                    : ""
                                }
                              </div>
                            `
                                : ""
                            }

                            <!-- Dropdown Status Cepat (Bisa langsung diubah tanpa buka modal) -->
                            <select class="status-dropdown ${reg.status}" data-action="change-status" data-reg-id="${reg.id}">
                              <option value="live" ${reg.status === "live" ? "selected" : ""}>🟢 Live (Rilis)</option>
                              <option value="praregist" ${reg.status === "praregist" ? "selected" : ""}>🟡 Praregist</option>
                              <option value="maintenance" ${reg.status === "maintenance" ? "selected" : ""}>🔴 Maintenance</option>
                            </select>
                          </div>

                          <div class="email-buttons-group">
                            <button class="btn btn-secondary btn-icon-square btn-action-edit" data-action="edit-email-details" data-email-id="${reg.email.id}" title="Edit Alamat & Data Email Ini">
                              ✉️
                            </button>
                            <button class="btn btn-secondary btn-icon-square btn-action-edit" data-action="edit-reg" data-reg-id="${reg.id}" title="Edit Catatan Akun & Saldo Game">
                              ${SVG_ICONS.edit}
                            </button>
                            <button class="btn btn-secondary btn-icon-square btn-action-delete" data-action="delete-reg" data-reg-id="${reg.id}" title="Hapus Email dari Game Ini">
                              ${SVG_ICONS.trash}
                            </button>
                          </div>
                        </div>
                      </div>
                    `;
                          })
                          .join("")
                  }
                </div>
              `
              }
            </div>
          `;
                  })
                  .join("")
        }
      </div>
    </main>

    <!-- Footer: Estimasi Pendapatan Total Seluruh Game (IDR) -->
    <footer class="app-footer">
      <div class="container footer-content">
        <div class="footer-main-row">
          <div class="footer-total-box">
            <div class="footer-total-label">
              <span>💰</span>
              <span>TOTAL ESTIMASI PENDAPATAN (IDR)</span>
            </div>
            <div class="footer-total-amount">
              Rp ${grandTotalIdr.toLocaleString("id-ID")}
            </div>
          </div>

          <div class="footer-games-chips">
            ${gameEarnings
              .map(
                (g) => `
              <div class="footer-game-chip" title="${g.game.title}: ${g.totalLiveCurrency.toLocaleString("id-ID")} ${g.game.currencyIcon || "🪙"}${g.rateIdr > 0 ? ` (Rate: Rp ${g.rateIdr.toLocaleString("id-ID")} / ${g.rateUnit.toLocaleString("id-ID")})` : " (Belum atur rate IDR)"}">
                <span class="chip-game-name">${g.game.currencyIcon || "🪙"} ${g.game.title}:</span>
                <span class="chip-game-val">Rp ${g.estimatedIdr.toLocaleString("id-ID")}</span>
              </div>
            `,
              )
              .join("")}
          </div>
        </div>

        <!-- Formula Baris: ( game a + game b + game c = xxx ) -->
        <div class="footer-formula-bar">
          <span class="formula-label">📐 Rincian Penjumlahan:</span>
          <div class="formula-expression">
            ( ${formulaString} )
          </div>
        </div>
      </div>
    </footer>
  `;

  // ==========================================================================
  // MENDAFTARKAN EVENT LISTENERS (INTERAKSI USER)
  // ==========================================================================

  // 0. Autentikasi Pengguna: Login & Logout
  document.getElementById("btn-open-login")?.addEventListener("click", () => {
    openAuthModal("login");
  });
  document.getElementById("btn-guest-login")?.addEventListener("click", () => {
    openAuthModal("login");
  });
  document.getElementById("btn-empty-add-game")?.addEventListener("click", () => {
    openAddGameModal();
  });
  document.getElementById("btn-logout")?.addEventListener("click", () => {
    openConfirmModal(
      "Konfirmasi Logout",
      "Apakah Anda yakin ingin keluar dari akun Game & Email Hub Anda?",
      () => {
        authService.logout();
      },
      "🚪 Keluar Akun",
      "btn-danger"
    );
  });

  // 1. Input Pencarian: Simpan query dan pertahankan posisi kursor saat re-render
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearch = e.target.value;
      renderApp();
      // Kembalikan fokus dan kursor ke ujung teks input setelah HTML diganti ulang
      const newSearchInput = document.getElementById("search-input");
      if (newSearchInput) {
        newSearchInput.focus();
        newSearchInput.selectionStart = newSearchInput.selectionEnd =
          newSearchInput.value.length;
      }
    });
  }

  // 2. Checklist Game: Mengaktifkan atau menonaktifkan tampilan game
  document.querySelectorAll("[data-game-check-id]").forEach((chk) => {
    chk.addEventListener("change", () => {
      const gId = chk.dataset.gameCheckId;
      if (chk.checked) {
        selectedGameIds.add(gId);
      } else {
        selectedGameIds.delete(gId);
      }
      renderApp();
    });
  });

  // 3. Tombol Centang Semua Game saat kondisi empty state atau tombol cepat
  document
    .getElementById("btn-empty-select-all")
    ?.addEventListener("click", () => {
      selectedGameIds = new Set(games.map((g) => g.id));
      renderApp();
      showToast("Semua game dicentang");
    });

  document
    .getElementById("btn-select-all-games")
    ?.addEventListener("click", () => {
      selectedGameIds = new Set(games.map((g) => g.id));
      renderApp();
      showToast("Semua game dicentang");
    });

  document
    .getElementById("btn-deselect-all-games")
    ?.addEventListener("click", () => {
      selectedGameIds = new Set();
      renderApp();
      showToast("Semua centang game dihapus");
    });

  // 4. Tombol Filter Status (Pill buttons: Semua, Live, Praregist, Maintenance)
  document.querySelectorAll(".status-pill").forEach((pill) => {
    pill.onclick = () => {
      currentStatusFilter = pill.dataset.status;
      renderApp();
    };
  });

  // 5. Tombol Header: Buka modal Tambah Game, Hubungkan Email, atau Backup Data
  document.getElementById("btn-add-game")?.addEventListener("click", () => {
    openAddGameModal();
  });
  document.getElementById("btn-bulk-email")?.addEventListener("click", () => {
    openBulkEmailModal();
  });
  document
    .getElementById("btn-connect-email")
    ?.addEventListener("click", () => {
      openConnectEmailToGameModal();
    });
  document.getElementById("btn-backup-data")?.addEventListener("click", () => {
    openBackupModal();
  });

  // 6. Accordion: Toggle Ciutkan / Bentangkan daftar email per kartu game
  document
    .querySelectorAll('[data-action="toggle-collapse-game"]')
    .forEach((el) => {
      el.onclick = (e) => {
        // Abaikan jika klik berasal dari tombol aksi dalam card
        if (
          e.target.closest("a") ||
          e.target.closest('[data-action="connect-email-to-this-game"]') ||
          e.target.closest('[data-action="edit-game"]') ||
          e.target.closest('.game-total-currency-badge') ||
          e.target.closest('[data-action="delete-game"]')
        ) {
          return;
        }
        const gameId = el.dataset.gameId;
        const currentCollapsed = getCollapsedGameIds(games);
        if (currentCollapsed.has(gameId)) {
          currentCollapsed.delete(gameId);
        } else {
          currentCollapsed.add(gameId);
        }
        renderApp();
      };
    });

  // 7. Aksi Hubungkan Email khusus untuk game tertentu (+ Hubungkan Email di kartu)
  document
    .querySelectorAll('[data-action="connect-email-to-this-game"]')
    .forEach((btn) => {
      btn.onclick = () => openConnectEmailToGameModal(btn.dataset.gameId);
    });

  // 8. Aksi Edit Detail Game (nama, developer, rate IDR, warna, dll)
  document.querySelectorAll('[data-action="edit-game"]').forEach((btn) => {
    btn.onclick = () => openAddGameModal(btn.dataset.id);
  });

  // 9. Aksi Hapus Game
  document.querySelectorAll('[data-action="delete-game"]').forEach((btn) => {
    btn.onclick = () => {
      const gameId = btn.dataset.id;
      const gameObj = games.find((g) => g.id === gameId);
      openConfirmModal(
        "Hapus Game",
        `Apakah Anda yakin ingin menghapus game "${gameObj?.title}"? Seluruh daftar email yang terhubung ke game ini juga akan dilepas.`,
        () => {
          store.deleteGame(gameId);
          selectedGameIds?.delete(gameId);
          knownGameIds?.delete(gameId);
          showToast("Game berhasil dihapus");
        },
      );
    };
  });

  // 10. Ganti Status Akun Langsung dari Dropdown
  document
    .querySelectorAll('[data-action="change-status"]')
    .forEach((select) => {
      select.onchange = () => {
        const regId = select.dataset.regId;
        const newStatus = select.value;
        store.updateStatus(regId, newStatus);
        showToast(`Status akun diubah ke ${newStatus.toUpperCase()}`);
      };
    });

  // 11. Edit Catatan & Saldo Akun Game Tertentu
  document.querySelectorAll('[data-action="edit-reg"]').forEach((btn) => {
    btn.onclick = () => openEditGameAccountModal(btn.dataset.regId);
  });

  // 11B. Edit Alamat & Rincian Email Utama
  document.querySelectorAll('[data-action="edit-email-details"]').forEach((btn) => {
    btn.onclick = () => openEditEmailDetailsModal(btn.dataset.emailId);
  });

  // 12. Hapus Hubungan Email dari Game Ini
  document.querySelectorAll('[data-action="delete-reg"]').forEach((btn) => {
    btn.onclick = () => {
      const regId = btn.dataset.regId;
      openConfirmModal(
        "Lepas Email dari Game Ini",
        "Apakah Anda yakin ingin melepaskan email ini dari game terkait?",
        () => {
          store.deleteRegistration(regId);
          showToast("Email berhasil dilepas dari game");
        },
      );
    };
  });

  // 13. Salin Smart Contract Address (CA)
  document.querySelectorAll(".btn-copy-ca").forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const ca = btn.dataset.ca;
      if (ca) {
        navigator.clipboard.writeText(ca).then(() => {
          showToast("Contract Address disalin ke clipboard! 📋");
        }).catch(() => {
          showToast("Gagal menyalin Contract Address", "error");
        });
      }
    };
  });

  // 14. Perbarui Harga Token Crypto Real-time
  document.querySelectorAll(".btn-refresh-crypto").forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const gameId = btn.dataset.gameId;
      const ca = btn.dataset.ca;
      if (!gameId || !ca) return;

      btn.textContent = "⏳";
      btn.disabled = true;

      const res = await fetchTokenByContractAddress(ca);
      btn.textContent = "🔄";
      btn.disabled = false;

      if (res.success && res.token) {
        store.updateGame(gameId, {
          currencyRateIdr: res.token.priceIdr,
          currencyRateUnit: 1,
          tokenPriceUsd: res.token.priceUsd,
          tokenSymbol: res.token.symbol,
          tokenChainId: res.token.chainId,
        });
        showToast(`Harga $${res.token.symbol} diperbarui: Rp ${res.token.priceIdr.toLocaleString("id-ID")}/token!`);
      } else {
        showToast(res.error || "Gagal memperbarui harga token", "error");
      }
    };
  });
}

// ============================================================================
// INISIALISASI & SUBSCRIPTION REAKTIF
// ============================================================================

// Langganan (subscribe) ke Store: Setiap kali ada data yang bertambah/berubah,
// fungsi renderApp() otomatis dipanggil ulang.
store.subscribe(() => {
  renderApp();
});

// Render pertama kali (menggunakan cache lokal instan)
renderApp();

/**
 * autoRefreshCryptoPrices()
 * Otomatis memperbarui harga token crypto secara background saat web dibuka/refresh.
 */
let isAutoRefreshingCrypto = false;
async function autoRefreshCryptoPrices() {
  if (isAutoRefreshingCrypto) return;
  isAutoRefreshingCrypto = true;

  try {
    const games = store.getGames();
    const nftGamesWithCA = games.filter(
      (g) => (g.economyType === "nft" || g.contractAddress) && g.contractAddress && g.contractAddress.trim(),
    );

    if (nftGamesWithCA.length === 0) return;

    // Perbarui harga token secara paralel di background
    const updatePromises = nftGamesWithCA.map(async (game) => {
      const res = await fetchTokenByContractAddress(game.contractAddress);
      if (res.success && res.token && res.token.priceIdr > 0) {
        console.info(`[Crypto Live] Token $${res.token.symbol} (${game.title}): $${res.token.priceUsd} = Rp ${res.token.priceIdr.toLocaleString("id-ID")}`);
        // Hanya update jika harga berbeda untuk mencegah loop re-render yang tidak perlu
        if (game.currencyRateIdr !== res.token.priceIdr || game.tokenPriceUsd !== res.token.priceUsd) {
          store.updateGame(game.id, {
            currencyRateIdr: res.token.priceIdr,
            currencyRateUnit: 1,
            tokenPriceUsd: res.token.priceUsd,
            tokenSymbol: res.token.symbol,
            tokenChainId: res.token.chainId,
          });
        }
      }
    });

    await Promise.all(updatePromises);
  } catch (err) {
    console.warn("Auto-refresh harga crypto di background mengalami kendala:", err);
  } finally {
    isAutoRefreshingCrypto = false;
  }
}

// Render ulang saat data otoritatif dari cloud/disk selesai dibaca,
// lalu jalankan auto-refresh harga market crypto di background
store.readyPromise.then(async () => {
  renderApp();
  autoRefreshCryptoPrices();

  // Periksa apakah URL memuat token verifikasi email (dari link yang diklik user di email)
  const urlParams = new URLSearchParams(window.location.search);
  const verifyToken = urlParams.get("verify_token");
  if (verifyToken) {
    showToast("Memverifikasi email Anda...", "info");
    try {
      await authService.verifyEmail({ token: verifyToken });
      showToast("Email berhasil diverifikasi! Selamat datang.");
      // Bersihkan query param dari URL
      window.history.replaceState({}, document.title, window.location.pathname);
      window.location.reload();
      return;
    } catch (err) {
      showToast(err.message || "Tautan verifikasi tidak valid atau kedaluwarsa.", "error");
    }
  }

  // Jika pengunjung belum login, tampilkan modal masuk akun (login)
  if (!authService.isLoggedIn()) {
    setTimeout(() => {
      openAuthModal("login");
    }, 400);
  }
});

