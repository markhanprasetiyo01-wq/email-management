// ============================================================================
// MODUL RENDER STATISTIK & RINGKASAN (src/ui/renderStats.js)
// ============================================================================
// Modul ini bertugas menampilkan grafik dan ringkasan visual performa akun:
// 1. Progress Bar Distribusi Status Akun (persentase Live, Praregistrasi, dan Maintenance).
// 2. Grafik Distribusi Beban Akun per Email (berapa banyak game yang ditanggung tiap email).
// 3. Kartu Tips & Best Practice Manajemen Keamanan Akun Game.

import { store } from "../data/store.js";

/**
 * renderStats(container)
 * ----------------------
 * Merender halaman statistik dan visualisasi ke dalam elemen container DOM.
 * 
 * @param {HTMLElement} container - Elemen DOM wadah tempat tampilan akan disisipkan
 */
export function renderStats(container) {
  // 1. Ambil data ringkasan dari store
  const stats = store.getStats();
  const allRegistrations = store.getEnrichedRegistrations();
  const emails = store.getEmails();
  const games = store.getGames();

  // 2. Hitung persentase masing-masing status
  const total = stats.totalRegistrations || 1; // Hindari pembagian dengan nol (division by zero)
  const livePct = Math.round((stats.liveCount / total) * 100);
  const praregPct = Math.round((stats.praregistCount / total) * 100);
  const maintPct = Math.round((stats.maintenanceCount / total) * 100);

  // 3. Hitung distribusi beban game pada setiap alamat email dan urutkan dari terbanyak
  const emailCounts = emails
    .map((e) => ({
      address: e.address,
      label: e.label,
      count: allRegistrations.filter((r) => r.emailId === e.id).length,
    }))
    .sort((a, b) => b.count - a.count);

  // 4. Susun template HTML halaman statistik
  container.innerHTML = `
    <!-- Header Bagian Statistik -->
    <div style="margin-bottom:1.5rem;">
      <h2 style="font-family:var(--font-heading); font-size:1.4rem; color:#fff;">Statistik & Ringkasan Akun</h2>
      <p style="font-size:0.85rem; color:var(--text-muted);">Visualisasi persebaran status game, inventaris email, dan keaktifan akun.</p>
    </div>

    <!-- Progress Bar: Distribusi Status Akun Game -->
    <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); padding:1.5rem; margin-bottom:1.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
        <h3 style="font-family:var(--font-heading); font-size:1.05rem; color:#fff;">Distribusi Status Akun Game</h3>
        <span style="font-size:0.8rem; color:var(--text-dim);">Total: ${stats.totalRegistrations} Akun</span>
      </div>

      <!-- Bilah Warna Bertumpuk (Segmented Bar) -->
      <div style="height:14px; border-radius:var(--radius-pill); background:var(--bg-surface-elevated); display:flex; overflow:hidden; gap:2px;">
        <div style="width:${livePct}%; background:var(--status-live); transition:width 0.4s ease;" title="Live: ${livePct}%"></div>
        <div style="width:${praregPct}%; background:var(--status-praregist); transition:width 0.4s ease;" title="Praregist: ${praregPct}%"></div>
        <div style="width:${maintPct}%; background:var(--status-maint); transition:width 0.4s ease;" title="Maintenance: ${maintPct}%"></div>
      </div>

      <!-- Keterangan Legenda Warna -->
      <div style="display:flex; gap:1.5rem; margin-top:1rem; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.82rem;">
          <span style="width:10px; height:10px; border-radius:50%; background:var(--status-live);"></span>
          <span>Live: <strong style="color:#fff;">${stats.liveCount}</strong> (${livePct}%)</span>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.82rem;">
          <span style="width:10px; height:10px; border-radius:50%; background:var(--status-praregist);"></span>
          <span>Pra-Registrasi: <strong style="color:#fff;">${stats.praregistCount}</strong> (${praregPct}%)</span>
        </div>
        <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.82rem;">
          <span style="width:10px; height:10px; border-radius:50%; background:var(--status-maint);"></span>
          <span>Maintenance: <strong style="color:#fff;">${stats.maintenanceCount}</strong> (${maintPct}%)</span>
        </div>
      </div>
    </div>

    <!-- Grid Distribusi Beban Email & Tips Keamanan -->
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.25rem;">
      <!-- Kolom Kiri: Beban Akun per Email -->
      <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); padding:1.25rem;">
        <h3 style="font-family:var(--font-heading); font-size:1.05rem; color:#fff; margin-bottom:1rem;">Beban Akun per Email</h3>
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
          ${emailCounts
            .map((ec) => {
              const pct = Math.round((ec.count / total) * 100);
              return `
              <div>
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.25rem;">
                  <span style="font-family:var(--font-mono); color:#93c5fd;">${ec.address}</span>
                  <span style="color:#fff; font-weight:600;">${ec.count} game (${pct}%)</span>
                </div>
                <div style="height:6px; border-radius:3px; background:var(--bg-surface-elevated); overflow:hidden;">
                  <div style="width:${pct}%; height:100%; background:var(--accent-primary); border-radius:3px;"></div>
                </div>
              </div>
            `;
            })
            .join("")}
        </div>
      </div>

      <!-- Kolom Kanan: Tips Manajemen & Keamanan Akun -->
      <div style="background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-lg); padding:1.25rem; display:flex; flex-direction:column; gap:0.75rem;">
        <h3 style="font-family:var(--font-heading); font-size:1.05rem; color:#fff;">💡 Tips Manajemen Akun Game</h3>
        <ul style="font-size:0.82rem; color:var(--text-muted); line-height:1.6; padding-left:1.2rem; display:flex; flex-direction:column; gap:0.5rem;">
          <li><strong>Masa Pra-registrasi:</strong> Catat email pendaftaran dan simpan tanggal rilis agar Anda tidak melewatkan hadiah milestone pre-reg di inbox.</li>
          <li><strong>Keamanan Privasi:</strong> Hindari menyimpan password teks biasa di notes. Gunakan metode login seperti <em>Google Sign-In</em> atau password manager terpisah.</li>
          <li><strong>Reroll / Multi-Akun:</strong> Pisahkan email utama (untuk transaksi) dengan email khusus reroll/alt untuk memudahkan transfer akun.</li>
          <li><strong>Backup Rutin:</strong> Gunakan menu <em>Backup Data</em> untuk mengekspor file JSON/CSV ke drive pribadi Anda secara teratur.</li>
        </ul>
      </div>
    </div>
  `;
}
