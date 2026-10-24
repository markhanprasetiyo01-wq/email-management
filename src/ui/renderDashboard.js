// ============================================================================
// MODUL DASHBOARD & MULTI-VIEW (src/ui/renderDashboard.js)
// ============================================================================
// File ini mengelola antarmuka Dashboard interaktif dengan 3 Mode Tampilan:
// 1. GRID VIEW (Tampilan Kartu Akun): Menampilkan kartu akun game dengan glow warna.
// 2. KANBAN BOARD (Papan Drag & Drop): Memungkinkan memindahkan kartu antar kolom status
//    (Pra-registrasi -> Live -> Maintenance) menggunakan HTML5 Drag and Drop API.
// 3. TABLE VIEW (Tampilan Tabel Detail): Tampilan spreadsheet ringkas untuk data banyak.
//
// FITUR PENDUKUNG:
// - Banner peringatan server maintenance aktif.
// - Filter instan berdasarkan email dan status akun.
// - Pencarian real-time (nama game, email, nickname/IGN, server, catatan).

import { store } from "../data/store.js";
import { openRegistrationModal, openConfirmModal } from "./modals.js";
import { showToast } from "./toast.js";

// ============================================================================
// STATE LOKAL DASHBOARD
// ============================================================================
let currentViewMode = "grid"; // 'grid' | 'kanban' | 'table'
let currentSearch = "";
let currentStatusFilter = "all"; // 'all' | 'live' | 'praregist' | 'maintenance'
let currentEmailFilter = "all";

/**
 * initDashboardState()
 * --------------------
 * Mereset filter dashboard ke kondisi awal (default).
 */
export function initDashboardState() {
  currentSearch = "";
  currentStatusFilter = "all";
  currentEmailFilter = "all";
}

/**
 * renderDashboard(container)
 * --------------------------
 * Merender seluruh komponen dashboard (Statistik atas, banner, kontrol filter,
 * dan area konten view sesuai mode yang aktif).
 * 
 * @param {HTMLElement} container - Wadah elemen DOM tempat dashboard ditampilkan
 */
