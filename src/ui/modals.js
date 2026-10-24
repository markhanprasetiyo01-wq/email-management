// ============================================================================
// MODAL SYSTEM & DIALOG MANAGEMENT (src/ui/modals.js)
// ============================================================================
// File ini mengelola semua jendela pop-up (Modal) dalam aplikasi, seperti:
// 1. Modal Konfirmasi (openConfirmModal) - untuk konfirmasi sebelum menghapus data.
// 2. Modal Tambah / Edit Game (openAddGameModal) - formulir detail data game.
// 3. Modal Edit Ikon Mata Uang (openEditGameCurrencyModal) - ubah simbol mata uang game.
// 4. Modal Hubungkan Email (openConnectEmailToGameModal) - sambungkan email ke game dengan filter & anti-duplikat.
// 5. Modal Edit Akun (openEditGameAccountModal) - ubah status, nickname, dan saldo akun tertentu.
// 6. Modal Backup & Restore (openBackupModal) - download backup JSON, reload disk, dan reset data.

import { store } from "../data/store.js";
import { showToast } from "./toast.js";
import {
  fetchTokenByContractAddress,
  getUsdToIdrRate,
} from "../services/cryptoService.js";
import { authService } from "../services/authService.js";
import { openAuthModal } from "./authModal.js";

// Penampung elemen DOM modal overlay (Singleton)
let modalOverlay = null;

/**
 * getModalElements()
 * ------------------
 * Menggunakan Pola Singleton:
 * Membuat elemen overlay modal hanya sekali di dalam `<body>`.
 * Menyediakan listener penutup otomatis jika pengguna:
 * - Mengklik area luar modal (backdrop / overlay).
 * - Menekan tombol tanda silang (✕).
 * - Menekan tombol keyboard `Escape` (ESC).
 *
 * @returns {{overlay: HTMLElement, title: HTMLElement, body: HTMLElement, footer: HTMLElement}}
 */
