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

/**
 * showToast(message, type)
 * ------------------------
 * Menampilkan pesan toast baru di layar pengguna.
 *
 * ALUR KERJA:
 * 1. Ambil kontainer toast.
 * 2. Buat elemen div untuk toast baru dengan ikon sesuai tipe ('success', 'error', 'info').
 * 3. Tambahkan ke DOM dan biarkan terlihat selama 3.2 detik.
 * 4. Berikan efek fade-out dan slide ke bawah (animasi transisi 0.3 detik).
 * 5. Hapus elemen secara bersih dari DOM (garbage collection) agar tidak memberatkan memori.
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

  // Tentukan ikon berdasarkan tipe
  const iconName = type === "success" ? "✓" : type === "error" ? "✕" : "ℹ";

  // Masukkan konten HTML (ikon + pesan teks)
  toast.innerHTML = `
    <span style="font-weight:bold; font-size:1.1rem;">${iconName}</span>
    <span>${message}</span>
  `;

  // 3. Tempelkan toast ke dalam kontainer agar muncul di layar
  container.appendChild(toast);

  // 4. Atur timer untuk animasi keluar dan penghapusan
  setTimeout(() => {
    // Efek visual: kurangi transparansi jadi 0 dan geser ke bawah
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    toast.style.transition = "all 0.3s ease";

    // 5. Setelah animasi transisi 300ms selesai, hapus elemen dari dokumen
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}
