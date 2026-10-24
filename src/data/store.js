// ============================================================================
// STATE MANAGEMENT & DATA STORE (src/data/store.js)
// ============================================================================
// Pusat Data Mutlak: Menggunakan Cloud Database (Upstash Redis) via /api/data.
// Arsitektur Singleton dan Observer Pattern:
// 
// 1. SINGLE SOURCE OF TRUTH (CLOUD DATABASE):
//    Seluruh data game, email terhubung, status, dan estimasi koin tersimpan di Cloud Redis.
// 2. USER ISOLATION:
//    Data setiap pengguna terisolasi penuh berdasarkan akun login masing-masing.
// 3. OBSERVER PATTERN (subscribe & notify):
//    Setiap kali ada data yang ditambah, diubah, atau dihapus, method `notify()` dipanggil
//    dan otomatis disinkronkan ke Cloud Database.

import {
  DEFAULT_GAMES,
  DEFAULT_EMAILS,
  DEFAULT_REGISTRATIONS,
} from "./defaultData.js";
import { authService } from "../services/authService.js";

// Kunci penyimpanan cache per user (hanya untuk fast re-render sesi aktif pengguna yang login)
function getUserStoragePrefix() {
  const user = authService.getUser();
  return user?.id ? `gm_user_${user.id}_` : null;
}

class Store {
  constructor() {
    this.listeners = new Set();
    
    // Status konektivitas dan target penyimpanan:
    // Seluruh data WAJIB mutlak disimpan di Cloud Database (Upstash Redis / Vercel KV)
    this.storageMode = "cloud";
    this.isServerConnected = false;
    this.lastSyncedAt = null;
    this.isInitialized = false;

    // State in-memory (data yang aktif di memori RAM saat aplikasi berjalan)
    this.games = [];
    this.emails = [];
    this.registrations = [];

    // Pengontrol antrian sinkronisasi cloud
    this._syncDebounceTimer = null;
    this._isSyncInProgress = false;
    this._syncPending = false;

    // Baca session cache pengguna jika ada
    this.loadUserSessionCache();

    // Baca data otoritatif dari Cloud Database via /api/data
    this.readyPromise = this.initFromCloud();
  }

  /**
   * loadUserSessionCache()
   * Memuat cache sementara sesi pengguna yang sedang login saat ini agar transisi halus.
   * Tidak akan membaca cache milik pengguna lain atau cache global tanpa otentikasi.
   */
  loadUserSessionCache() {
    try {
      const prefix = getUserStoragePrefix();
      if (!prefix || !authService.isLoggedIn()) {
        this.games = [];
        this.emails = [];
        this.registrations = [];
        return;
      }

      const g = localStorage.getItem(`${prefix}games`);
      const e = localStorage.getItem(`${prefix}emails`);
      const r = localStorage.getItem(`${prefix}registrations`);
      if (g) this.games = JSON.parse(g);
      if (e) this.emails = JSON.parse(e);
      if (r) this.registrations = JSON.parse(r);

      if (!Array.isArray(this.games)) this.games = [];
      if (!Array.isArray(this.emails)) this.emails = [];
      if (!Array.isArray(this.registrations)) this.registrations = [];
    } catch {
      this.games = [];
      this.emails = [];
      this.registrations = [];
    }
  }