export function renderDashboard(container) {
  const stats = store.getStats();
  const allRegistrations = store.getEnrichedRegistrations();
  const emails = store.getEmails();

  // Cari akun yang saat ini sedang mengalami server maintenance untuk banner peringatan
  const maintAccounts = allRegistrations.filter(
    (r) => r.status === "maintenance",
  );

  // Buat banner peringatan jika ada server game yang maintenance
  let maintenanceBannerHtml = "";
  if (maintAccounts.length > 0) {
    const listNames = maintAccounts
      .map((m) => `<strong>${m.game.title}</strong> (${m.ign})`)
      .join(", ");
    maintenanceBannerHtml = `
      <div class="maintenance-banner">
        <div class="maint-content">
          <span class="maint-icon" style="font-size:1.25rem;">⚠️</span>
          <div class="maint-text">
            <span>Server Maintenance Aktif:</span> ${listNames}
          </div>
        </div>
        <button class="btn btn-sm btn-secondary" id="btn-filter-maint">Lihat Detail Maintenance</button>
      </div>
    `;
  }

  // Template HTML Struktur Utama Dashboard
  container.innerHTML = `
    <!-- Kartu Statistik Utama Bagian Atas -->
    <div class="stats-grid">
      <div class="stat-card" style="--stat-accent: #6366f1; --stat-bg: rgba(99,102,241,0.12);">
        <div class="stat-icon-wrapper">🎮</div>
        <div class="stat-info">
          <div class="stat-value">${stats.totalRegistrations}</div>
          <div class="stat-label">Total Akun Terhubung</div>
        </div>
      </div>

      <div class="stat-card" style="--stat-accent: #10b981; --stat-bg: rgba(16,185,129,0.12);">
        <div class="stat-icon-wrapper">🟢</div>
        <div class="stat-info">
          <div class="stat-value">${stats.liveCount}</div>
          <div class="stat-label">Game Live / Aktif</div>
        </div>
      </div>

      <div class="stat-card" style="--stat-accent: #f59e0b; --stat-bg: rgba(245,158,11,0.12);">
        <div class="stat-icon-wrapper">🟡</div>
        <div class="stat-info">
          <div class="stat-value">${stats.praregistCount}</div>
          <div class="stat-label">Pra-Registrasi</div>
        </div>
      </div>

      <div class="stat-card" style="--stat-accent: #ef4444; --stat-bg: rgba(239,68,68,0.12);">
        <div class="stat-icon-wrapper">🔴</div>
        <div class="stat-info">
          <div class="stat-value">${stats.maintenanceCount}</div>
          <div class="stat-label">Maintenance</div>
        </div>
      </div>
    </div>

    <!-- Banner Peringatan Maintenance (Jika Ada) -->
    ${maintenanceBannerHtml}

    <!-- Baris Kontrol: Input Pencarian, Filter Email, Filter Status, dan Toggle Tampilan -->
    <div class="control-bar">
      <!-- Kotak Pencarian -->
      <div class="search-box">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" class="search-input" id="search-accounts" placeholder="Cari game, email, nickname, atau UID..." value="${currentSearch}">
      </div>

      <div class="filter-controls">
        <!-- Filter Dropdown Berdasarkan Email -->
        <select class="filter-select" id="filter-email-select">
          <option value="all">Semua Email (${emails.length})</option>
          ${emails.map((e) => `<option value="${e.id}" ${e.id === currentEmailFilter ? "selected" : ""}>${e.address} (${e.label})</option>`).join("")}
        </select>

        <!-- Tombol Pil (Pills) Filter Status -->
        <div class="status-filter-pills">
          <button class="status-pill-btn ${currentStatusFilter === "all" ? "active" : ""}" data-status="all">Semua (${allRegistrations.length})</button>
          <button class="status-pill-btn ${currentStatusFilter === "live" ? "active" : ""}" data-status="live">🟢 Live (${stats.liveCount})</button>
          <button class="status-pill-btn ${currentStatusFilter === "praregist" ? "active" : ""}" data-status="praregist">🟡 Praregist (${stats.praregistCount})</button>
          <button class="status-pill-btn ${currentStatusFilter === "maintenance" ? "active" : ""}" data-status="maintenance">🔴 Maint (${stats.maintenanceCount})</button>
        </div>

        <!-- Tombol Toggle Mode Tampilan (Grid, Kanban, Table) -->
        <div class="view-mode-toggle">
          <button class="view-btn ${currentViewMode === "grid" ? "active" : ""}" id="view-mode-grid" title="Tampilan Kartu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          </button>
          <button class="view-btn ${currentViewMode === "kanban" ? "active" : ""}" id="view-mode-kanban" title="Kanban Board Status">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="5" height="18" rx="1"></rect><rect x="10" y="3" width="5" height="18" rx="1"></rect><rect x="17" y="3" width="5" height="18" rx="1"></rect></svg>
          </button>
          <button class="view-btn ${currentViewMode === "table" ? "active" : ""}" id="view-mode-table" title="Tampilan Tabel">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Area Konten Utama Tampilan yang Dapat Berubah Dinamis -->
    <div id="dashboard-view-content"></div>
  `;

  // ==========================================================================
  // EVENT LISTENERS FILTER & INTERAKSI
  // ==========================================================================

  // 1. Pencarian Teks
  const searchInput = container.querySelector("#search-accounts");
  searchInput.addEventListener("input", (e) => {
    currentSearch = e.target.value;
    renderContentOnly(); // Render hanya bagian konten agar input tidak kehilangan fokus
  });

  // 2. Filter Email
  const emailSelect = container.querySelector("#filter-email-select");
  emailSelect.addEventListener("change", (e) => {
    currentEmailFilter = e.target.value;
    renderContentOnly();
  });

  // 3. Tombol Pil Status
  container.querySelectorAll(".status-pill-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      container
        .querySelectorAll(".status-pill-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      currentStatusFilter = btn.dataset.status;
      renderContentOnly();
    });
  });

  // 4. Tombol Pengubah Mode Tampilan (Grid / Kanban / Table)
  container.querySelector("#view-mode-grid").onclick = () => {
    currentViewMode = "grid";
    renderDashboard(container);
  };
  container.querySelector("#view-mode-kanban").onclick = () => {
    currentViewMode = "kanban";
    renderDashboard(container);
  };
  container.querySelector("#view-mode-table").onclick = () => {
    currentViewMode = "table";
    renderDashboard(container);
  };

  // 5. Tombol Lihat Detail pada Banner Maintenance
  if (maintAccounts.length > 0) {
    const btnFilterMaint = container.querySelector("#btn-filter-maint");
    if (btnFilterMaint) {
      btnFilterMaint.onclick = () => {
        currentStatusFilter = "maintenance";
        renderDashboard(container);
      };
    }
  }

  /**
   * renderContentOnly()
   * -------------------
   * Fungsi pembantu untuk merender ulang hanya area `#dashboard-view-content`.
   * Ini jauh lebih cepat daripada merender ulang seluruh halaman dashboard.
   */
  function renderContentOnly() {
    const contentEl = container.querySelector("#dashboard-view-content");
    if (!contentEl) return;

    // Filter data registrasi berdasarkan filter yang sedang aktif
    const filteredItems = store.getEnrichedRegistrations().filter((r) => {
      if (currentStatusFilter !== "all" && r.status !== currentStatusFilter)
        return false;
      if (currentEmailFilter !== "all" && r.emailId !== currentEmailFilter)
        return false;
      if (currentSearch.trim()) {
        const q = currentSearch.toLowerCase().trim();
        return (
          r.game.title.toLowerCase().includes(q) ||
          r.game.publisher.toLowerCase().includes(q) ||
          r.email.address.toLowerCase().includes(q) ||
          r.email.label.toLowerCase().includes(q) ||
          r.ign.toLowerCase().includes(q) ||
          r.serverRegion.toLowerCase().includes(q) ||
          (r.notes || "").toLowerCase().includes(q)
        );
      }
      return true;
    });

    // Jika tidak ada data yang cocok dengan kriteria filter
    if (filteredItems.length === 0) {
      contentEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎮</div>
          <h3 class="empty-title">Tidak Ada Akun Ditemukan</h3>
          <p class="empty-desc">Tidak ada pendaftaran game yang cocok dengan filter atau pencarian Anda saat ini.</p>
          <button class="btn btn-primary btn-sm" id="btn-empty-add-reg">+ Hubungkan Game ke Email</button>
        </div>
      `;
      contentEl
        .querySelector("#btn-empty-add-reg")
        ?.addEventListener("click", () => openRegistrationModal());
      return;
    }

    // Render sesuai mode tampilan yang dipilih user
    if (currentViewMode === "grid") {
      contentEl.innerHTML = renderCardsGrid(filteredItems);
    } else if (currentViewMode === "kanban") {
      contentEl.innerHTML = renderKanbanBoard(filteredItems);
      setupKanbanDragDrop(contentEl); // Pasang interaksi drag and drop
    } else if (currentViewMode === "table") {
      contentEl.innerHTML = renderDetailTable(filteredItems);
    }

    // Pasang listener untuk tombol-tombol aksi pada kartu
    attachCardActions(contentEl);
  }

  // Panggil pertama kali saat dashboard dimuat
  renderContentOnly();
}

/**
 * renderCardsGrid(items)
 * ----------------------
 * Menghasilkan HTML untuk Tampilan Grid Kartu Akun.
 */
function renderCardsGrid(items) {
  return `
    <div class="cards-grid">
      ${items
        .map((item) => {
          const statusClass = item.status;
          const statusLabel =
            item.status === "live"
              ? "Live"
              : item.status === "praregist"
                ? "Praregist"
                : item.status === "maintenance"
                  ? "Maintenance"
                  : "Dropped";
          const gameColor = item.game.color || "#6366f1";

          return `
          <div class="game-account-card" style="--card-glow: ${gameColor};" data-reg-id="${item.id}">
            <div class="card-top-row">
              <div class="game-identity">
                <div class="game-avatar-badge" style="background:${gameColor};">
                  ${item.game.title.slice(0, 2).toUpperCase()}
                </div>
                <div class="game-titles">
                  <div class="game-main-title">${item.game.title}</div>
                </div>
              </div>
              <div class="status-badge ${statusClass}">
                <span class="status-dot"></span>
                <span>${statusLabel}</span>
              </div>
            </div>

            <div class="card-account-box">
              <div class="account-meta-row">
                <span class="account-email-pill" title="${item.email.address}">
                  ✉️ ${item.email.address}
                </span>
                <span class="account-label-tag">${item.email.label}</span>
              </div>

              <div class="account-ign-row">
                <div class="ign-display">
                  <span class="ign-label">IGN:</span>
                  <span class="ign-value">${item.ign || "-"}</span>
                </div>
                <span class="server-badge">${item.serverRegion}</span>
              </div>
            </div>

            ${item.notes ? `<div class="card-notes" title="${item.notes}">📝 ${item.notes}</div>` : ""}

            <div class="card-footer">
              <div class="card-status-changer">
                <span style="font-size:0.7rem; color:var(--text-dim); margin-right:0.2rem;">Status:</span>
                <button class="status-switch-btn ${item.status === "live" ? "active" : ""}" data-action="set-status" data-id="${item.id}" data-target-status="live" title="Ubah ke Live">🟢 Live</button>
                <button class="status-switch-btn ${item.status === "praregist" ? "active" : ""}" data-action="set-status" data-id="${item.id}" data-target-status="praregist" title="Ubah ke Praregist">🟡 Prareg</button>
                <button class="status-switch-btn ${item.status === "maintenance" ? "active" : ""}" data-action="set-status" data-id="${item.id}" data-target-status="maintenance" title="Ubah ke Maintenance">🔴 Maint</button>
              </div>

              <div style="display:flex; gap:0.35rem;">
                <button class="btn btn-secondary btn-sm btn-icon-only" data-action="edit-reg" data-id="${item.id}" title="Edit Data Akun">✏️</button>
                <button class="btn btn-danger btn-sm btn-icon-only" data-action="delete-reg" data-id="${item.id}" title="Hapus dari Email">🗑️</button>
              </div>
            </div>
          </div>
        `;
        })
        .join("")}
    </div>
  `;
}

/**
 * renderKanbanBoard(items)
 * ------------------------
 * Menghasilkan HTML untuk Papan Kanban (Kolom Praregistrasi, Kolom Live, Kolom Maintenance).
 */
function renderKanbanBoard(items) {
  const praregistList = items.filter((i) => i.status === "praregist");
  const liveList = items.filter((i) => i.status === "live");
  const maintList = items.filter((i) => i.status === "maintenance");

  // Kartu individual kanban yang dapat digeser (draggable="true")
  const renderKanbanCard = (item) => `
    <div class="kanban-item-card" draggable="true" data-reg-id="${item.id}">
      <div class="kanban-item-header">
        <span class="kanban-game-title">${item.game.title}</span>
        <span class="server-badge">${item.serverRegion}</span>
      </div>
      <div style="font-size:0.78rem; color:#93c5fd; font-family:var(--font-mono); overflow:hidden; text-overflow:ellipsis;">
        ✉️ ${item.email.address}
      </div>
      <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.8rem;">
        <span style="color:var(--text-dim);">IGN: <strong style="color:#fff;">${item.ign}</strong></span>
        <span style="font-size:0.7rem; color:var(--text-muted);">${item.loginMethod}</span>
      </div>
      ${item.notes ? `<div style="font-size:0.72rem; color:var(--text-muted); background:rgba(0,0,0,0.25); padding:0.35rem 0.5rem; border-radius:4px; font-style:italic;">${item.notes}</div>` : ""}
      <div style="display:flex; justify-content:flex-end; gap:0.3rem; margin-top:0.3rem; border-top:1px solid var(--border-subtle); padding-top:0.4rem;">
        <button class="btn btn-ghost btn-sm" style="padding:0.2rem 0.4rem; font-size:0.7rem;" data-action="edit-reg" data-id="${item.id}">Edit</button>
      </div>
    </div>
  `;

  return `
    <div class="kanban-board">
      <!-- Kolom 1: Pra-Registrasi -->
      <div class="kanban-column" data-status-col="praregist">
        <div class="kanban-column-header">
          <div class="kanban-col-title" style="color:var(--status-praregist);">
            <span>🟡 Pra-Registrasi</span>
            <span class="kanban-count-pill" style="background:var(--status-praregist-bg); color:var(--status-praregist);">${praregistList.length}</span>
          </div>
        </div>
        <div class="kanban-cards-list" data-status-drop="praregist">
          ${praregistList.length > 0 ? praregistList.map(renderKanbanCard).join("") : '<div style="text-align:center; padding:2rem; color:var(--text-dim); font-size:0.8rem;">Tidak ada akun praregistrasi</div>'}
        </div>
      </div>

      <!-- Kolom 2: Live / Aktif -->
      <div class="kanban-column" data-status-col="live">
        <div class="kanban-column-header">
          <div class="kanban-col-title" style="color:var(--status-live);">
            <span>🟢 Live / Aktif</span>
            <span class="kanban-count-pill" style="background:var(--status-live-bg); color:var(--status-live);">${liveList.length}</span>
          </div>
        </div>
        <div class="kanban-cards-list" data-status-drop="live">
          ${liveList.length > 0 ? liveList.map(renderKanbanCard).join("") : '<div style="text-align:center; padding:2rem; color:var(--text-dim); font-size:0.8rem;">Tidak ada game aktif</div>'}
        </div>
      </div>

      <!-- Kolom 3: Maintenance -->
      <div class="kanban-column" data-status-col="maintenance">
        <div class="kanban-column-header">
          <div class="kanban-col-title" style="color:var(--status-maint);">
            <span>🔴 Maintenance</span>
            <span class="kanban-count-pill" style="background:var(--status-maint-bg); color:var(--status-maint);">${maintList.length}</span>
          </div>
        </div>
        <div class="kanban-cards-list" data-status-drop="maintenance">
          ${maintList.length > 0 ? maintList.map(renderKanbanCard).join("") : '<div style="text-align:center; padding:2rem; color:var(--text-dim); font-size:0.8rem;">Semua server normal</div>'}
        </div>
      </div>
    </div>
  `;
}

/**
 * renderDetailTable(items)
 * ------------------------
 * Menghasilkan HTML untuk Tampilan Tabel Detail (mirip spreadsheet).
 */
function renderDetailTable(items) {
  return `
    <div class="table-container">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Game</th>
            <th>Email Terdaftar</th>
            <th>Status</th>
            <th>IGN / Akun</th>
            <th>Server / Login</th>
            <th>Reward Prareg</th>
            <th>Catatan</th>
            <th style="text-align:right;">Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
            <tr>
              <td>
                <div style="font-weight:700; color:#fff;">${item.game.title}</div>
              </td>
              <td>
                <div style="font-family:var(--font-mono); color:#93c5fd; font-size:0.8rem;">${item.email.address}</div>
                <div style="font-size:0.7rem; color:var(--text-dim);">${item.email.label}</div>
              </td>
              <td>
                <select class="form-select" data-action="table-status-select" data-id="${item.id}" style="padding:0.25rem 0.5rem; font-size:0.75rem;">
                  <option value="praregist" ${item.status === "praregist" ? "selected" : ""}>🟡 Praregist</option>
                  <option value="live" ${item.status === "live" ? "selected" : ""}>🟢 Live</option>
                  <option value="maintenance" ${item.status === "maintenance" ? "selected" : ""}>🔴 Maintenance</option>
                  <option value="dropped" ${item.status === "dropped" ? "selected" : ""}>⚪ Dropped</option>
                </select>
              </td>
              <td>
                <strong style="color:#fff;">${item.ign}</strong>
              </td>
              <td>
                <div>${item.serverRegion}</div>
                <div style="font-size:0.72rem; color:var(--text-dim);">${item.loginMethod}</div>
              </td>
              <td>
                ${item.rewardClaimed ? '<span style="color:var(--status-live); font-weight:600;">✓ Diklaim</span>' : '<span style="color:var(--text-dim);">Belum</span>'}
              </td>
              <td style="max-width:200px; font-size:0.78rem; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${item.notes || "-"}
              </td>
              <td style="text-align:right;">
                <div style="display:inline-flex; gap:0.35rem;">
                  <button class="btn btn-secondary btn-sm" data-action="edit-reg" data-id="${item.id}">Edit</button>
                  <button class="btn btn-danger btn-sm" data-action="delete-reg" data-id="${item.id}">Hapus</button>
                </div>
              </td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * setupKanbanDragDrop(container)
 * ------------------------------
 * Mengatur interaktivitas Drag and Drop native HTML5 pada papan Kanban.
 * Memungkinkan memindahkan kartu antar kolom status hanya dengan menggesernya.
 */
function setupKanbanDragDrop(container) {
  let draggedId = null;

  // Pasang event dragstart & dragend pada setiap kartu
  container.querySelectorAll(".kanban-item-card").forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      draggedId = card.dataset.regId;
      card.classList.add("dragging");
      e.dataTransfer.setData("text/plain", draggedId);
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      draggedId = null;
    });
  });

  // Pasang event dragover, dragleave, & drop pada kolom penampung
  container.querySelectorAll(".kanban-cards-list").forEach((col) => {
    col.addEventListener("dragover", (e) => {
      e.preventDefault(); // Diperlukan agar event drop bisa terjadi
      col.style.background = "rgba(255,255,255,0.03)";
    });

    col.addEventListener("dragleave", () => {
      col.style.background = "";
    });

    col.addEventListener("drop", (e) => {
      e.preventDefault();
      col.style.background = "";
      const targetStatus = col.dataset.statusDrop;
      if (draggedId && targetStatus) {
        // Update status akun di store
        store.updateStatus(draggedId, targetStatus);
        showToast(`Status dipindahkan ke ${targetStatus.toUpperCase()}`);
      }
    });
  });
}

