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
let isMobileMenuOpen = false; // State buka/tutup menu navigasi mobile

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

// Kumpulan template SVG icon untuk tombol antarmuka yang tajam, presisi, dan modern (SaaS standard)
const SVG_ICONS = {
  menu: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
  chevronUp: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  close: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  gamepad: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" x2="10" y1="12" y2="12"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="15" x2="15.01" y1="13" y2="13"/><line x1="18" x2="18.01" y1="11" y2="11"/><rect width="20" height="12" x="2" y="6" rx="6"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  search: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  backup: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
  bulk: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>`,
  user: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>`,
  key: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-2 2m-1.5 1.5L16 7l-1.5-1.5-1.5 1.5 1.5 1.5-1.5 1.5-1.5-1.5-3.5 3.5a6.5 6.5 0 1 0 3 3l3.5-3.5Z"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>`,
  external: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`,
  link: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  wallet: `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>`,
  calculator: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>`,
  filter: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
  check: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  emptyBox: `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
  checkSquare: `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  searchEmpty: `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  grip: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>`,
  arrowUp: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>`,
  arrowDown: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
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

  // 6. MEMBUAT STRUKTUR HTML UTAMA (MODERN SAAS DESIGN - HUMAN CRAFTED)
  app.innerHTML = `
    <!-- Header Bagian Atas -->
    <header class="app-header ${isMobileMenuOpen ? "mobile-menu-active" : ""}">
      <div class="container header-inner">
        <div class="header-top-bar">
          <div class="logo-area">
            <div class="brand-avatar-box">
              ${SVG_ICONS.gamepad}
            </div>
            <div class="logo-text-group">
              <div class="logo-title">GameHub <span class="logo-badge">PRO</span></div>
              <div class="logo-subtitle">Portofolio & Pengelolaan Akun Game Terpadu</div>
            </div>
          </div>

          <!-- Tombol Menu Mobile -->
          <button type="button" class="btn-mobile-menu" id="btn-mobile-menu" aria-label="Menu Navigasi" title="Buka Menu">
            <span class="menu-icon-bars">${SVG_ICONS.menu}</span>
            <span class="menu-icon-close">${SVG_ICONS.close}</span>
          </button>
        </div>

        <div class="header-right-panel" id="header-right-panel">
          <div class="header-status-row">
            <div class="storage-badge" title="${badgeTitle}">
              <span class="badge-dot"></span>
              <span>${badgeLabel}</span>
            </div>
            ${
              authService.isLoggedIn()
                ? `
              <div class="user-pill">
                <span class="user-pill-email" title="${authService.getUser()?.email || "User"}">${SVG_ICONS.user} <span>${authService.getUser()?.email || "User"}</span></span>
                <button type="button" id="btn-logout" class="user-pill-logout" title="Keluar / Logout">${SVG_ICONS.logout} <span>Keluar</span></button>
              </div>
            `
                : `
              <button class="btn btn-secondary btn-sm" id="btn-open-login" style="border-color:rgba(99,102,241,0.4); color:#a5b4fc;">
                ${SVG_ICONS.key}
                <span>Masuk / Daftar</span>
              </button>
            `
            }
          </div>

          <div class="header-buttons">
            <button class="btn btn-secondary btn-sm" id="btn-backup-data" title="Cadangan Data">
              ${SVG_ICONS.backup}
              <span>Backup</span>
            </button>
            <button class="btn btn-secondary btn-sm btn-bulk-email" id="btn-bulk-email" title="Paste banyak email sekaligus">
              ${SVG_ICONS.bulk}
              <span>Bulk Email</span>
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-add-game">
              ${SVG_ICONS.plus}
              <span>Tambah Game</span>
            </button>
            <button class="btn btn-primary btn-sm btn-connect-primary" id="btn-connect-email">
              ${SVG_ICONS.mail}
              <span>Hubungkan Email</span>
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
          <div class="search-input-box">
            <span class="search-icon-prefix">${SVG_ICONS.search}</span>
            <input 
              type="text" 
              class="search-input" 
              id="search-input" 
              placeholder="Cari game, email, nickname, atau catatan..." 
              value="${currentSearch}"
            >
          </div>
        </div>

        <div class="status-pills-group">
          <button class="status-pill ${currentStatusFilter === "all" ? "active" : ""}" data-status="all">
            <span>Semua</span>
            <span class="status-count-badge">${allRegistrations.length}</span>
          </button>
          <button class="status-pill ${currentStatusFilter === "live" ? "active" : ""}" data-status="live">
            <span class="status-dot live"></span>
            <span>Live</span>
            <span class="status-count-badge">${totalLive}</span>
          </button>
          <button class="status-pill ${currentStatusFilter === "praregist" ? "active" : ""}" data-status="praregist">
            <span class="status-dot praregist"></span>
            <span>Praregist</span>
            <span class="status-count-badge">${totalPraregist}</span>
          </button>
          <button class="status-pill ${currentStatusFilter === "maintenance" ? "active" : ""}" data-status="maintenance">
            <span class="status-dot maintenance"></span>
            <span>Maintenance</span>
            <span class="status-count-badge">${totalMaintenance}</span>
          </button>
        </div>
      </div>

      <!-- Bagian Checklist Filter Game (Centang / Hapus Centang) -->
      <div class="game-checklist-section">
        <div class="checklist-header">
          <div class="checklist-title-group">
            <span class="checklist-icon-indicator">${SVG_ICONS.filter}</span>
            <span class="checklist-title">Filter Tampilan Game</span>
            <span class="checklist-count-badge">
              ${currentSelectedGameIds.size} dari ${games.length} aktif
            </span>
          </div>
          <div class="checklist-quick-actions">
            <button type="button" class="btn-text-link" id="btn-select-all-games">${SVG_ICONS.check} Pilih Semua</button>
            <span class="checklist-action-divider">•</span>
            <button type="button" class="btn-text-link" id="btn-deselect-all-games">${SVG_ICONS.close} Hapus Centang</button>
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
                <span class="game-check-avatar" style="color: ${game.color || "#6366f1"};">${getGameIconEmoji(game.badgeIcon)}</span>
                <span class="game-check-title">${game.title}</span>
                <span class="game-check-badge">${gameEmailCount} akun</span>
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
          <div class="empty-state auth-locked-empty">
            <div class="empty-state-icon-box">${SVG_ICONS.lock}</div>
            <h3 class="empty-state-title">Akses Dilindungi & Terenkripsi</h3>
            <p class="empty-state-desc">
              Seluruh data game, akun, dan email terisolasi secara privat di database terenkripsi. Silakan masuk atau daftarkan akun baru Anda (1 IP = 1 Akun) untuk mulai mengelola data.
            </p>
            <button class="btn btn-primary" id="btn-guest-login" style="padding:0.65rem 1.4rem;">
              ${SVG_ICONS.key} <span>Masuk / Daftar Akun</span>
            </button>
          </div>
        `
            : games.length === 0
              ? `
          <div class="empty-state">
            <div class="empty-state-icon-box">${SVG_ICONS.emptyBox}</div>
            <h3 class="empty-state-title">Ruang Kerja Masih Kosong</h3>
            <p class="empty-state-desc">
              Database baru Anda telah siap! Mulailah dengan menambahkan game pertama Anda ke dalam portofolio.
            </p>
            <button class="btn btn-primary btn-sm" id="btn-empty-add-game">${SVG_ICONS.plus} <span>Tambah Game Pertama</span></button>
          </div>
        `
            : currentSelectedGameIds.size === 0
            ? `
          <!-- Tampilan saat semua game di-uncheck -->
          <div class="empty-state">
            <div class="empty-state-icon-box">${SVG_ICONS.checkSquare}</div>
            <h3 class="empty-state-title">Tidak Ada Game yang Dipilih</h3>
            <p class="empty-state-desc">
              Silakan centang game pada panel filter di atas untuk melihat email dan status akun yang terhubung.
            </p>
            <button class="btn btn-primary btn-sm" id="btn-empty-select-all">${SVG_ICONS.check} <span>Pilih Semua Game</span></button>
          </div>
        `
            : displayedGames.length === 0
              ? `
          <!-- Tampilan saat hasil pencarian tidak menemukan kecocokan -->
          <div class="empty-state">
            <div class="empty-state-icon-box">${SVG_ICONS.searchEmpty}</div>
            <h3 class="empty-state-title">Tidak Ada Data yang Cocok</h3>
            <p class="empty-state-desc">
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
            <div class="game-main-card ${isCollapsed ? "collapsed" : ""}" data-game-id="${game.id}">
              <div class="game-accent-line" style="background: linear-gradient(90deg, ${game.color || "#6366f1"} 0%, transparent 80%);"></div>

              <!-- Header Kartu Game -->
              <div class="game-card-header">
                <!-- Baris 1: Judul Game & Identitas + Tombol Collapse -->
                <div class="game-header-top-row">
                  <div class="game-title-group" data-action="toggle-collapse-game" data-game-id="${game.id}" title="Klik untuk ${isCollapsed ? "membuka" : "menciutkan"} list email">
                    <div class="game-icon-avatar" style="background:${game.color || "#6366f1"}1a; border-color:${game.color || "#6366f1"}44;">
                      ${getGameIconEmoji(game.badgeIcon)}
                    </div>
                    <div class="game-title-meta">
                      <span class="game-title-text">${game.title}</span>
                      <span class="game-count-badge">${gameRegs.length} Akun</span>
                    </div>
                  </div>

                  <button class="btn btn-secondary btn-icon-square btn-collapse-toggle" data-action="toggle-collapse-game" data-game-id="${game.id}" title="${isCollapsed ? "Buka rincian email game ini" : "Ciutkan rincian email game ini"}">
                    ${isCollapsed ? SVG_ICONS.chevronDown : SVG_ICONS.chevronUp}
                  </button>
                </div>

                <!-- Baris 2: Sejajar - Badge Detail Game (Kiri) & Badge Aksi/Edit (Kanan) -->
                <div class="game-header-bottom-row">
                  <!-- Sebelah Kiri: Badge Detail Game & Tipe Ekonomi -->
                  <div class="game-meta-row">
                    ${
                      game.economyType === "nft" || game.contractAddress
                        ? `<span class="game-meta-tag tag-web3" title="Game Web3 / NFT">${SVG_ICONS.bolt} <span>Web3 / DEX</span></span>`
                        : `<span class="game-meta-tag tag-web2" title="Game Web2 / RMT">${SVG_ICONS.shield} <span>Web2 / RMT</span></span>`
                    }
                    ${game.platform ? `<span class="game-meta-tag tag-platform">${game.platform}</span>` : ""}
                    ${
                      (game.economyType === "nft" || game.contractAddress) && game.contractAddress
                        ? `
                      <span class="game-meta-tag tag-ca" title="Smart Contract Address: ${game.contractAddress}">
                        <span class="ca-text">${SVG_ICONS.link} CA: ${game.contractAddress.slice(0, 6)}...${game.contractAddress.slice(-4)}</span>
                        <button type="button" class="btn-copy-ca" data-ca="${game.contractAddress}" title="Salin Contract Address">${SVG_ICONS.copy}</button>
                      </span>
                    `
                        : ""
                    }
                    ${
                      rateIdr > 0
                        ? `
                      <span class="game-meta-tag rate-pill" title="Rate Konversi: Rp ${rateIdr.toLocaleString("id-ID")} per ${rateUnit.toLocaleString("id-ID")} ${game.currencyIcon || "🪙"}">
                        <span class="rate-text">${game.economyType === "nft" ? "Live Rate:" : "Kurs:"} Rp ${rateIdr.toLocaleString("id-ID")} / ${rateUnit.toLocaleString("id-ID")} ${game.currencyIcon || "🪙"}</span>
                        ${
                          (game.economyType === "nft" || game.contractAddress) && game.contractAddress
                            ? `<button type="button" class="btn-refresh-crypto" data-game-id="${game.id}" data-ca="${game.contractAddress}" title="Perbarui harga token real-time">${SVG_ICONS.refresh}</button>`
                            : ""
                        }
                      </span>
                    `
                        : ""
                    }
                    ${
                      game.officialUrl
                        ? `
                      <a href="${game.officialUrl}" target="_blank" rel="noopener noreferrer" class="game-link-pill" title="Kunjungi Website Resmi" onclick="event.stopPropagation();">
                        <span>Website</span> ${SVG_ICONS.external}
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
                        <span>Hubungkan</span>
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
                  <div class="collapsed-summary-header">
                    <span class="collapsed-summary-title">
                      ${SVG_ICONS.mail}
                      <span>${gameRegs.length} Email Terhubung${gameRegs.length > 0 ? ":" : ""}</span>
                    </span>
                  </div>

                  <div class="collapsed-summary-tags">
                    ${
                      gameRegs.length === 0
                        ? `<span class="status-summary-tag tag-empty">Belum ada email yang terhubung</span>`
                        : `
                      <span class="status-summary-tag live"><span class="status-dot live"></span> ${gameRegs.filter((r) => r.status === "live").length} Live</span>
                      <span class="status-summary-tag praregist"><span class="status-dot praregist"></span> ${gameRegs.filter((r) => r.status === "praregist").length} Praregist</span>
                      ${gameRegs.some((r) => r.status === "maintenance") ? `<span class="status-summary-tag maintenance"><span class="status-dot maintenance"></span> ${gameRegs.filter((r) => r.status === "maintenance").length} Maint</span>` : ""}
                      ${totalLiveCurrency > 0 ? `<span class="status-summary-tag tag-currency">${game.currencyIcon || "🪙"} ${totalLiveCurrency.toLocaleString("id-ID")}${estimatedTotalIdr > 0 ? ` <strong class="currency-idr-sub">(≈ Rp ${Math.round(estimatedTotalIdr).toLocaleString("id-ID")})</strong>` : ""}</span>` : ""}
                    `
                    }
                  </div>

                  <div class="collapsed-expand-hint">
                    <span>Buka Rincian Email</span>
                    ${SVG_ICONS.chevronDown}
                  </div>
                </div>
              `
                  : `
                <!-- Daftar Baris Email yang Terhubung dengan Game Ini -->
                <div class="emails-in-game-list" data-game-id="${game.id}">
                  ${
                    gameRegs.length === 0
                      ? `
                    <div class="empty-emails-msg">
                      Belum ada email yang terhubung ke game <strong>${game.title}</strong>. Klik <strong>+ Hubungkan</strong> di atas untuk mendaftarkan akun.
                    </div>
                  `
                      : gameRegs
                          .map((reg, index) => {
                            const isFirst = index === 0;
                            const isLast = index === gameRegs.length - 1;
                            // Hitung berapa game lain yang juga menggunakan email ini
                            const totalGamesForThisEmail =
                              allRegistrations.filter(
                                (r) => r.emailId === reg.emailId,
                              );
                            const otherGameNames = totalGamesForThisEmail
                              .map((r) => r.game.title)
                              .join(", ");

                            return `
                      <div class="email-item-row" data-reg-id="${reg.id}" data-game-id="${game.id}">
                        <div class="email-row-main">
                          <!-- Tombol Atur Urutan: Drag Handle & Arrow Up/Down & Badge Urutan -->
                          <div class="email-order-cell">
                            <button type="button" class="btn-drag-handle" data-action="drag-handle" title="Tahan dan geser (Drag & Drop) untuk mengatur urutan email" aria-label="Geser urutan">
                              ${SVG_ICONS.grip}
                            </button>
                            <div class="email-order-arrows">
                              <button type="button" class="btn-order-arrow btn-order-up" data-action="move-email-up" data-reg-id="${reg.id}" data-game-id="${game.id}" data-index="${index}" ${isFirst ? "disabled" : ""} title="${isFirst ? "Sudah di urutan teratas" : "Pindahkan email ke atas"}">
                                ${SVG_ICONS.arrowUp}
                              </button>
                              <button type="button" class="btn-order-arrow btn-order-down" data-action="move-email-down" data-reg-id="${reg.id}" data-game-id="${game.id}" data-index="${index}" ${isLast ? "disabled" : ""} title="${isLast ? "Sudah di urutan terbawah" : "Pindahkan email ke bawah"}">
                                ${SVG_ICONS.arrowDown}
                              </button>
                            </div>
                            <span class="email-order-badge" title="Urutan akun ke-${index + 1}">#${index + 1}</span>
                          </div>

                          <div class="email-info-cell">
                            <div class="email-address-text">
                              <span class="email-icon-prefix">${SVG_ICONS.mail}</span>
                              <span class="email-addr-text">${reg.email.address}</span>
                              <span class="multi-game-badge" title="Email ini juga terdaftar di game: ${otherGameNames}">
                                ${SVG_ICONS.link} <span>${totalGamesForThisEmail.length} Game</span>
                              </span>
                            </div>
                            <div class="email-sub-detail">
                              ${reg.ign && reg.ign !== "-" ? `<span>IGN: <strong style="color:#fff;">${reg.ign}</strong></span>` : ""}
                              ${reg.notes ? `<span class="email-notes-text">(${reg.notes})</span>` : ""}
                            </div>
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
                                    ? `<span class="email-currency-idr-sub">(≈ Rp ${Math.round(((Number(reg.currency) || 0) / rateUnit) * rateIdr).toLocaleString("id-ID")})</span>`
                                    : ""
                                }
                              </div>
                            `
                                : ""
                            }

                            <!-- Dropdown Status Cepat (Bisa langsung diubah tanpa buka modal) -->
                            <select class="status-dropdown ${reg.status}" data-action="change-status" data-reg-id="${reg.id}">
                              <option value="live" ${reg.status === "live" ? "selected" : ""}>Live</option>
                              <option value="praregist" ${reg.status === "praregist" ? "selected" : ""}>Praregist</option>
                              <option value="maintenance" ${reg.status === "maintenance" ? "selected" : ""}>Maintenance</option>
                            </select>
                          </div>

                          <div class="email-buttons-group">
                            <button class="btn btn-secondary btn-icon-square btn-action-edit" data-action="edit-email-details" data-email-id="${reg.email.id}" title="Edit Alamat & Data Email Ini">
                              ${SVG_ICONS.mail}
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
              ${SVG_ICONS.wallet}
              <span>TOTAL ESTIMASI NILAI PORTOFOLIO (IDR)</span>
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
          <span class="formula-label">${SVG_ICONS.calculator} Kalkulasi:</span>
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
      "Keluar Akun",
      "btn-danger"
    );
  });

  // 0B. Toggle Hamburger Menu Navigasi Mobile
  const btnMobileMenu = document.getElementById("btn-mobile-menu");
  if (btnMobileMenu) {
    btnMobileMenu.onclick = (e) => {
      e.stopPropagation();
      isMobileMenuOpen = !isMobileMenuOpen;
      const header = document.querySelector(".app-header");
      if (header) {
        header.classList.toggle("mobile-menu-active", isMobileMenuOpen);
      }
    };
  }

  // Tutup menu mobile saat salah satu tombol aksi diklik
  document.querySelectorAll(".header-right-panel button").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (isMobileMenuOpen) {
        isMobileMenuOpen = false;
        document.querySelector(".app-header")?.classList.remove("mobile-menu-active");
      }
    });
  });

  // Tutup menu mobile saat klik di luar area header
  document.onclick = (e) => {
    if (isMobileMenuOpen && !e.target.closest(".app-header")) {
      isMobileMenuOpen = false;
      document.querySelector(".app-header")?.classList.remove("mobile-menu-active");
    }
  };

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

  // 15. Atur Urutan Email Manual via Tombol Arrow (Atas / Bawah)
  document.querySelectorAll('[data-action="move-email-up"]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const regId = btn.dataset.regId;
      const gameId = btn.dataset.gameId;
      const index = parseInt(btn.dataset.index, 10);

      // Ambil daftar email game yang saat ini tampil di layar
      let targetList = allRegistrations.filter((r) => r.gameId === gameId);
      if (currentStatusFilter !== "all") {
        targetList = targetList.filter((r) => r.status === currentStatusFilter);
      }
      if (q) {
        const gameObj = games.find((g) => g.id === gameId);
        const matchGame = gameObj && (gameObj.title.toLowerCase().includes(q) || (gameObj.publisher || "").toLowerCase().includes(q));
        if (!matchGame) {
          targetList = targetList.filter(
            (r) => r.email.address.toLowerCase().includes(q) || r.ign.toLowerCase().includes(q) || (r.notes || "").toLowerCase().includes(q),
          );
        }
      }

      if (index > 0 && index < targetList.length) {
        const targetReg = targetList[index - 1];
        const success = store.moveRegistrationRelative(regId, targetReg.id, "before");
        if (success) {
          showToast("Urutan email dipindahkan ke atas");
        }
      }
    };
  });

  document.querySelectorAll('[data-action="move-email-down"]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const regId = btn.dataset.regId;
      const gameId = btn.dataset.gameId;
      const index = parseInt(btn.dataset.index, 10);

      let targetList = allRegistrations.filter((r) => r.gameId === gameId);
      if (currentStatusFilter !== "all") {
        targetList = targetList.filter((r) => r.status === currentStatusFilter);
      }
      if (q) {
        const gameObj = games.find((g) => g.id === gameId);
        const matchGame = gameObj && (gameObj.title.toLowerCase().includes(q) || (gameObj.publisher || "").toLowerCase().includes(q));
        if (!matchGame) {
          targetList = targetList.filter(
            (r) => r.email.address.toLowerCase().includes(q) || r.ign.toLowerCase().includes(q) || (r.notes || "").toLowerCase().includes(q),
          );
        }
      }

      if (index >= 0 && index < targetList.length - 1) {
        const targetReg = targetList[index + 1];
        const success = store.moveRegistrationRelative(regId, targetReg.id, "after");
        if (success) {
          showToast("Urutan email dipindahkan ke bawah");
        }
      }
    };
  });

  // 16. Drag & Drop Manual untuk Mengatur Urutan Email di Dalam Game
  let draggedRegId = null;
  let draggedGameId = null;
  let currentDropTarget = null;
  let dropPosition = "before"; // 'before' | 'after'

  document.querySelectorAll(".emails-in-game-list").forEach((listEl) => {
    const rows = listEl.querySelectorAll(".email-item-row");

    rows.forEach((row) => {
      const handle = row.querySelector(".btn-drag-handle");

      // Handle hover untuk mengaktifkan draggable tanpa mengganggu klik teks atau tombol
      if (handle) {
        handle.addEventListener("mouseenter", () => {
          row.setAttribute("draggable", "true");
        });
        handle.addEventListener("mouseleave", () => {
          if (!draggedRegId) {
            row.setAttribute("draggable", "false");
          }
        });

        // Touch Drag & Drop untuk perangkat mobile & tablet
        let isTouching = false;
        handle.addEventListener("touchstart", (e) => {
          if (e.touches.length !== 1) return;
          isTouching = true;
          draggedRegId = row.dataset.regId;
          draggedGameId = row.dataset.gameId;
          row.classList.add("dragging");
        }, { passive: true });

        handle.addEventListener("touchmove", (e) => {
          if (!isTouching || e.touches.length !== 1) return;
          const touch = e.touches[0];
          const elem = document.elementFromPoint(touch.clientX, touch.clientY);
          const targetRow = elem ? elem.closest(".email-item-row") : null;

          if (currentDropTarget && currentDropTarget !== targetRow) {
            currentDropTarget.classList.remove("drop-target-above", "drop-target-below");
          }

          if (targetRow && targetRow !== row && targetRow.dataset.gameId === draggedGameId) {
            currentDropTarget = targetRow;
            const rect = targetRow.getBoundingClientRect();
            const isAbove = (touch.clientY - rect.top) < (rect.height / 2);
            dropPosition = isAbove ? "before" : "after";
            if (isAbove) {
              targetRow.classList.add("drop-target-above");
              targetRow.classList.remove("drop-target-below");
            } else {
              targetRow.classList.add("drop-target-below");
              targetRow.classList.remove("drop-target-above");
            }
          }
        }, { passive: true });

        const onTouchEnd = () => {
          if (!isTouching) return;
          isTouching = false;
          row.classList.remove("dragging");
          if (currentDropTarget && draggedRegId) {
            const targetRegId = currentDropTarget.dataset.regId;
            currentDropTarget.classList.remove("drop-target-above", "drop-target-below");
            if (targetRegId && targetRegId !== draggedRegId) {
              const success = store.moveRegistrationRelative(draggedRegId, targetRegId, dropPosition);
              if (success) {
                showToast("Urutan email berhasil diubah");
              }
            }
          }
          draggedRegId = null;
          draggedGameId = null;
          currentDropTarget = null;
        };

        handle.addEventListener("touchend", onTouchEnd);
        handle.addEventListener("touchcancel", onTouchEnd);
      }

      // Dragstart event (HTML5 Desktop Drag)
      row.addEventListener("dragstart", (e) => {
        draggedRegId = row.dataset.regId;
        draggedGameId = row.dataset.gameId;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", draggedRegId);
        row.classList.add("dragging");
      });

      // Dragend event
      row.addEventListener("dragend", () => {
        row.classList.remove("dragging");
        row.setAttribute("draggable", "false");
        draggedRegId = null;
        draggedGameId = null;
        if (currentDropTarget) {
          currentDropTarget.classList.remove("drop-target-above", "drop-target-below");
          currentDropTarget = null;
        }
      });

      // Dragover event
      row.addEventListener("dragover", (e) => {
        if (!draggedRegId || row.dataset.regId === draggedRegId || row.dataset.gameId !== draggedGameId) {
          return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        const rect = row.getBoundingClientRect();
        const relY = e.clientY - rect.top;
        const isAbove = relY < rect.height / 2;

        if (currentDropTarget && currentDropTarget !== row) {
          currentDropTarget.classList.remove("drop-target-above", "drop-target-below");
        }

        currentDropTarget = row;
        dropPosition = isAbove ? "before" : "after";

        if (isAbove) {
          row.classList.add("drop-target-above");
          row.classList.remove("drop-target-below");
        } else {
          row.classList.add("drop-target-below");
          row.classList.remove("drop-target-above");
        }
      });

      // Dragleave event
      row.addEventListener("dragleave", (e) => {
        if (!row.contains(e.relatedTarget)) {
          row.classList.remove("drop-target-above", "drop-target-below");
          if (currentDropTarget === row) {
            currentDropTarget = null;
          }
        }
      });

      // Drop event
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("drop-target-above", "drop-target-below");
        const targetRegId = row.dataset.regId;
        const targetGameId = row.dataset.gameId;

        if (draggedRegId && targetRegId && draggedRegId !== targetRegId && draggedGameId === targetGameId) {
          const success = store.moveRegistrationRelative(draggedRegId, targetRegId, dropPosition);
          if (success) {
            showToast("Urutan email berhasil diubah");
          }
        }

        draggedRegId = null;
        draggedGameId = null;
        currentDropTarget = null;
      });
    });
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