  /**
   * initFromCloud()
   * Mengambil data mutlak dari Cloud Database (Upstash Redis) lewat endpoint terotentikasi /api/data.
   */
  async initFromCloud() {
    let hasLoadedFromServer = false;

    try {
      const token = authService.getToken();
      if (!token) {
        // Jika tidak ada user login, pastikan data kosong bersih
        this.games = [];
        this.emails = [];
        this.registrations = [];
        this.storageMode = "cloud";
        this.isServerConnected = false;
        this.isInitialized = true;
        this.notify();
        return false;
      }

      const res = await fetch("/api/data?t=" + Date.now(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (
          Array.isArray(data.games) &&
          Array.isArray(data.emails) &&
          Array.isArray(data.registrations)
        ) {
          this.games = data.games;
          this.emails = data.emails;
          this.registrations = data.registrations;
          this.storageMode = "cloud";
          this.isServerConnected = true;
          this.lastSyncedAt = data.lastUpdated || new Date().toISOString();
          this._writeUserSessionCache();
          hasLoadedFromServer = true;
        }
      } else if (res.status === 401) {
        // Token tidak valid atau sesi berakhir
        authService.clearSession();
        this.games = [];
        this.emails = [];
        this.registrations = [];
        this.isServerConnected = false;
      }
    } catch (err) {
      console.warn("Gagal menghubungi Cloud Database:", err);
      this.isServerConnected = false;
    }

    this.isInitialized = true;
    this.notify();
    return hasLoadedFromServer;
  }

  // Alias untuk memuat ulang data dari cloud secara manual jika user menekan tombol sinkron
  async loadFromFile() {
    return await this.initFromCloud();
  }

  /**
   * _writeUserSessionCache()
   * Menyimpan salinan sesi pengguna yang sedang aktif ke browser
   */
  _writeUserSessionCache() {
    try {
      const prefix = getUserStoragePrefix();
      if (!prefix || !authService.isLoggedIn()) return;

      localStorage.setItem(`${prefix}games`, JSON.stringify(this.games));
      localStorage.setItem(`${prefix}emails`, JSON.stringify(this.emails));
      localStorage.setItem(`${prefix}registrations`, JSON.stringify(this.registrations));
    } catch (e) {
      console.warn("Gagal menulis cache sesi:", e);
    }
  }

  /**
   * syncToFile()
   * Memicu sinkronisasi data mutlak ke Cloud Database dengan debouncing aman.
   */
  async syncToFile() {
    if (!this.isInitialized) {
      await this.readyPromise;
    }

    if (this._syncDebounceTimer) {
      clearTimeout(this._syncDebounceTimer);
    }

    this._syncDebounceTimer = setTimeout(() => {
      this._performSync();
    }, 80);
  }

  /**
   * _performSync()
   * Mengirim dan menyimpan data langsung ke Cloud Database (Upstash Redis)
   */
  async _performSync() {
    if (this._isSyncInProgress) {
      this._syncPending = true;
      return;
    }

    const token = authService.getToken();
    if (!token) return;

    this._isSyncInProgress = true;
    try {
      const payload = {
        lastUpdated: new Date().toISOString(),
        games: this.games,
        emails: this.emails,
        registrations: this.registrations,
      };

      const res = await fetch("/api/data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const result = await res.json();
        this.isServerConnected = true;
        this.storageMode = "cloud";
        this.lastSyncedAt = result.lastUpdated || payload.lastUpdated;
        this._writeUserSessionCache();
        this.notify();
      }
    } catch (err) {
      console.warn("Gagal menyimpan ke Cloud Database:", err);
      this.isServerConnected = false;
    } finally {
      this._isSyncInProgress = false;
      if (this._syncPending) {
        this._syncPending = false;
        this._performSync();
      }
    }
  }

  /**
   * subscribe(listener)
   * -------------------
   * Mendaftarkan fungsi listener yang akan dipanggil setiap kali ada data yang berubah.
   * Mengembalikan fungsi pembersih (cleanup function) untuk unsubscribe.
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * notify()
   * --------
   * Memanggil seluruh fungsi listener yang terdaftar untuk memberitahukan pembaruan data.
   */
  notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error("Store listener error:", err);
      }
    }
  }

  // ==========================================================================
  // MANAJEMEN DATA GAME (CRUD: Create, Read, Update, Delete)
  // ==========================================================================

  /**
   * getGames()
   * Mengembalikan salinan (shallow copy) dari array games.
   */
  getGames() {
    return [...this.games];
  }

  /**
   * saveGames(games)
   * Mengganti seluruh array games sekaligus.
   */
  saveGames(games) {
    this.games = [...games];
    this._writeUserSessionCache();
    this.syncToFile();
    this.notify();
  }

  /**
   * addGame(gameData)
   * Menambahkan game baru ke urutan paling depan array.
   */
  addGame(gameData) {
    const trimmedTitle = (gameData.title || "").trim();
    if (!trimmedTitle) {
      throw new Error("Nama game tidak boleh kosong");
    }

    // Proteksi duplikat: Cek apakah nama game sudah terdaftar (case-insensitive)
    const exists = this.games.some(
      (g) => g.title.trim().toLowerCase() === trimmedTitle.toLowerCase()
    );
    if (exists) {
      throw new Error(`Game dengan nama "${trimmedTitle}" sudah ada!`);
    }

    const newGame = {
      id: "game-" + Date.now(), // Generate ID unik berbasis timestamp
      title: trimmedTitle,
      platform: (gameData.platform || "PC, Mobile").trim(),
      officialUrl: (gameData.officialUrl || "").trim(),
      color: gameData.color || "#6366f1",
      badgeIcon: gameData.badgeIcon || "gamepad-2",
      currencyIcon: (gameData.currencyIcon || "🪙").trim(),
      currencyRateIdr: Number(gameData.currencyRateIdr) || 0,
      currencyRateUnit: Math.max(1, Number(gameData.currencyRateUnit) || 1000),
      // Atribut Ekonomi: 'rmt' (Web2) atau 'nft' (Web3)
      economyType: gameData.economyType || (gameData.contractAddress ? "nft" : "rmt"),
      contractAddress: (gameData.contractAddress || "").trim(),
      tokenSymbol: (gameData.tokenSymbol || "").trim(),
      tokenPriceUsd: Number(gameData.tokenPriceUsd) || 0,
      tokenChainId: (gameData.tokenChainId || "").trim(),
    };
    this.games.unshift(newGame); // Taruh di awal
    this._writeUserSessionCache();
    this.syncToFile();
    this.notify();
    return newGame;
  }

  /**
   * updateGame(id, gameData)
   * Memperbarui informasi suatu game berdasarkan ID-nya.
   */
  updateGame(id, gameData) {
    if (gameData.title !== undefined) {
      const trimmedTitle = gameData.title.trim();
      const duplicate = this.games.some(
        (g) => g.id !== id && g.title.trim().toLowerCase() === trimmedTitle.toLowerCase()
      );
      if (duplicate) {
        throw new Error(`Game dengan nama "${trimmedTitle}" sudah ada!`);
      }
    }

    this.games = this.games.map((g) => {
      if (g.id === id) {
        return {
          ...g,
          title: gameData.title !== undefined ? gameData.title.trim() : g.title,
          platform: gameData.platform !== undefined ? gameData.platform.trim() : g.platform,
          officialUrl: gameData.officialUrl !== undefined ? gameData.officialUrl.trim() : g.officialUrl,
          color: gameData.color || g.color || "#6366f1",
          badgeIcon: gameData.badgeIcon || g.badgeIcon || "gamepad-2",
          currencyIcon: gameData.currencyIcon !== undefined ? gameData.currencyIcon.trim() : (g.currencyIcon || "🪙"),
          currencyRateIdr: gameData.currencyRateIdr !== undefined ? (Number(gameData.currencyRateIdr) || 0) : (g.currencyRateIdr || 0),
          currencyRateUnit: gameData.currencyRateUnit !== undefined ? Math.max(1, Number(gameData.currencyRateUnit) || 1000) : (g.currencyRateUnit || 1000),
          // Atribut Ekonomi: 'rmt' (Web2) atau 'nft' (Web3)
          economyType: gameData.economyType !== undefined ? gameData.economyType : (g.economyType || (g.contractAddress ? "nft" : "rmt")),
          contractAddress: gameData.contractAddress !== undefined ? gameData.contractAddress.trim() : (g.contractAddress || ""),
          tokenSymbol: gameData.tokenSymbol !== undefined ? gameData.tokenSymbol.trim() : (g.tokenSymbol || ""),
          tokenPriceUsd: gameData.tokenPriceUsd !== undefined ? (Number(gameData.tokenPriceUsd) || 0) : (g.tokenPriceUsd || 0),
          tokenChainId: gameData.tokenChainId !== undefined ? gameData.tokenChainId.trim() : (g.tokenChainId || ""),
        };
      }
      return g;
    });
    this._writeUserSessionCache();
    this.syncToFile();
    this.notify();
  }

  /**
   * deleteGame(id)
   * Menghapus game dari daftar dan menghapus seluruh akun pendaftaran yang memakai game ini.
   */
  deleteGame(id) {
    this.games = this.games.filter((g) => g.id !== id);
    // Hapus juga relasi pendaftaran (cascade delete)
    this.registrations = this.registrations.filter((r) => r.gameId !== id);
    this._writeUserSessionCache();
    this.syncToFile();
    this.notify();
  }

  // ==========================================================================
  // MANAJEMEN DATA EMAIL (CRUD)
  // ==========================================================================

  /**
   * getEmails()
   * Mengembalikan salinan array daftar email.
   */
  getEmails() {
    return [...this.emails];
  }

  /**
   * saveEmails(emails)
   * Mengganti seluruh array email sekaligus.
   */
  saveEmails(emails) {
    this.emails = [...emails];
    this._writeUserSessionCache();
    this.syncToFile();
    this.notify();
  }

  /**
   * addEmail(emailData)
   * Menambahkan alamat email baru ke dalam database inventaris email.
   */
  addEmail(emailData) {
    const address = (emailData.address || "").trim().toLowerCase();

    // Deteksi otomatis penyedia layanan email (provider) jika tidak diisi manual
    let provider = emailData.provider?.trim();
    if (!provider) {
      if (address.includes("@gmail.com")) provider = "Google";
      else if (
        address.includes("@outlook.com") ||
        address.includes("@hotmail.com")
      )
        provider = "Microsoft Outlook";
      else if (
        address.includes("@proton.me") ||
        address.includes("@protonmail.com")
      )
        provider = "Proton Mail";
      else if (address.includes("@yahoo.com")) provider = "Yahoo";
      else provider = "Custom Mail";
    }

    const newEmail = {
      id: "email-" + Date.now(),
      address,
      provider,
      label: emailData.label?.trim() || "Personal",
      recoveryEmail: emailData.recoveryEmail?.trim() || "",
      notes: emailData.notes?.trim() || "",
      createdAt: new Date().toISOString(),
    };
    this.emails.unshift(newEmail);
    this._writeUserSessionCache();
    this.syncToFile();
    this.notify();
    return newEmail;
  }

  /**
   * addBulkEmails(emailAddresses, defaultLabel = "Personal")
   * Menambahkan banyak email sekaligus (bulk paste) ke database cloud.
   */
  addBulkEmails(emailAddresses, defaultLabel = "Personal") {
    if (!Array.isArray(emailAddresses) || emailAddresses.length === 0) {
      return { added: 0, existing: 0 };
    }

    const existingSet = new Set(this.emails.map((e) => e.address.toLowerCase()));
    let addedCount = 0;
    let existingCount = 0;

    const newItems = [];
    const now = Date.now();

    emailAddresses.forEach((raw, idx) => {
      const address = (raw || "").trim().toLowerCase();
      if (!address || !address.includes("@")) return;

      if (existingSet.has(address)) {
        existingCount++;
        return;
      }

      existingSet.add(address);

      let provider = "Custom Mail";
      if (address.includes("@gmail.com")) provider = "Google";
      else if (address.includes("@outlook.com") || address.includes("@hotmail.com"))
        provider = "Microsoft Outlook";
      else if (address.includes("@proton.me") || address.includes("@protonmail.com"))
        provider = "Proton Mail";
      else if (address.includes("@yahoo.com")) provider = "Yahoo";

      newItems.push({
        id: "email-" + (now + idx),
        address,
        provider,
        label: defaultLabel,
        recoveryEmail: "",
        notes: "",
        createdAt: new Date().toISOString(),
      });
      addedCount++;
    });

    if (newItems.length > 0) {
      this.emails = [...newItems, ...this.emails];
      this._writeUserSessionCache();
      this.syncToFile();
      this.notify();
    }

    return { added: addedCount, existing: existingCount };
  }

  /**
   * updateEmail(id, emailData)
   * Memperbarui informasi akun email tertentu (edit alamat, label, catatan, recovery).
   * Otomatis menyinkronkan data pendaftaran game terkait jika alamat berubah.
   */
  updateEmail(id, emailData) {
    this.emails = this.emails.map((e) => {
      if (e.id === id) {
        return {
          ...e,
          ...emailData,
          address: emailData.address !== undefined ? emailData.address.trim().toLowerCase() : e.address,
        };
      }
      return e;
    });
    this._writeUserSessionCache();
    this.syncToFile();
    this.notify();
  }

  /**
   * deleteEmail(id)
   * Menghapus email dan seluruh pendaftaran game yang menggunakan email tersebut.
   */
  deleteEmail(id) {
    this.emails = this.emails.filter((e) => e.id !== id);
    this.registrations = this.registrations.filter((r) => r.emailId !== id);
    this._writeUserSessionCache();
    this.syncToFile();
    this.notify();
  }

  // ==========================================================================
  // HELPER UNTUK MENGHUBUNGKAN EMAIL KE GAME
  // ==========================================================================

  /**
   * addQuickRegistration(...)
   * Membantu mendaftarkan game baru jika belum ada, lalu menghubungkannya dengan email.
   */
  addQuickRegistration({
    emailId,
    gameTitle,
    status = "praregist",
    ign = "",
    notes = "",
    serverRegion = "",
  }) {
    const trimmedTitle = (gameTitle || "").trim();
    if (!trimmedTitle) throw new Error("Nama game tidak boleh kosong");

    let game = this.games.find(
      (g) => g.title.toLowerCase() === trimmedTitle.toLowerCase(),
    );

    // Jika game belum ada di database, buatkan otomatis
    if (!game) {
      game = this.addGame({
        title: trimmedTitle,
        publisher: "Game",
        platform: "PC, Mobile",
        genre: "Action RPG",
        color:
          status === "live"
            ? "#10b981"
            : status === "praregist"
              ? "#f59e0b"
              : "#ef4444",
      });
    }

    return this.addRegistration({
      emailId,
      gameId: game.id,
      status,
      ign,
      notes,
      serverRegion: serverRegion || "Global",
    });
  }

  /**
   * addEmailToGame(...)
   * Menghubungkan alamat email ke game tertentu.
   * Jika email belum terdaftar di daftar email, email akan otomatis dibuat.
   */
  addEmailToGame({
    gameId,
    emailAddress,
    status = "live",
    ign = "",
    currency = 0,
    notes = "",
  }) {
    const trimmedAddress = (emailAddress || "").trim().toLowerCase();
    if (!trimmedAddress) throw new Error("Alamat email tidak boleh kosong");

    // Cari apakah email sudah ada di inventaris email
    let email = this.emails.find((e) => e.address.toLowerCase() === trimmedAddress);

    // Jika belum ada, otomatis tambahkan ke inventaris email
    if (!email) {
      email = this.addEmail({
        address: trimmedAddress,
        label: "Personal",
      });
    }

    // Hubungkan email ke game
    return this.addRegistration({
      emailId: email.id,
      gameId,
      status,
      ign,
      currency: Number(currency) || 0,
      notes,
    });
  }

  /**
   * addQuickGame(title)
   * Menambahkan game baru secara kilat hanya berdasarkan judul.
   */
  addQuickGame(title) {
    const trimmed = (title || "").trim();
    if (!trimmed) throw new Error("Judul game tidak boleh kosong");
    const existing = this.games.find(
      (g) => g.title.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing;
    return this.addGame({
      title: trimmed,
      publisher: "Game",
      genre: "Game",
    });
  }

  // ==========================================================================
  // MANAJEMEN PENDAFTARAN / REGISTRASI (HUBUNGAN EMAIL <-> GAME)
  // ==========================================================================

  /**
   * getRegistrations()
   * Mengembalikan salinan array seluruh pendaftaran akun.
   */
  getRegistrations() {
    return [...this.registrations];
  }

  /**
   * saveRegistrations(registrations)
   * Menyimpan ulang seluruh daftar registrasi.
   */
  saveRegistrations(registrations) {
    this.registrations = [...registrations];
    this._writeUserSessionCache();
    this.syncToFile();
    this.notify();
  }

  /**
   * addRegistration(regData)
   * Menghubungkan 1 email ke 1 game.
   * Termasuk validasi PENTING: mencegah 1 email didaftarkan dua kali pada game yang sama.
   */
  addRegistration(regData) {
    // Validasi Duplikat: 1 email tidak boleh dimasukkan dua kali pada game yang sama
    const isDuplicate = this.registrations.some(
      (r) => r.emailId === regData.emailId && r.gameId === regData.gameId,
    );
    if (isDuplicate) {
      throw new Error("Email ini sudah terhubung ke game ini (duplikat tidak diizinkan)");
    }

    const newReg = {
      id: "reg-" + Date.now(),
      emailId: regData.emailId,
      gameId: regData.gameId,
      status: regData.status || "praregist", // 'live' | 'praregist' | 'maintenance'
      ign: regData.ign?.trim() || "-",
      currency: Number(regData.currency) || 0,
      serverRegion: regData.serverRegion?.trim() || "Global",
      loginMethod: regData.loginMethod?.trim() || "Direct Account",
      bindStatus: regData.bindStatus || "Bound",
      rewardClaimed: Boolean(regData.rewardClaimed),
      notes: regData.notes?.trim() || "",
      updatedAt: new Date().toISOString(),
    };
    this.registrations.unshift(newReg);
    this._writeUserSessionCache();
    this.syncToFile();
    this.notify();
    return newReg;
  }

  /**
   * updateRegistration(id, regData)
   * Memperbarui data pendaftaran (status, nickname, currency, notes).
   */
  updateRegistration(id, regData) {
    const current = this.registrations.find((r) => r.id === id);
    if (!current) return;

    const targetEmailId = regData.emailId || current.emailId;
    const targetGameId = regData.gameId || current.gameId;

    // Pastikan update ini tidak membuat duplikat dengan pendaftaran lain
    const isDuplicate = this.registrations.some(
      (r) => r.id !== id && r.emailId === targetEmailId && r.gameId === targetGameId,
    );
    if (isDuplicate) {
      throw new Error("Email ini sudah terhubung ke game ini");
    }

    this.registrations = this.registrations.map((r) => {
      if (r.id === id) {
        return {
          ...r,
          ...regData,
          currency: regData.currency !== undefined ? Number(regData.currency) || 0 : (Number(r.currency) || 0),
          updatedAt: new Date().toISOString(),
        };
      }
      return r;
    });
    this._writeUserSessionCache();
    this.syncToFile();
    this.notify();
  }

  /**
   * updateStatus(id, newStatus)
   * Shortcut untuk mengganti status akun dengan cepat (live / praregist / maintenance).
   */
  updateStatus(id, newStatus) {
    this.updateRegistration(id, { status: newStatus });
  }

  /**
   * deleteRegistration(id)
   * Melepas hubungan pendaftaran akun tanpa menghapus email dan game master.
   */
  deleteRegistration(id) {
    this.registrations = this.registrations.filter((r) => r.id !== id);
    this._writeUserSessionCache();
    this.syncToFile();
    this.notify();
  }

  // ==========================================================================
  // DATA RELASIONAL GABUNGAN (ENRICHED DATA - MIRIP SQL JOIN)
  // ==========================================================================

  /**
   * getEnrichedRegistrations()
   * --------------------------
   * Menggabungkan data pendaftaran dengan objek Game lengkap dan objek Email lengkap.
   * Analogi: Ini seperti `JOIN games ON registrations.gameId = games.id`
   * Menggunakan Map untuk performa pencarian instan O(1).
   */
  getEnrichedRegistrations() {
    const gamesMap = new Map(this.games.map((g) => [g.id, g]));
    const emailsMap = new Map(this.emails.map((e) => [e.id, e]));

    return this.registrations.map((reg) => {
      // Ambil objek game asli atau buat fallback jika game terhapus
      const game = gamesMap.get(reg.gameId) || {
        id: reg.gameId,
        title: "Unknown Game",
        publisher: "Unknown",
        genre: "Game",
        color: "#6b7280",
        badgeIcon: "gamepad-2",
        currencyIcon: "🪙",
        currencyRateIdr: 0,
        currencyRateUnit: 1000,
      };

      // Ambil objek email asli atau buat fallback jika email terhapus
      const email = emailsMap.get(reg.emailId) || {
        id: reg.emailId,
        address: "deleted_email@unknown.com",
        label: "Unknown",
        provider: "Unknown",
      };

      return {
        ...reg,
        game,
        email,
      };
    });
  }

  // ==========================================================================
  // RINGKASAN & STATISTIK APLIKASI
  // ==========================================================================

  /**
   * getStats()
   * Menghitung total game, email, akun, dan status pendaftaran.
   */
  getStats() {
    const liveCount = this.registrations.filter((r) => r.status === "live").length;
    const praregistCount = this.registrations.filter((r) => r.status === "praregist").length;
    const maintenanceCount = this.registrations.filter(
      (r) => r.status === "maintenance",
    ).length;
    const droppedCount = this.registrations.filter((r) => r.status === "dropped").length;

    return {
      totalGames: this.games.length,
      totalEmails: this.emails.length,
      totalRegistrations: this.registrations.length,
      liveCount,
      praregistCount,
      maintenanceCount,
      droppedCount,
    };
  }

  /**
   * getSyncInfo()
   * Mengembalikan status sinkronisasi dan mode penyimpanan Cloud Database (Upstash Redis).
   */
  getSyncInfo() {
    return {
      isConnected: this.isServerConnected,
      storageMode: "cloud",
      lastSyncedAt: this.lastSyncedAt,
      storageTarget: "Cloud Database (Upstash Redis)",
    };
  }

  // ==========================================================================
  // EKSPOR & IMPOR DATA (BACKUP / RESTORE)
  // ==========================================================================

  /**
   * exportJSON()
   * Men-download seluruh database dalam bentuk file JSON ke komputer pengguna.
   */
  exportJSON() {
    const data = {
      exportDate: new Date().toISOString(),
      appName: "GameMail Hub",
      version: "1.0",
      games: this.games,
      emails: this.emails,
      registrations: this.registrations,
    };
    const jsonStr = JSON.stringify(data, null, 2);
    // Buat file virtual di memori menggunakan Blob
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gamemail-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url); // Bersihkan memori objek URL
  }

  /**
   * exportCSV()
   * Men-download riwayat pendaftaran dalam format CSV (bisa dibuka di Microsoft Excel).
   */
  exportCSV() {
    const list = this.getEnrichedRegistrations();
    const headers = [
      "Game Title",
      "Publisher",
      "Email Address",
      "Email Label",
      "Status",
      "IGN / Nickname",
      "Server/Region",
      "Login Method",
      "Reward Claimed",
      "Notes",
      "Last Updated",
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = list.map((item) => [
      item.game.title,
      item.game.publisher,
      item.email.address,
      item.email.label,
      item.status.toUpperCase(),
      item.ign,
      item.serverRegion,
      item.loginMethod,
      item.rewardClaimed ? "YES" : "NO",
      item.notes,
      new Date(item.updatedAt).toLocaleDateString(),
    ]);

    // Karakter BOM \uFEFF penting agar Excel membaca encoding UTF-8 dengan benar
    const csvContent =
      "\uFEFF" +
      [
        headers.map(escapeCsv).join(","),
        ...rows.map((r) => r.map(escapeCsv).join(",")),
      ].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gamemail-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * importJSON(jsonString)
   * Mengimpor data cadangan JSON yang diunggah pengguna.
   */
  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (
        !Array.isArray(parsed.games) ||
        !Array.isArray(parsed.emails) ||
        !Array.isArray(parsed.registrations)
      ) {
        throw new Error(
          "Format JSON tidak valid. Harus mengandung array games, emails, dan registrations.",
        );
      }
      this.games = parsed.games;
      this.emails = parsed.emails;
      this.registrations = parsed.registrations;
      this._writeUserSessionCache();
      this.syncToFile();
      this.notify();
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  /**
   * resetToDefault()
   * Mengembalikan semua data ke pengaturan awal (DEFAULT_GAMES, DEFAULT_EMAILS).
   */
  resetToDefault() {
    this.games = JSON.parse(JSON.stringify(DEFAULT_GAMES));
    this.emails = JSON.parse(JSON.stringify(DEFAULT_EMAILS));
    this.registrations = JSON.parse(JSON.stringify(DEFAULT_REGISTRATIONS));
    this._writeUserSessionCache();
    this.syncToFile();
    this.notify();
  }

  /**
   * clearAll()
   * Mengosongkan seluruh data aplikasi.
   */
  clearAll() {
    this.games = [];
    this.emails = [];
    this.registrations = [];
    this._writeUserSessionCache();
    this.syncToFile();
    this.notify();
  }
}

// Export single instance (Pola Singleton)
// Diimpor oleh file lain dengan cara: import { store } from "./data/store.js";
export const store = new Store();
