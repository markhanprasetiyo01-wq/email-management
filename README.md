# 🎮 Game & Email Hub — Game-Centric Registration Tracker

Aplikasi pelacak inventaris akun game yang berfokus pada **Katalog Game**: Setiap game langsung menampilkan daftar alamat email mana saja yang terdaftar beserta status terbarunya (**Live**, **Praregist / Pre-register**, atau **Maintenance**).

---

## ✨ Fitur & Proteksi Baru:

### 1. Proteksi Anti-Duplikat pada Game yang Sama
- **Tidak bisa memasukkan email yang sama dua kali pada 1 game**:
  Jika email `markhanprasetiyo@gmail.com` sudah terdaftar di game **Architech**, maka saat Anda mencoba menghubungkan kembali email tersebut ke **Architech**, sistem otomatis:
  - Menandai email tersebut dengan ikon `⛔ (Sudah Terdaftar di Game Ini)` dan menonaktifkannya di daftar pilihan.
  - Menolak penyimpanan jika dicoba secara paksa dengan peringatan: *"Gagal: Email sudah terdaftar di game ini!"*.
- **Tetap Bisa 1 Email untuk Beberapa Game Berbeda**:
  Email `markhanprasetiyo@gmail.com` tersebut tetap bebas dihubungkan ke game lain seperti **Genshin Impact**, **Wuthering Waves**, atau game lainnya.

### 2. Database 38 Email Pengguna & Selector Instan
- Seluruh 38 email profil Google Anda sudah tersedia di dalam database aplikasi.
- Terdapat filter pencarian cepat di dalam jendela modal untuk memilih email dalam 1 detik tanpa perlu mengetik manual.

### 3. Filter Checklist Game
- Centang game mana saja yang ingin Anda pantau di panel checklist atas; hanya game yang dicentang yang akan tampil di layar.

### 4. Responsif di Semua Layar
- Tampilan otomatis menyesuaikan ukuran HP kecil, smartphone, tablet, hingga layar desktop lebar.

---

## 🚀 Cara Menjalankan

```bash
# 1. Install dependensi
npm install

# 2. Jalankan server lokal
npm run dev
```

Buka di browser:
👉 **[http://localhost:5173/](http://localhost:5173/)**
