// ============================================================================
// MODUL NOTIFIKASI TOAST (src/ui/toast.js)
// ============================================================================
// File ini bertugas memunculkan pesan feedback singkat (toast popup) di layar,
// misalnya: "Game berhasil disimpan", "Status diubah", atau pesan error.
// Toast ini akan otomatis menghilang sendiri setelah beberapa detik.

// Variabel penampung elemen wadah (container) toast di DOM.
// Nilainya null sebelum fungsi getToastContainer pertama kali dipanggil (Lazy Initialization).
let toastContainer = null;

/**
 * getToastContainer()
 * -------------------
 * Fungsi pembantu (helper) dengan pola Singleton:
 * Memastikan elemen <div class="toast-container"> hanya dibuat 1 kali saja di dalam <body>.
 * Jika sudah ada, langsung kembalikan elemen tersebut.
 *
 * @returns {HTMLDivElement} Wadah tempat seluruh toast bertumpuk
 */
function getToastContainer() {
  if (!toastContainer) {
    // 1. Buat elemen div baru
    toastContainer = document.createElement("div");
    // 2. Beri class CSS agar posisinya berada di pojok layar (fixed position)
    toastContainer.className = "toast-container";
    // 3. Masukkan ke dalam body halaman HTML
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

// Ikon SVG tajam untuk notifikasi toast (SaaS modern standard)
const TOAST_ICONS = {
  success: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  error: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  info: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
};

/**
 * showToast(message, type)
 * ------------------------
 * Menampilkan pesan toast baru di layar pengguna.
 *
 * @param {string} message - Pesan yang ingin ditampilkan ke pengguna
 * @param {"success" | "error" | "info"} type - Tipe notifikasi (default: "success")
 */
export function showToast(message, type = "success") {
  // 1. Dapatkan wadah toast
  const container = getToastContainer();

  // 2. Buat elemen item toast
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const iconSvg = TOAST_ICONS[type] || TOAST_ICONS.success;

  // Masukkan konten HTML rapi: Ikon bulat + teks pesan
  toast.innerHTML = `
    <span class="toast-icon-box toast-icon-${type}">${iconSvg}</span>
    <span class="toast-message">${message}</span>
  `;

  // 3. Tempelkan toast ke dalam kontainer
  container.appendChild(toast);

  // 4. Timer animasi keluar dan penghapusan otomatis
  setTimeout(() => {
    toast.classList.add("toast-leaving");
    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 2600);
}
