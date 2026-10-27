# 🎮 Game & Email Hub (Game-Centric Multi-Account Dashboard)

[![Live Demo](https://img.shields.io/badge/Demo-gamemail.emailgratisan.fun-6366f1?style=for-the-badge&logo=vercel)](https://gamemail.emailgratisan.fun)
[![Vercel Deployment](https://img.shields.io/badge/Deployed%20with-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![Database](https://img.shields.io/badge/Cloud%20Database-Upstash%20Redis-red?style=for-the-badge&logo=redis)](https://upstash.com)
[![Email Service](https://img.shields.io/badge/Official%20Email-Resend%20API-black?style=for-the-badge&logo=mailgun)](https://resend.com)

**Game & Email Hub** adalah platform manajemen multi-akun game terpadu yang dirancang khusus untuk para gamer, *farming/RMT network*, dan pemain Web3 Gaming. Aplikasi ini memusatkan seluruh katalog game dan inventaris email ke dalam satu dashboard analitik cerdas yang terisolasi aman di database cloud.

---

## 🌟 Fitur Unggulan

### ☁️ 1. Penyimpanan Cloud Mutlak (Upstash Redis)
- **Zero Local Conflict**: Seluruh data game, akun email, saldo in-game, dan status tersimpan permanen di **Upstash Redis Key-Value Store** via serverless endpoint `/api/data`.
- **User Data Isolation**: Data setiap pengguna terisolasi penuh (`data:<USER_ID>`). Akun Anda tidak akan pernah bercampur dengan akun pengguna lain.

### 📥 2. Impor Massal Email (Bulk Paste Import)
- **Paste Ratusan Email Sekaligus**: Mendukung input massal puluhan hingga ratusan email dari Notepad atau Excel (dipisahkan baris baru / enter atau koma).
- **Auto-Connect ke Game**: Opsi langsung menautkan seluruh email yang diimpor ke game tujuan dengan status pilihan (*Live / Praregist / Maintenance*) dalam sekali klik.
- **Deteksi Otomatis & Anti-Duplikat**: Mengenali format email valid dan menyaring email duplikat secara real-time.

### 🛡️ 3. Keamanan & Proteksi Registrasi (1 IP = 1 Akun)
- **Anti-Spam Multi-Account**: Membatasi pengguna publik hanya dapat mendaftarkan 1 akun per alamat IP.
- **Developer Whitelist**: Sistem whitelist cerdas untuk membebaskan IP/PC pengembang dari limit registrasi.
- **Email Verification Service**: Registrasi dilengkapi verifikasi email resmi via **Resend API** dengan domain kustom `noreply@mail.emailgratisan.fun`, tautan aktivasi satu klik, dan kode verifikasi 6-digit (dengan failover otomatis ke Gmail SMTP).

### 💰 4. Kalkulator Valuasi Finansial (Web2 RMT & Web3 NFT)
- **Dukungan Dual-Economy**:
  - **Web2 / RMT**: Pengaturan kurs manual Rupiah per unit koin (misal: Rp 60.000 / 1.000 Koin).
  - **Web3 / Crypto Token**: Input Smart Contract Address (CA) dengan auto-fetch live ticker & harga DEX dari DexScreener API.
- **Grand Total Real-Time**: Kalkulasi otomatis estimasi total aset finansial Rupiah dari seluruh akun yang berstatus **LIVE**.

### 🎮 5. Manajemen Inventaris Game & Akun Canggih
- **Proteksi Email Ganda**: 1 email tidak bisa didaftarkan dua kali pada game yang sama, namun tetap fleksibel dihubungkan ke berbagai game berbeda.
- **Inline Status Dropdown**: Ubah status akun (*Live / Praregist / Maintenance*) secara instan langsung dari kartu game tanpa perlu membuka modal dialog.
- **Quick Edit Modal**: Tombol `✉️` pada setiap baris untuk memperbarui rincian email, IGN, saldo koin, label, dan email pemulihan.
- **Cadangan & Pemulihan (Backup & Restore)**: Ekspor seluruh data akun ke file format **JSON** dan **CSV (Excel)** kapan saja.

---

## 🏗️ Arsitektur Teknologi

- **Frontend**: Single Page Application (SPA) berbasis Vanilla JavaScript, CSS3 Design Tokens, dan Responsive Flex/Grid Layout.
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Backend / Serverless**: Vercel Serverless Functions (`/api/auth.js`, `/api/data.js`)
- **Cloud Database**: [Upstash Redis](https://upstash.com/) (REST API)
- **Mail Delivery**: [Resend](https://resend.com/) (Domain Resmi DKIM/SPF) dengan fallback [Nodemailer](https://nodemailer.com/) (Gmail SMTP).

---

## ⚙️ Variabel Lingkungan (.env)

Buat file `.env.local` di root proyek untuk konfigurasi lokal atau pasang di dashboard Vercel:

```env
# Upstash Redis
UPSTASH_REDIS_REST_URL="https://your-upstash-url.upstash.io"
UPSTASH_REDIS_REST_TOKEN="your-upstash-token"

# Domain & Pengiriman Email Resmi
RESEND_API_KEY="re_your_resend_api_key"
EMAIL_FROM="Game & Email Hub <noreply@mail.yourdomain.com>"
APP_URL="https://gamemail.yourdomain.com"

# Cadangan SMTP (Opsional)
GMAIL_USER="your-email@gmail.com"
GMAIL_APP_PASS="your-app-password"

# Whitelist IP Pengembang (Bypass 1 IP 1 Akun, pisahkan koma jika lebih dari satu)
ADMIN_WHITELIST_IPS="123.456.78.90"
```

---

## 🚀 Instalasi & Menjalankan Proyek

### 1. Clone Repositori
```bash
git clone https://github.com/markhanprasetiyo01-wq/email-management.git
cd email-management
```

### 2. Install Dependensi
```bash
npm install
```

### 3. Jalankan Dev Server
```bash
npm run dev
```
Akses di browser pada: `http://localhost:5173/`

### 4. Build untuk Produksi
```bash
npm run build
```

---

## 📄 Lisensi
Didistribusikan di bawah lisensi MIT. Silakan gunakan dan kembangkan sesuai kebutuhan Anda.