function getModalElements() {
  if (!modalOverlay) {
    modalOverlay = document.createElement("div");
    modalOverlay.className = "modal-overlay";
    modalOverlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h2 class="modal-title" id="modal-title">Judul Modal</h2>
          <button class="btn btn-icon-only btn-sm" id="modal-close-btn" style="border:none; background:transparent;">✕</button>
        </div>
        <div class="modal-body" id="modal-body"></div>
        <div class="modal-footer" id="modal-footer"></div>
      </div>
    `;
    document.body.appendChild(modalOverlay);

    // Tutup jika mengklik latar belakang hitam (di luar kotak modal)
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeModal();
    });

    // Tutup jika mengklik tombol silang
    document
      .getElementById("modal-close-btn")
      .addEventListener("click", closeModal);

    // Aksesibilitas: Tutup jika menekan tombol Escape (ESC) pada keyboard
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modalOverlay.classList.contains("active")) {
        closeModal();
      }
    });
  }
  return {
    overlay: modalOverlay,
    title: document.getElementById("modal-title"),
    body: document.getElementById("modal-body"),
    footer: document.getElementById("modal-footer"),
  };
}

/**
 * closeModal()
 * ------------
 * Menyembunyikan modal dengan menghapus kelas CSS 'active'.
 */
export function closeModal() {
  if (modalOverlay) {
    modalOverlay.classList.remove("active");
  }
}

/**
 * openConfirmModal(title, message, onConfirm)
 * -------------------------------------------
 * Modal dialog konfirmasi sederhana sebelum tindakan krusial (misal: hapus data).
 *
 * @param {string} title - Judul peringatan modal
 * @param {string} message - Pesan penjelasan kepada pengguna
 * @param {Function} onConfirm - Callback fungsi yang dijalankan jika pengguna menekan "Ya, Hapus"
 */
export function openConfirmModal(
  title,
  message,
  onConfirm,
  confirmBtnText = "Ya, Lanjutkan",
  confirmBtnClass = "btn-danger",
) {
  const { overlay, title: titleEl, body, footer } = getModalElements();
  titleEl.textContent = title;
  body.innerHTML = `<p style="font-size:0.9rem; color:var(--text-secondary); line-height:1.5;">${message}</p>`;

  footer.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="btn-cancel-modal">Batal</button>
    <button class="btn ${confirmBtnClass} btn-sm" id="btn-ok-modal">${confirmBtnText}</button>
  `;

  document.getElementById("btn-cancel-modal").onclick = closeModal;
  document.getElementById("btn-ok-modal").onclick = () => {
    closeModal();
    onConfirm(); // Eksekusi aksi
  };

  overlay.classList.add("active");
}

/**
 * openAddGameModal(gameId)
 * ------------------------
 * Membuka formulir untuk menambahkan game baru atau mengedit game yang sudah ada.
 * Jika `gameId` diisi, formulir akan otomatis terisi dengan data game tersebut (Mode Edit).
 *
 * @param {string|null} gameId - ID game yang ingin diedit, atau null untuk game baru
 */
export function openAddGameModal(gameId = null) {
  if (!authService.isLoggedIn()) {
    showToast("Silakan login terlebih dahulu!", "error");
    openAuthModal("login");
    return;
  }

  const { overlay, title, body, footer } = getModalElements();
  const isEdit = Boolean(gameId);
  const games = store.getGames();
  const current = isEdit ? games.find((g) => g.id === gameId) : null;

  title.textContent = isEdit
    ? `✏️ Edit Detail Game: ${current?.title || ""}`
    : "🎮 Tambah Game Baru";

  body.innerHTML = `
    <form id="game-form" style="display:flex; flex-direction:column; gap:0.95rem;">
      <!-- Baris 1: Nama Game & Platform -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:0.75rem;">
        <div class="form-group">
          <label class="form-label">Nama Game *</label>
          <input type="text" class="form-input" id="form-game-title" placeholder="Contoh: Architech, Genshin Impact..." value="${current?.title || ""}" required autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">Platform</label>
          <input type="text" list="platform-list" class="form-input" id="form-game-platform" placeholder="Contoh: PC, Mobile" value="${current?.platform || "PC, Mobile"}">
          <datalist id="platform-list">
            <option value="PC, Mobile">
            <option value="PC (Steam / Client)">
            <option value="Android & iOS">
            <option value="Mobile Only">
            <option value="Web ( NFT )">
            <option value="PC, Android, iOS, Console">
          </datalist>
        </div>
      </div>

      <!-- Baris 2: Tipe Ekonomi Game (RMT vs NFT) -->
      <div class="form-group">
        <label class="form-label">💰 Tipe Ekonomi Game</label>
        <select class="form-select" id="form-game-economy-type">
          <option value="rmt" ${!current || current.economyType !== "nft" ? "selected" : ""}>🎮 RMT (Web2 - Manual Rate IDR)</option>
          <option value="nft" ${current?.economyType === "nft" ? "selected" : ""}>⚡ NFT / Crypto (Web3 - Smart Contract)</option>
        </select>
      </div>

      <!-- Container Khusus NFT / Web3 Smart Contract -->
      <div id="nft-contract-section" class="form-group" style="${!current || current.economyType !== "nft" ? "display:none;" : ""} background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.3); border-radius:var(--radius-md); padding:0.85rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
          <label class="form-label" style="color:#a5b4fc; margin-bottom:0;">🔗 Smart Contract Address (CA Token)</label>
          <span style="font-size:0.72rem; color:#818cf8; font-weight:600;">DexScreener Live DEX</span>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <input 
            type="text" 
            class="form-input" 
            id="form-game-contract-address" 
            placeholder="Contoh: 0x... / Solana Token Mint Address" 
            value="${current?.contractAddress || ""}"
            style="font-family:var(--font-mono); font-size:0.85rem;"
          >
          <button type="button" class="btn btn-secondary btn-sm" id="btn-fetch-token" style="white-space:nowrap; padding:0 0.85rem;" title="Ambil info token & harga terkini">
            🔍 Cek Token
          </button>
        </div>
        <div id="token-status-preview" style="margin-top:0.55rem; font-size:0.75rem; color:var(--text-muted); display:${current?.tokenSymbol ? "block" : "none"};">
          <div style="display:inline-flex; align-items:center; gap:0.4rem; background:rgba(255,255,255,0.06); padding:0.25rem 0.6rem; border-radius:6px; border:1px solid rgba(255,255,255,0.1);">
            <span id="preview-token-symbol" style="color:#6ee7b7; font-weight:700;">${current?.tokenSymbol ? `$${current.tokenSymbol}` : ""}</span>
            <span id="preview-token-chain" style="color:#93c5fd; text-transform:uppercase; font-size:0.68rem;">(${current?.tokenChainId || "DEX"})</span>
            <span style="color:var(--text-dim);">|</span>
            <span>$${current?.tokenPriceUsd ? Number(current.tokenPriceUsd).toFixed(4) : "0"}</span>
            <span style="color:var(--text-dim);">≈</span>
            <span id="preview-token-idr" style="color:#fef08a; font-weight:700;">Rp ${current?.currencyRateIdr ? Number(current.currencyRateIdr).toLocaleString("id-ID") : "0"}</span>
          </div>
        </div>
        <input type="hidden" id="form-game-token-symbol" value="${current?.tokenSymbol || ""}">
        <input type="hidden" id="form-game-token-price-usd" value="${current?.tokenPriceUsd || 0}">
        <input type="hidden" id="form-game-token-chain" value="${current?.tokenChainId || ""}">
      </div>

      <!-- Baris 4: Ikon & Warna Tema -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:0.75rem;">
        <div class="form-group">
          <label class="form-label">Ikon / Simbol Game</label>
          <select class="form-select" id="form-game-icon">
            <option value="gamepad-2" ${!current || current.badgeIcon === "gamepad-2" ? "selected" : ""}>🎮 Gamepad</option>
            <option value="cpu" ${current?.badgeIcon === "cpu" ? "selected" : ""}>💻 CPU / Sci-Fi (Architech)</option>
            <option value="swords" ${current?.badgeIcon === "swords" ? "selected" : ""}>⚔️ Swords / RPG</option>
            <option value="shield" ${current?.badgeIcon === "shield" ? "selected" : ""}>🛡️ Shield / MMORPG</option>
            <option value="zap" ${current?.badgeIcon === "zap" ? "selected" : ""}>⚡ Zap / Action</option>
            <option value="sparkles" ${current?.badgeIcon === "sparkles" ? "selected" : ""}>✨ Magic / Fantasy</option>
            <option value="target" ${current?.badgeIcon === "target" ? "selected" : ""}>🎯 Target / Shooter</option>
            <option value="flame" ${current?.badgeIcon === "flame" ? "selected" : ""}>🔥 Flame / Combat</option>
            <option value="crown" ${current?.badgeIcon === "crown" ? "selected" : ""}>👑 Crown / Strategy</option>
            <option value="rocket" ${current?.badgeIcon === "rocket" ? "selected" : ""}>🚀 Rocket / Space</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Warna Tema Game</label>
          <div style="display:flex; align-items:center; gap:0.6rem;">
            <input type="color" id="form-game-color" value="${current?.color || "#6366f1"}" style="width:40px; height:36px; border:none; border-radius:6px; cursor:pointer; background:transparent;">
            <div style="display:flex; gap:0.35rem; flex-wrap:wrap;" id="game-color-swatches">
              <button type="button" class="swatch-btn" data-color="#6366f1" style="background:#6366f1; width:22px; height:22px; border-radius:4px; border:1px solid rgba(255,255,255,0.3); cursor:pointer;" title="Indigo"></button>
              <button type="button" class="swatch-btn" data-color="#10b981" style="background:#10b981; width:22px; height:22px; border-radius:4px; border:1px solid rgba(255,255,255,0.3); cursor:pointer;" title="Emerald"></button>
              <button type="button" class="swatch-btn" data-color="#f59e0b" style="background:#f59e0b; width:22px; height:22px; border-radius:4px; border:1px solid rgba(255,255,255,0.3); cursor:pointer;" title="Amber"></button>
              <button type="button" class="swatch-btn" data-color="#ef4444" style="background:#ef4444; width:22px; height:22px; border-radius:4px; border:1px solid rgba(255,255,255,0.3); cursor:pointer;" title="Red"></button>
              <button type="button" class="swatch-btn" data-color="#06b6d4" style="background:#06b6d4; width:22px; height:22px; border-radius:4px; border:1px solid rgba(255,255,255,0.3); cursor:pointer;" title="Cyan"></button>
              <button type="button" class="swatch-btn" data-color="#8b5cf6" style="background:#8b5cf6; width:22px; height:22px; border-radius:4px; border:1px solid rgba(255,255,255,0.3); cursor:pointer;" title="Purple"></button>
              <button type="button" class="swatch-btn" data-color="#ec4899" style="background:#ec4899; width:22px; height:22px; border-radius:4px; border:1px solid rgba(255,255,255,0.3); cursor:pointer;" title="Pink"></button>
            </div>
          </div>
        </div>
      </div>

      <!-- Baris 5: Ikon / Simbol Mata Uang In-Game -->
      <div class="form-group" style="background:rgba(234,179,8,0.06); border:1px dashed rgba(234,179,8,0.3); border-radius:var(--radius-md); padding:0.75rem;">
        <label class="form-label" style="color:#fef08a;">💰 Ikon / Simbol Mata Uang In-Game Game Ini</label>
        <div style="display:flex; align-items:center; gap:0.6rem; flex-wrap:wrap;">
          <input 
            type="text" 
            class="form-input" 
            id="form-game-currency-icon" 
            value="${current?.currencyIcon || "🪙"}" 
            placeholder="Contoh: 🪙, 💎, 💰, USDT" 
            style="width:90px; font-size:1.15rem; text-align:center; font-weight:700;"
          >
          <div style="display:flex; gap:0.35rem; flex-wrap:wrap;" id="currency-icon-swatches">
            <button type="button" class="btn btn-secondary btn-sm currency-swatch-btn" data-icon="🪙" title="Koin Emas">🪙 Koin</button>
            <button type="button" class="btn btn-secondary btn-sm currency-swatch-btn" data-icon="💎" title="Diamond">💎 Diamond</button>
            <button type="button" class="btn btn-secondary btn-sm currency-swatch-btn" data-icon="💰" title="Kantong Uang">💰 Uang</button>
            <button type="button" class="btn btn-secondary btn-sm currency-swatch-btn" data-icon="💠" title="Crystal">💠 Crystal</button>
            <button type="button" class="btn btn-secondary btn-sm currency-swatch-btn" data-icon="🟡" title="Gold">🟡 Gold</button>
            <button type="button" class="btn btn-secondary btn-sm currency-swatch-btn" data-icon="💵" title="Cash">💵 Cash</button>
            <button type="button" class="btn btn-secondary btn-sm currency-swatch-btn" data-icon="✨" title="Zen">✨ Zen</button>
          </div>
        </div>
        <small style="font-size:0.72rem; color:var(--text-muted); margin-top:0.35rem; display:block;">
          Ikon ini akan muncul di samping jumlah mata uang game ini (di header dan di samping email status LIVE).
        </small>
      </div>

      <!-- Baris 6: Rate IDR per Unit Mata Uang In-Game -->
      <div class="form-group" id="rmt-rate-section" style="background:rgba(16,185,129,0.06); border:1px dashed rgba(16,185,129,0.3); border-radius:var(--radius-md); padding:0.75rem;">
        <label class="form-label" style="color:#6ee7b7;" id="label-rate-section">💱 Kurs / Rate Konversi IDR (RMT / Market)</label>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:0.75rem; align-items:center;">
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:0.25rem;" id="label-price-idr">Harga dalam Rupiah (Rp)</label>
            <div style="position:relative;">
              <span style="position:absolute; left:0.75rem; top:50%; transform:translateY(-50%); font-size:0.85rem; color:var(--text-muted); font-weight:700;">Rp</span>
              <input 
                type="number" 
                class="form-input" 
                id="form-game-currency-rate-idr" 
                value="${current?.currencyRateIdr || ""}" 
                placeholder="Contoh: 25000" 
                min="0"
                step="any"
                style="padding-left:2.4rem; font-family:var(--font-mono); font-weight:700;"
              >
            </div>
          </div>
          <div>
            <label style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:0.25rem;" id="label-unit-amount">Per Jumlah Mata Uang (Unit)</label>
            <div style="position:relative;">
              <span style="position:absolute; left:0.75rem; top:50%; transform:translateY(-50%); font-size:0.85rem; color:var(--text-muted);">/</span>
              <input 
                type="number" 
                class="form-input" 
                id="form-game-currency-rate-unit" 
                value="${current?.currencyRateUnit !== undefined ? current.currencyRateUnit : current?.economyType === "nft" ? 1 : 1000}" 
                placeholder="1000" 
                min="1"
                step="1"
                style="padding-left:1.8rem; font-family:var(--font-mono); font-weight:700;"
              >
            </div>
          </div>
        </div>
        <small style="font-size:0.72rem; color:var(--text-muted); margin-top:0.4rem; display:block;" id="rate-formula-hint">
          Formula: Rp <span id="hint-price">${current?.currencyRateIdr ? Number(current.currencyRateIdr).toLocaleString("id-ID") : "0"}</span> per <span id="hint-unit">${current?.currencyRateUnit || 1000}</span> mata uang in-game. Digunakan untuk menghitung estimasi nilai Rupiah dari saldo akun LIVE.
        </small>
      </div>
    </form>
  `;

  // Toggle handler antara tipe RMT vs NFT
  const economySelect = document.getElementById("form-game-economy-type");
  const nftSection = document.getElementById("nft-contract-section");
  const rateIdrInput = document.getElementById("form-game-currency-rate-idr");
  const rateUnitInput = document.getElementById("form-game-currency-rate-unit");
  const labelPriceIdr = document.getElementById("label-price-idr");
  const labelUnitAmount = document.getElementById("label-unit-amount");
  const labelRateSection = document.getElementById("label-rate-section");

  const syncEconomyUI = () => {
    const isNft = economySelect.value === "nft";
    if (nftSection) nftSection.style.display = isNft ? "block" : "none";

    if (isNft) {
      if (labelRateSection)
        labelRateSection.innerHTML =
          "⚡ Kurs Token Crypto ke IDR (Otomatis dari CA)";
      if (labelPriceIdr) labelPriceIdr.innerHTML = "Harga 1 Token (Rp)";
      if (labelUnitAmount) labelUnitAmount.innerHTML = "Per Token (Satuan)";
      // Default unit untuk NFT/token crypto adalah 1 (karena harga token per 1 biji)
      if (
        rateUnitInput &&
        (!rateUnitInput.value || rateUnitInput.value === "1000")
      ) {
        rateUnitInput.value = "1";
      }
    } else {
      if (labelRateSection)
        labelRateSection.innerHTML =
          "💱 Kurs / Rate Konversi IDR (RMT / Market Manual)";
      if (labelPriceIdr) labelPriceIdr.innerHTML = "Harga dalam Rupiah (Rp)";
      if (labelUnitAmount)
        labelUnitAmount.innerHTML = "Per Jumlah Mata Uang (Unit)";
      if (rateUnitInput && rateUnitInput.value === "1") {
        rateUnitInput.value = "1000";
      }
    }
    updateRateHint();
  };

  economySelect?.addEventListener("change", syncEconomyUI);

  // Tombol Cek Token dari Smart Contract Address (DexScreener API)
  const btnFetchToken = document.getElementById("btn-fetch-token");
  const inputCA = document.getElementById("form-game-contract-address");
  const tokenPreview = document.getElementById("token-status-preview");

  btnFetchToken?.addEventListener("click", async () => {
    const ca = inputCA?.value.trim();
    if (!ca) {
      showToast(
        "Silakan masukkan Smart Contract Address (CA) terlebih dahulu!",
        "error",
      );
      return;
    }

    btnFetchToken.disabled = true;
    btnFetchToken.textContent = "⏳ Memeriksa...";

    const res = await fetchTokenByContractAddress(ca);
    btnFetchToken.disabled = false;
    btnFetchToken.textContent = "🔍 Cek Token";

    if (!res.success) {
      showToast(res.error || "Gagal mengambil data token", "error");
      return;
    }

    const token = res.token;
    showToast(
      `Token $${token.symbol} (${token.chainId}) ditemukan! Rp ${token.priceIdr.toLocaleString("id-ID")}/token`,
    );

    // Otomatis isi nilai rate IDR dan info token
    if (rateIdrInput) rateIdrInput.value = token.priceIdr;
    if (rateUnitInput) rateUnitInput.value = 1;

    document.getElementById("form-game-token-symbol").value = token.symbol;
    document.getElementById("form-game-token-price-usd").value = token.priceUsd;
    document.getElementById("form-game-token-chain").value = token.chainId;

    // Set simbol mata uang jika masih default
    const currIconInput = document.getElementById("form-game-currency-icon");
    if (
      currIconInput &&
      (!currIconInput.value || currIconInput.value === "🪙")
    ) {
      currIconInput.value = token.symbol || "🪙";
    }

    // Tampilkan preview
    if (tokenPreview) {
      tokenPreview.style.display = "block";
      document.getElementById("preview-token-symbol").textContent =
        `$${token.symbol}`;
      document.getElementById("preview-token-chain").textContent =
        `(${token.chainId})`;
      document.getElementById("preview-token-idr").textContent =
        `Rp ${token.priceIdr.toLocaleString("id-ID")}`;
    }

    updateRateHint();
  });

  // Listener untuk pilihan palet swatch warna cepat
  document.querySelectorAll(".swatch-btn").forEach((btn) => {
    btn.onclick = () => {
      const colorInput = document.getElementById("form-game-color");
      if (colorInput) colorInput.value = btn.dataset.color;
    };
  });

  // Listener untuk pilihan preset ikon mata uang
  document.querySelectorAll(".currency-swatch-btn").forEach((btn) => {
    btn.onclick = () => {
      const currInput = document.getElementById("form-game-currency-icon");
      if (currInput) currInput.value = btn.dataset.icon;
    };
  });

  footer.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="btn-cancel-game">Batal</button>
    <button class="btn btn-primary btn-sm" id="btn-save-game">${isEdit ? "Simpan Perubahan" : "Tambah Game"}</button>
  `;

  document.getElementById("btn-cancel-game").onclick = closeModal;
  document.getElementById("btn-save-game").onclick = () => {
    // Ambil seluruh nilai dari input form
    const titleVal =
      document.getElementById("form-game-title")?.value.trim() || "";
    const platformVal =
      document.getElementById("form-game-platform")?.value.trim() || "";
    const officialUrlVal =
      document.getElementById("form-game-url")?.value.trim() ||
      (isEdit ? current?.officialUrl || "" : "");
    const colorVal =
      document.getElementById("form-game-color")?.value || "#6366f1";
    const badgeIconVal =
      document.getElementById("form-game-icon")?.value || "gamepad-2";
    const currencyIconVal =
      document.getElementById("form-game-currency-icon")?.value.trim() || "🪙";
    const currencyRateIdrVal =
      Number(document.getElementById("form-game-currency-rate-idr")?.value) ||
      0;
    const currencyRateUnitVal = Math.max(
      1,
      Number(document.getElementById("form-game-currency-rate-unit")?.value) ||
        1000,
    );

    // Validasi sederhana: judul tidak boleh kosong
    if (!titleVal) {
      showToast("Nama game tidak boleh kosong!", "error");
      return;
    }

    // Validasi Duplikat: Tidak boleh menambahkan atau mengubah nama ke game yang sudah ada
    const normalizedNewTitle = titleVal.toLowerCase();
    const isDuplicate = games.some((g) => {
      if (isEdit && g.id === gameId) return false; // Abaikan game itu sendiri saat mode edit
      return g.title.trim().toLowerCase() === normalizedNewTitle;
    });

    if (isDuplicate) {
      showToast(
        `Game dengan nama "${titleVal}" sudah ada! Gunakan nama yang berbeda.`,
        "error",
      );
      document.getElementById("form-game-title")?.focus();
      return;
    }

    const economyTypeVal =
      document.getElementById("form-game-economy-type")?.value || "rmt";
    const contractAddressVal =
      document.getElementById("form-game-contract-address")?.value.trim() || "";
    const tokenSymbolVal =
      document.getElementById("form-game-token-symbol")?.value.trim() || "";
    const tokenPriceUsdVal =
      Number(document.getElementById("form-game-token-price-usd")?.value) || 0;
    const tokenChainVal =
      document.getElementById("form-game-token-chain")?.value.trim() || "";

    const payload = {
      title: titleVal,
      platform: platformVal || "PC, Mobile",
      officialUrl: officialUrlVal,
      color: colorVal || "#6366f1",
      badgeIcon: badgeIconVal || "gamepad-2",
      currencyIcon: currencyIconVal,
      currencyRateIdr: currencyRateIdrVal,
      currencyRateUnit: currencyRateUnitVal,
      economyType: economyTypeVal,
      contractAddress: contractAddressVal,
      tokenSymbol: tokenSymbolVal,
      tokenPriceUsd: tokenPriceUsdVal,
      tokenChainId: tokenChainVal,
    };

    if (isEdit) {
      store.updateGame(gameId, payload);
      showToast(`Game "${titleVal}" berhasil diperbarui!`);
    } else {
      store.addGame(payload);
      showToast(`Game "${titleVal}" berhasil ditambahkan!`);
    }
    closeModal();
  };

  overlay.classList.add("active");
}

/**
 * openEditGameCurrencyModal(gameId)
 * ---------------------------------
 * Modal jalan pintas khusus untuk menyesuaikan ikon / simbol mata uang game.
 */
export function openEditGameCurrencyModal(gameId) {
  if (!authService.isLoggedIn()) {
    showToast("Silakan login terlebih dahulu!", "error");
    openAuthModal("login");
    return;
  }

  const { overlay, title, body, footer } = getModalElements();
  const games = store.getGames();
  const game = games.find((g) => g.id === gameId);
  if (!game) return;

  const currentIcon = game.currencyIcon || "🪙";

  title.textContent = `💰 Edit Ikon Mata Uang: ${game.title}`;

  body.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1rem;">
      <p style="font-size:0.85rem; color:var(--text-secondary); margin:0;">
        Sesuaikan icon / simbol mata uang in-game untuk game <strong>${game.title}</strong>. Icon ini akan muncul pada kartu game dan seluruh akun LIVE.
      </p>

      <div style="background:var(--bg-subtle); border:1px solid var(--border-card); border-radius:var(--radius-md); padding:1rem; text-align:center;">
        <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:0.4rem;">Preview Tampilan Badge:</span>
        <div style="display:inline-flex; align-items:center; gap:0.4rem; padding:0.45rem 1rem; background:rgba(234, 179, 8, 0.15); border:1px solid rgba(234, 179, 8, 0.5); border-radius:var(--radius-md); font-family:var(--font-mono); font-weight:700; color:#fde047; font-size:1.1rem;">
          <span id="preview-curr-icon" style="font-size:1.25rem;">${currentIcon}</span>
          <span>150.000</span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Ketik Ikon / Simbol Kustom (Bisa Emoji atau Teks)</label>
        <input 
          type="text" 
          class="form-input" 
          id="input-game-currency-icon" 
          value="${currentIcon}" 
          placeholder="Contoh: 🪙, 💎, 💰, 💠, USDT, ZEN" 
          style="font-size:1.15rem; text-align:center; font-weight:700;"
          autofocus
        >
      </div>

      <div>
        <label class="form-label" style="margin-bottom:0.45rem; display:block;">Pilihan Preset Populer (Klik untuk memilih):</label>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(105px, 1fr)); gap:0.4rem;" id="quick-curr-presets">
          <button type="button" class="btn btn-secondary btn-sm quick-curr-btn" data-icon="🪙">🪙 Koin</button>
          <button type="button" class="btn btn-secondary btn-sm quick-curr-btn" data-icon="💎">💎 Diamond</button>
          <button type="button" class="btn btn-secondary btn-sm quick-curr-btn" data-icon="💰">💰 Uang</button>
          <button type="button" class="btn btn-secondary btn-sm quick-curr-btn" data-icon="💠">💠 Crystal</button>
          <button type="button" class="btn btn-secondary btn-sm quick-curr-btn" data-icon="🟡">🟡 Gold</button>
          <button type="button" class="btn btn-secondary btn-sm quick-curr-btn" data-icon="💵">💵 Cash</button>
          <button type="button" class="btn btn-secondary btn-sm quick-curr-btn" data-icon="✨">✨ Zen</button>
          <button type="button" class="btn btn-secondary btn-sm quick-curr-btn" data-icon="🟢">🟢 USDT</button>
          <button type="button" class="btn btn-secondary btn-sm quick-curr-btn" data-icon="⚔️">⚔️ Token</button>
          <button type="button" class="btn btn-secondary btn-sm quick-curr-btn" data-icon="👑">👑 Crown</button>
        </div>
      </div>
    </div>
  `;

  const inputEl = document.getElementById("input-game-currency-icon");
  const previewEl = document.getElementById("preview-curr-icon");

  inputEl.oninput = () => {
    previewEl.textContent = inputEl.value.trim() || "🪙";
  };

  document.querySelectorAll(".quick-curr-btn").forEach((btn) => {
    btn.onclick = () => {
      inputEl.value = btn.dataset.icon;
      previewEl.textContent = btn.dataset.icon;
    };
  });

  footer.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="btn-cancel-curr-modal">Batal</button>
    <button class="btn btn-primary btn-sm" id="btn-save-curr-modal">Simpan Ikon</button>
  `;

  document.getElementById("btn-cancel-curr-modal").onclick = closeModal;
  document.getElementById("btn-save-curr-modal").onclick = () => {
    const newIcon = inputEl.value.trim() || "🪙";
    store.updateGame(gameId, { currencyIcon: newIcon });
    showToast(`Ikon mata uang game "${game.title}" diubah menjadi ${newIcon}!`);
    closeModal();
  };

  overlay.classList.add("active");
}

/**
 * openConnectEmailToGameModal(targetGameId)
 * -----------------------------------------
 * Membuka formulir untuk menghubungkan suatu email ke game tertentu.
 * Fitur canggih di modal ini:
 * 1. Filter cepat (Quick Search) untuk mencari email dari database 38+ email.
 * 2. Pengecekan duplikat: Email yang SUDAH terdaftar di game ini otomatis ditandai disabled (merah).
 * 3. Opsi ketik email baru secara manual jika belum ada di database.
 * 4. Pilihan status (Live, Praregist, Maintenance) dan saldo in-game currency.
 *
 * @param {string|null} targetGameId - ID game yang dituju (opsional)
 */
export function openConnectEmailToGameModal(targetGameId = null) {
  if (!authService.isLoggedIn()) {
    showToast("Silakan login terlebih dahulu!", "error");
    openAuthModal("login");
    return;
  }

  const { overlay, title, body, footer } = getModalElements();
  const games = store.getGames();
  const emails = store.getEmails();

  if (games.length === 0) {
    showToast("Tambahkan game terlebih dahulu!", "error");
    openAddGameModal();
    return;
  }

  const selectedGameId = targetGameId || games[0]?.id;
  const targetGame = games.find((g) => g.id === selectedGameId);

  title.textContent = `✉️ Hubungkan Email ke ${targetGame ? targetGame.title : "Game"}`;

  body.innerHTML = `
    <form id="connect-email-form" style="display:flex; flex-direction:column; gap:1rem;">
      <div class="form-group">
        <label class="form-label">Pilih Game Tujuan *</label>
        <select class="form-select" id="form-connect-game-id" required>
          ${games.map((g) => `<option value="${g.id}" ${g.id === selectedGameId ? "selected" : ""}>🎮 ${g.title}</option>`).join("")}
        </select>
      </div>

      <div class="form-group">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.25rem;">
          <label class="form-label">Pilih Email dari Database *</label>
          <span style="font-size:0.72rem; color:var(--text-muted);">Tidak boleh duplikat di game yang sama</span>
        </div>

        <!-- Pencarian & Pemilihan Email -->
        <div style="display:flex; flex-direction:column; gap:0.5rem;">
          <input 
            type="text" 
            class="form-input" 
            id="form-email-quick-search" 
            placeholder="🔍 Cari email atau nama profil (misal: farm, rohan, architech)..."
            style="font-size:0.8rem; padding:0.45rem 0.75rem;"
          >

          <select class="form-select" id="form-existing-email-select" size="6" style="height:140px; font-family:var(--font-mono); font-size:0.82rem;" required>
          </select>

          <div style="display:flex; align-items:center; justify-content:space-between; gap:0.5rem;">
            <input 
              type="email" 
              class="form-input" 
              id="form-email-input" 
              value=""
              placeholder="Email yang dipilih"
              required 
              readonly
              style="background:var(--bg-subtle); color:#93c5fd; font-weight:600;"
            >
            <button type="button" class="btn btn-secondary btn-sm" id="btn-toggle-custom-email" style="flex-shrink:0;">
              ✍️ Ketik Manual
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-trigger-bulk-modal" style="flex-shrink:0; background:rgba(99,102,241,0.15); color:#a5b4fc; border-color:rgba(99,102,241,0.4);" title="Paste puluhan email sekaligus">
              📥 Bulk Paste
            </button>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Status di Game Ini *</label>
        <div class="status-radio-grid">
          <label class="status-radio-label live selected" data-status-val="live">
            <input type="radio" name="connect-status-radio" value="live" checked>
            <span>🟢 Live</span>
            <small style="font-size:0.68rem; color:var(--text-secondary);">Sudah rilis / aktif</small>
          </label>

          <label class="status-radio-label praregist" data-status-val="praregist">
            <input type="radio" name="connect-status-radio" value="praregist">
            <span>🟡 Praregist</span>
            <small style="font-size:0.68rem; color:var(--text-secondary);">Pre-register</small>
          </label>

          <label class="status-radio-label maintenance" data-status-val="maintenance">
            <input type="radio" name="connect-status-radio" value="maintenance">
            <span>🔴 Maintenance</span>
            <small style="font-size:0.68rem; color:var(--text-secondary);">Perbaikan</small>
          </label>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Nickname / IGN / Catatan (Opsional)</label>
        <input type="text" class="form-input" id="form-connect-ign" placeholder="Contoh: Nickname: Shadow / UID: 812903">
      </div>

      <div class="form-group">
        <label class="form-label">💰 Mata Uang In-Game (Tradable / RMT / Market)</label>
        <input type="number" min="0" step="any" class="form-input" id="form-connect-currency" value="0" placeholder="Contoh: 15000">
        <small style="font-size:0.72rem; color:var(--text-muted);">Hanya akan terlihat dan dihitung saat status akun bernilai LIVE.</small>
      </div>
    </form>
  `;

  const gameSelect = body.querySelector("#form-connect-game-id");
  const existingEmailSelect = body.querySelector("#form-existing-email-select");
  const emailInput = body.querySelector("#form-email-input");
  const quickSearchInput = body.querySelector("#form-email-quick-search");
  const btnToggleCustom = body.querySelector("#btn-toggle-custom-email");

  // Helper untuk merender list email dengan menandai email yang sudah terdaftar di game terpilih
  function updateEmailOptionsList() {
    const currentGameId = gameSelect.value;
    const sq = quickSearchInput.value.toLowerCase().trim();

    // Dapatkan semua ID email yang SUDAH terdaftar di game yang sedang dipilih
    const registeredEmailsInGame = new Set(
      store
        .getRegistrations()
        .filter((r) => r.gameId === currentGameId)
        .map((r) => r.emailId),
    );

    // Filter email berdasarkan input pencarian
    const filtered = emails.filter(
      (em) =>
        em.address.toLowerCase().includes(sq) ||
        (em.label || "").toLowerCase().includes(sq),
    );

    // Buat tag <option>
    existingEmailSelect.innerHTML = filtered
      .map((e) => {
        const isAlreadyInThisGame = registeredEmailsInGame.has(e.id);
        if (isAlreadyInThisGame) {
          return `<option value="${e.address}" disabled style="color:#f87171; background:rgba(239,68,68,0.12);">
          ⛔ ${e.address} (Sudah Terdaftar di Game Ini)
        </option>`;
        } else {
          return `<option value="${e.address}">
          ✉️ ${e.address} ${e.label ? `— ${e.label}` : ""}
        </option>`;
        }
      })
      .join("");

    // Otomatis pilih email pertama yang tersedia (yang belum terdaftar / tidak disabled)
    const firstAvailable = filtered.find(
      (e) => !registeredEmailsInGame.has(e.id),
    );
    if (firstAvailable) {
      existingEmailSelect.value = firstAvailable.address;
      emailInput.value = firstAvailable.address;
    } else {
      emailInput.value = "";
    }
  }

  // Render awal pilihan email
  updateEmailOptionsList();

  // Saat game tujuan diganti di dropdown, refresh list email
  gameSelect.onchange = () => {
    const chosenGame = games.find((g) => g.id === gameSelect.value);
    title.textContent = `✉️ Hubungkan Email ke ${chosenGame ? chosenGame.title : "Game"}`;
    updateEmailOptionsList();
  };

  // Saat mengetik di kolom pencarian email
  quickSearchInput.oninput = () => {
    updateEmailOptionsList();
  };

  // Saat memilih baris email di list
  existingEmailSelect.onchange = () => {
    if (existingEmailSelect.value) {
      emailInput.value = existingEmailSelect.value;
    }
  };

  // Toggle antara memilih dari daftar vs mengetik email baru manual
  if (btnToggleCustom && emailInput) {
    btnToggleCustom.onclick = () => {
      if (emailInput.hasAttribute("readonly")) {
        emailInput.removeAttribute("readonly");
        emailInput.style.background = "var(--bg-input)";
        emailInput.value = "";
        emailInput.focus();
        btnToggleCustom.textContent = "📋 Pilih dari List";
      } else {
        emailInput.setAttribute("readonly", "true");
        emailInput.style.background = "var(--bg-subtle)";
        if (existingEmailSelect?.value) {
          emailInput.value = existingEmailSelect.value;
        }
        btnToggleCustom.textContent = "✍️ Ketik Manual";
      }
    };
  }

  const btnBulkTrigger = body.querySelector("#btn-trigger-bulk-modal");
  if (btnBulkTrigger) {
    btnBulkTrigger.onclick = () => {
      closeModal();
      openBulkEmailModal();
    };
  }

  // Efek klik radio button custom (Live, Praregist, Maintenance)
  body.querySelectorAll(".status-radio-label").forEach((lbl) => {
    lbl.onclick = () => {
      body
        .querySelectorAll(".status-radio-label")
        .forEach((l) => l.classList.remove("selected"));
      lbl.classList.add("selected");
      const radio = lbl.querySelector("input");
      if (radio) radio.checked = true;
    };
  });

  footer.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="btn-cancel-connect">Batal</button>
    <button class="btn btn-primary btn-sm" id="btn-save-connect">Hubungkan Email</button>
  `;

  document.getElementById("btn-cancel-connect").onclick = closeModal;
  document.getElementById("btn-save-connect").onclick = () => {
    const gameId = gameSelect.value;
    const emailAddress = emailInput.value.trim().toLowerCase();
    const statusRadio = body.querySelector(
      'input[name="connect-status-radio"]:checked',
    );
    const status = statusRadio ? statusRadio.value : "live";
    const ign = document.getElementById("form-connect-ign").value.trim();

    if (!emailAddress) {
      showToast("Alamat email tidak boleh kosong!", "error");
      return;
    }

    // Validasi Anti-Duplikat Sebelum Menyimpan
    const allRegs = store.getEnrichedRegistrations();
    const isAlreadyConnected = allRegs.some(
      (r) =>
        r.gameId === gameId && r.email.address.toLowerCase() === emailAddress,
    );

    if (isAlreadyConnected) {
      showToast(
        `Gagal: Email ${emailAddress} sudah terdaftar di game ini!`,
        "error",
      );
      return;
    }

    const currency =
      Number(document.getElementById("form-connect-currency")?.value) || 0;

    try {
      store.addEmailToGame({
        gameId,
        emailAddress,
        status,
        ign,
        currency,
      });
      showToast(`Email ${emailAddress} berhasil dihubungkan!`);
      closeModal();
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  overlay.classList.add("active");
}

/**
 * openEditGameAccountModal(regId)
 * -------------------------------
 * Mengedit rincian akun email yang sudah terhubung pada game tertentu
 * (mengubah status game, nama IGN / akun, dan saldo koin in-game).
 *
 * @param {string} regId - ID pendaftaran (registration ID)
 */
export function openEditGameAccountModal(regId) {
  if (!authService.isLoggedIn()) {
    showToast("Silakan login terlebih dahulu!", "error");
    openAuthModal("login");
    return;
  }

  const { overlay, title, body, footer } = getModalElements();
  const regList = store.getEnrichedRegistrations();
  const reg = regList.find((r) => r.id === regId);
  if (!reg) return;

  title.textContent = `Edit Akun: ${reg.game.title}`;

  body.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1rem;">
      <div style="background:var(--bg-subtle); padding:0.75rem; border-radius:var(--radius-md); border:1px solid var(--border-card);">
        <div style="font-size:0.75rem; color:var(--text-muted);">Alamat Email:</div>
        <div style="font-family:var(--font-mono); font-size:0.95rem; color:#fff; font-weight:700;">✉️ ${reg.email.address}</div>
      </div>

      <div class="form-group">
        <label class="form-label">Status Game</label>
        <select class="form-select" id="edit-reg-status">
          <option value="live" ${reg.status === "live" ? "selected" : ""}>🟢 Live (Aktif / Sudah Rilis)</option>
          <option value="praregist" ${reg.status === "praregist" ? "selected" : ""}>🟡 Praregist (Pre-register)</option>
          <option value="maintenance" ${reg.status === "maintenance" ? "selected" : ""}>🔴 Maintenance (Sedang Perbaikan)</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Nickname / IGN / Catatan</label>
        <input type="text" class="form-input" id="edit-reg-ign" value="${reg.ign || ""}" placeholder="Contoh: IGN / UID / Server...">
      </div>

      <div class="form-group">
        <label class="form-label">💰 Mata Uang In-Game (Tradable / RMT / Market)</label>
        <input type="number" min="0" step="any" class="form-input" id="edit-reg-currency" value="${reg.currency ?? 0}" placeholder="Contoh: 15000">
        <small style="font-size:0.72rem; color:var(--text-muted);">Mata uang ini hanya akan terlihat dan dihitung saat akun berstatus LIVE.</small>
      </div>
    </div>
  `;

  footer.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="btn-cancel-edit-acc">Batal</button>
    <button class="btn btn-primary btn-sm" id="btn-save-edit-acc">Simpan</button>
  `;

  document.getElementById("btn-cancel-edit-acc").onclick = closeModal;
  document.getElementById("btn-save-edit-acc").onclick = () => {
    const status = document.getElementById("edit-reg-status").value;
    const ign = document.getElementById("edit-reg-ign").value.trim();
    const currency =
      Number(document.getElementById("edit-reg-currency").value) || 0;

    store.updateRegistration(regId, { status, ign, currency });
    showToast("Data akun berhasil diperbarui!");
    closeModal();
  };

  overlay.classList.add("active");
}

/**
 * openBackupModal()
 * -----------------
 * Membuka modal informasi penyimpanan Cloud Database,
 * serta tombol untuk download file cadangan (JSON backup) atau reset ke kondisi awal.
 */
export function openBackupModal() {
  if (!authService.isLoggedIn()) {
    showToast("Silakan login terlebih dahulu!", "error");
    openAuthModal("login");
    return;
  }

  const { overlay, title, body, footer } = getModalElements();
  title.textContent = "💾 Penyimpanan & Cadangan Data";

  const userEmail = authService.getUser()?.email || "User";

  body.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1.1rem;">
      <div style="background:rgba(99, 102, 241, 0.08); border:1px solid rgba(99, 102, 241, 0.25); border-radius:var(--radius-md); padding:0.95rem; font-size:0.83rem; line-height:1.5;">
        <div style="font-weight:700; color:#818cf8; margin-bottom:0.35rem; display:flex; align-items:center; gap:0.4rem;">
          <span>👤</span>
          <span>Ruang Kerja Terenkripsi: <strong>${userEmail}</strong></span>
        </div>
        <p style="color:var(--text-secondary); margin:0;">
          Semua data game, email terhubung, status, dan estimasi finansial tersimpan aman di database cloud pribadi Anda. Gunakan opsi di bawah ini untuk mengunduh cadangan lokal atau mereset database.
        </p>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:0.65rem;">
        <button class="btn btn-secondary" id="btn-dl-json" style="padding:0.75rem; justify-content:flex-start;">
          <span style="font-size:1.1rem;">💾</span>
          <div style="text-align:left;">
            <div style="font-size:0.85rem; font-weight:700;">Download Backup JSON</div>
            <div style="font-size:0.72rem; color:var(--text-muted); font-weight:normal;">Unduh seluruh data Anda ke file .json</div>
          </div>
        </button>

        <button class="btn btn-secondary" id="btn-import-trigger" style="padding:0.75rem; justify-content:flex-start;">
          <span style="font-size:1.1rem;">📥</span>
          <div style="text-align:left;">
            <div style="font-size:0.85rem; font-weight:700;">Restore dari File Backup</div>
            <div style="font-size:0.72rem; color:var(--text-muted); font-weight:normal;">Pulihkan data dari file backup JSON</div>
          </div>
        </button>
        <input type="file" id="input-import-json" accept=".json" style="display:none;">

        <button class="btn btn-secondary" id="btn-reload-file" style="padding:0.75rem; justify-content:flex-start;">
          <span style="font-size:1.1rem;">🔄</span>
          <div style="text-align:left;">
            <div style="font-size:0.85rem; font-weight:700;">Sinkron Ulang Cloud</div>
            <div style="font-size:0.72rem; color:var(--text-muted); font-weight:normal;">Tarik data terbaru dari server cloud</div>
          </div>
        </button>

        <button class="btn btn-secondary" id="btn-reset-db" style="padding:0.75rem; justify-content:flex-start; border-color:rgba(239, 68, 68, 0.35); background:rgba(239, 68, 68, 0.06);">
          <span style="font-size:1.1rem;">🗑️</span>
          <div style="text-align:left;">
            <div style="font-size:0.85rem; font-weight:700; color:#f87171;">Kosongkan Database</div>
            <div style="font-size:0.72rem; color:#fca5a5; font-weight:normal;">Hapus semua game & email di akun ini</div>
          </div>
        </button>
      </div>
    </div>
  `;

  footer.innerHTML = `<button class="btn btn-secondary btn-sm" id="btn-close-backup">Tutup</button>`;
  document.getElementById("btn-close-backup").onclick = closeModal;

  // 1. Download Backup JSON
  document.getElementById("btn-dl-json").onclick = () => {
    store.exportJSON();
    showToast("File backup JSON berhasil diunduh ke komputer!");
  };

  // 2. Restore dari File Backup JSON
  const importTrigger = document.getElementById("btn-import-trigger");
  const fileInput = document.getElementById("input-import-json");
  if (importTrigger && fileInput) {
    importTrigger.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result;
        if (typeof content === "string") {
          const res = store.importJSON(content);
          if (res.success) {
            showToast("Data backup berhasil dipulihkan ke akun Anda!");
            closeModal();
          } else {
            showToast(res.message || "Gagal memproses file JSON", "error");
          }
        }
      };
      reader.readAsText(file);
    };
  }

  // 3. Sinkron Ulang Cloud
  document.getElementById("btn-reload-file").onclick = async () => {
    const success = await store.loadFromFile();
    if (success) {
      showToast("Data berhasil disinkronkan dari cloud!");
      closeModal();
    } else {
      showToast("Data telah diperbarui!");
    }
  };

  // 4. Kosongkan / Reset Database Akun
  document.getElementById("btn-reset-db").onclick = () => {
    openConfirmModal(
      "Konfirmasi Kosongkan Database",
      "Apakah Anda yakin ingin menghapus seluruh game dan email di akun Anda? Database Anda akan kembali kosong bersih.",
      () => {
        store.clearAll();
        showToast("Database akun Anda telah dikosongkan.");
        closeModal();
      },
      "🗑️ Ya, Kosongkan",
      "btn-danger",
    );
  };

  overlay.classList.add("active");
}

/**
 * openBulkEmailModal()
 * --------------------
 * Modal untuk paste massal puluhan/ratusan email sekaligus dari Notepad/Excel.
 * Otomatis mendeteksi pemisah baris baru (enter), koma, atau spasi,
 * lalu menyimpannya langsung ke Cloud Database.
 */
export function openBulkEmailModal() {
  if (!authService.isLoggedIn()) {
    showToast("Silakan login terlebih dahulu!", "error");
    openAuthModal("login");
    return;
  }

  const { overlay, title, body, footer } = getModalElements();
  const games = store.getGames();

  title.textContent = "📥 Impor & Paste Banyak Email Sekaligus";

  body.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1rem;">
      <div style="background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.25); border-radius:var(--radius-md); padding:0.85rem; font-size:0.8rem; line-height:1.5;">
        <span style="color:#818cf8; font-weight:700; display:block; margin-bottom:0.25rem;">💡 Cara Mudah Input Banyak Email:</span>
        Paste seluruh daftar email Anda di bawah ini. Anda bisa copy langsung dari <strong>Notepad, Excel, atau file Text</strong>. Pisahkan dengan <strong>Enter (baris baru)</strong> atau <strong>koma (,)</strong>.
      </div>

      <div class="form-group">
        <label class="form-label">Daftar Email (Paste di sini) *</label>
        <textarea 
          id="bulk-emails-textarea" 
          class="form-input" 
          rows="7" 
          placeholder="contoh:\nakunfarm01@gmail.com\nakunfarm02@gmail.com\nakunfarm03@gmail.com\nkunyuk@yahoo.com"
          style="font-family:var(--font-mono); font-size:0.85rem; line-height:1.45; resize:vertical;"
          autofocus
        ></textarea>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.35rem; font-size:0.75rem; color:var(--text-muted);">
          <span>Terdeteksi: <strong id="bulk-email-count" style="color:#6ee7b7;">0</strong> email valid</span>
          <button type="button" id="btn-clear-bulk-text" style="background:none; border:none; color:#f87171; cursor:pointer; font-size:0.75rem;">Bersihkan Teks</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Label / Kategori Email (Opsional)</label>
        <input 
          type="text" 
          id="bulk-email-label" 
          class="form-input" 
          value="Akun Farm" 
          placeholder="Contoh: Akun Farm, RMT, Main, Personal"
        >
      </div>

      <!-- Opsi Tambahan: Langsung Hubungkan ke Game Tertentu -->
      ${
        games.length > 0
          ? `
        <div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:var(--radius-md); padding:0.85rem;">
          <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; font-size:0.82rem; font-weight:600; color:#e2e8f0; margin-bottom:0.6rem;">
            <input type="checkbox" id="check-auto-connect-game" style="accent-color:var(--primary); width:16px; height:16px;">
            <span>Langsung hubungkan seluruh email ini ke game tertentu</span>
          </label>

          <div id="bulk-game-connect-options" style="display:none; flex-direction:column; gap:0.75rem; padding-top:0.5rem; border-top:1px dashed rgba(255,255,255,0.1);">
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:0.75rem;">Pilih Game Tujuan:</label>
              <select class="form-select" id="bulk-target-game">
                ${games.map((g) => `<option value="${g.id}">🎮 ${g.title}</option>`).join("")}
              </select>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label" style="font-size:0.75rem;">Status Akun di Game:</label>
              <select class="form-select" id="bulk-target-status">
                <option value="praregist">🟡 Praregist (Pre-register)</option>
                <option value="live">🟢 Live (Rilis)</option>
                <option value="maintenance">🔴 Maintenance</option>
              </select>
            </div>
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;

  const textarea = document.getElementById("bulk-emails-textarea");
  const countEl = document.getElementById("bulk-email-count");
  const clearBtn = document.getElementById("btn-clear-bulk-text");
  const checkAutoConnect = document.getElementById("check-auto-connect-game");
  const connectOptions = document.getElementById("bulk-game-connect-options");

  if (checkAutoConnect && connectOptions) {
    checkAutoConnect.onchange = () => {
      connectOptions.style.display = checkAutoConnect.checked ? "flex" : "none";
    };
  }

  function parseEmails() {
    const raw = textarea.value;
    const parts = raw.split(/[\r\n,;]+/).map((s) => s.trim().toLowerCase());
    const valid = parts.filter((s) => s && s.includes("@") && s.includes("."));
    return [...new Set(valid)];
  }

  textarea.oninput = () => {
    const valid = parseEmails();
    countEl.textContent = valid.length;
  };

  clearBtn.onclick = () => {
    textarea.value = "";
    countEl.textContent = "0";
    textarea.focus();
  };

  footer.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="btn-cancel-bulk">Batal</button>
    <button class="btn btn-primary btn-sm" id="btn-save-bulk">💾 Simpan Semua ke Cloud</button>
  `;

  document.getElementById("btn-cancel-bulk").onclick = closeModal;
  document.getElementById("btn-save-bulk").onclick = () => {
    const validEmails = parseEmails();
    if (validEmails.length === 0) {
      showToast("Silakan masukkan minimal 1 alamat email yang valid!", "error");
      textarea.focus();
      return;
    }

    const defaultLabel =
      document.getElementById("bulk-email-label")?.value.trim() || "Personal";
    const res = store.addBulkEmails(validEmails, defaultLabel);

    // Jika user memilih auto-hubungkan ke game
    if (checkAutoConnect?.checked) {
      const targetGameId = document.getElementById("bulk-target-game")?.value;
      const targetStatus =
        document.getElementById("bulk-target-status")?.value || "praregist";

      if (targetGameId) {
        let connectedCount = 0;
        validEmails.forEach((addr) => {
          try {
            store.addEmailToGame({
              gameId: targetGameId,
              emailAddress: addr,
              status: targetStatus,
              ign: "",
              currency: 0,
            });
            connectedCount++;
          } catch {
            // Abaikan jika sudah terdaftar
          }
        });
        showToast(
          `Berhasil menyimpan ${res.added} email baru & menghubungkan ${connectedCount} email ke game!`,
        );
        closeModal();
        return;
      }
    }

    showToast(
      `Berhasil menambahkan ${res.added} email baru ke Cloud Database!` +
        (res.existing > 0
          ? ` (${res.existing} email sudah ada sebelumnya)`
          : ""),
    );
    closeModal();
  };

  overlay.classList.add("active");
}

/**
 * openEditEmailDetailsModal(emailId)
 * ----------------------------------
 * Modal untuk mengedit rincian email tersimpan (alamat email, label, provider, catatan).
 */
export function openEditEmailDetailsModal(emailId) {
  if (!authService.isLoggedIn()) {
    showToast("Silakan login terlebih dahulu!", "error");
    openAuthModal("login");
    return;
  }

  const { overlay, title, body, footer } = getModalElements();
  const emails = store.getEmails();
  const emailObj = emails.find((e) => e.id === emailId);
  if (!emailObj) return;

  title.textContent = `✏️ Edit Email: ${emailObj.address}`;

  body.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:1rem;">
      <div class="form-group">
        <label class="form-label">Alamat Email *</label>
        <input 
          type="email" 
          id="form-edit-email-address" 
          class="form-input" 
          value="${emailObj.address}" 
          required
        >
      </div>

      <div class="form-group">
        <label class="form-label">Label / Kategori</label>
        <input 
          type="text" 
          id="form-edit-email-label" 
          class="form-input" 
          value="${emailObj.label || "Personal"}" 
          placeholder="Contoh: Akun Farm, Main, RMT"
        >
      </div>

      <div class="form-group">
        <label class="form-label">Email Pemulihan / Recovery (Opsional)</label>
        <input 
          type="email" 
          id="form-edit-email-recovery" 
          class="form-input" 
          value="${emailObj.recoveryEmail || ""}" 
          placeholder="recovery@email.com"
        >
      </div>

      <div class="form-group">
        <label class="form-label">Catatan Pribadi (Opsional)</label>
        <input 
          type="text" 
          id="form-edit-email-notes" 
          class="form-input" 
          value="${emailObj.notes || ""}" 
          placeholder="Contoh: Akun ke-5 buat farm dungeon"
        >
      </div>
    </div>
  `;

  footer.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="btn-cancel-edit-email">Batal</button>
    <button class="btn btn-primary btn-sm" id="btn-save-edit-email">Simpan Perubahan</button>
  `;

  document.getElementById("btn-cancel-edit-email").onclick = closeModal;
  document.getElementById("btn-save-edit-email").onclick = () => {
    const newAddress = document
      .getElementById("form-edit-email-address")
      ?.value.trim()
      .toLowerCase();
    const newLabel =
      document.getElementById("form-edit-email-label")?.value.trim() ||
      "Personal";
    const newRecovery =
      document.getElementById("form-edit-email-recovery")?.value.trim() || "";
    const newNotes =
      document.getElementById("form-edit-email-notes")?.value.trim() || "";

    if (!newAddress || !newAddress.includes("@")) {
      showToast("Alamat email tidak valid!", "error");
      return;
    }

    store.updateEmail(emailId, {
      address: newAddress,
      label: newLabel,
      recoveryEmail: newRecovery,
      notes: newNotes,
    });

    showToast(`Email ${newAddress} berhasil diperbarui!`);
    closeModal();
  };

  overlay.classList.add("active");
}

// ============================================================================
// ALIAS FUNGSI (Untuk kompatibilitas ke belakang jika dipanggil modul lain)
// ============================================================================
export const openQuickAddGameModal = openAddGameModal;
export const openRegistrationModal = openConnectEmailToGameModal;
export const openEditRegModal = openEditGameAccountModal;
export const openEmailModal = openConnectEmailToGameModal;