/**
 * attachCardActions(container)
 * ----------------------------
 * Menghubungkan seluruh tombol aksi (switch status cepat, edit, delete)
 * yang berada di dalam kartu akun maupun baris tabel.
 */
function attachCardActions(container) {
  // 1. Penggantian status instan pada tombol status changer
  container.querySelectorAll('[data-action="set-status"]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const targetStatus = btn.dataset.targetStatus;
      store.updateStatus(id, targetStatus);
      showToast(`Status game diubah menjadi ${targetStatus.toUpperCase()}`);
    };
  });

  // 2. Penggantian status via dropdown tabel
  container
    .querySelectorAll('[data-action="table-status-select"]')
    .forEach((select) => {
      select.onchange = () => {
        const id = select.dataset.id;
        store.updateStatus(id, select.value);
        showToast(`Status diperbarui ke ${select.value.toUpperCase()}`);
      };
    });

  // 3. Tombol Edit Pendaftaran Akun
  container.querySelectorAll('[data-action="edit-reg"]').forEach((btn) => {
    btn.onclick = () => {
      openRegistrationModal(btn.dataset.id);
    };
  });

  // 4. Tombol Hapus Pendaftaran Akun
  container.querySelectorAll('[data-action="delete-reg"]').forEach((btn) => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      openConfirmModal(
        "Hapus Hubungan Game & Email",
        "Apakah Anda yakin ingin menghapus data akun game ini dari email yang terdaftar? Data email & game utama tetap aman.",
        () => {
          store.deleteRegistration(id);
          showToast("Data pendaftaran berhasil dihapus");
        },
      );
    };
  });
}
