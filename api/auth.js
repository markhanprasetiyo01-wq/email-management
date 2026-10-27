// ============================================================================
// VERCEL SERVERLESS FUNCTION: /api/auth
// ============================================================================
// Endpoint untuk Autentikasi Pengguna & Proteksi 1 Akun Per IP:
// 1. POST /api/auth?action=register
//    - Cek IP Pengguna (header: x-forwarded-for / x-real-ip)
//    - Jika IP sudah pernah terdaftar, tolak dengan error: "1 Alamat IP hanya bisa 1 akun!"
//    - Jika Email sudah terdaftar, tolak.
//    - Simpan user, hash password, catat IP, dan buatkan database kosong (0 game, 0 email).
// 2. POST /api/auth?action=login
//    - Verifikasi email dan password.
//    - Kembalikan token sesi dan profil user.
// 3. GET /api/auth?action=me
//    - Cek sesi aktif berdasarkan token/cookie.

import crypto from "node:crypto";
import nodemailer from "nodemailer";

function getKvCredentials() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.STORAGE_REST_API_URL;

  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.STORAGE_REST_API_TOKEN;

  return { url, token };
}

async function kvCommand(commandArray) {
  const { url, token } = getKvCredentials();
  if (!url || !token)
    throw new Error("Upstash Redis credentials tidak terkonfigurasi!");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commandArray),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Upstash Error: ${txt}`);
  }

  const json = await res.json();
  return json.result;
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers["x-real-ip"] || req.socket?.remoteAddress || "127.0.0.1";
}

// Daftar IP / PC yang dibebaskan (Whitelist) dari batasan 1 Akun 1 IP
function isWhitelistedIp(ip) {
  if (!ip) return false;
  const cleanIp = ip.trim();
  // 1. Localhost / Mesin Lokal
  if (cleanIp === "127.0.0.1" || cleanIp === "::1" || cleanIp === "localhost")
    return true;
  // 2. IP tambahan dari Environment Variable ADMIN_WHITELIST_IPS (pisahkan dengan koma jika lebih dari satu)
  const envList = (process.env.ADMIN_WHITELIST_IPS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return envList.includes(cleanIp);
}

async function sendVerificationEmail(toEmail, verifyUrl, verifyCode) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom =
    process.env.EMAIL_FROM ||
    "Game & Email Hub <noreply@mail.emailgratisan.fun>";
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASS;

  // 1. Teks Biasa (Plain Text Version) - Kritis untuk skor spam nol
  const textContent = `
Halo,

Terima kasih telah mendaftar di Game & Email Hub.
Kode verifikasi Anda adalah: ${verifyCode}

Atau klik tautan aktivasi berikut untuk langsung memverifikasi akun Anda:
${verifyUrl}

Tautan dan kode ini berlaku selama 30 menit.
Catatan: Simpan alamat email dan kata sandi Anda dengan baik.

Salam,
Game & Email Hub Team
`.trim();

  // 2. HTML Version (Desain Bersih, Elegan, dan Ramah Filter Spam)
  const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifikasi Akun</title>
</head>
<body style="margin: 0; padding: 20px 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #0b0f19;">
    <tr>
      <td align="center" style="padding: 10px;">
        <table role="presentation" width="100%" max-width="520" style="max-width: 520px; background-color: #111827; border: 1px solid #1f2937; border-radius: 12px; overflow: hidden; padding: 28px 24px; text-align: left;">
          
          <!-- Logo & Header -->
          <tr>
            <td align="center" style="padding-bottom: 20px;">
              <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; border-radius: 10px; background-color: #312e81; font-size: 22px; text-align: center;">🎮</div>
              <h1 style="margin: 12px 0 4px; font-size: 19px; font-weight: 700; color: #ffffff;">Game &amp; Email Hub</h1>
              <p style="margin: 0; font-size: 13px; color: #94a3b8;">Aktivasi Akun Pengguna</p>
            </td>
          </tr>

          <!-- Isi Pesan -->
          <tr>
            <td style="font-size: 14px; line-height: 1.6; color: #cbd5e1; padding-bottom: 18px;">
              Halo,<br><br>
              Terima kasih telah bergabung di <strong>Game &amp; Email Hub</strong>. Untuk mengaktifkan akun dan ruang kerja pribadi Anda, silakan gunakan tombol verifikasi di bawah ini:
            </td>
          </tr>

          <!-- Tombol Aktivasi Utama -->
          <tr>
            <td align="center" style="padding: 12px 0 24px;">
              <a href="${verifyUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; background-color: #4f46e5; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 8px; box-shadow: 0 2px 8px rgba(79, 70, 229, 0.35);">
                Verifikasi Akun Saya
              </a>
            </td>
          </tr>

          <!-- Alternatif Kode 6 Digit -->
          <tr>
            <td style="background-color: #1e293b; border-radius: 8px; padding: 14px; text-align: center; border: 1px solid #334155;">
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 4px;">Atau masukkan kode verifikasi berikut di web:</div>
              <div style="font-size: 24px; font-weight: 700; color: #38bdf8; letter-spacing: 5px; font-family: monospace;">${verifyCode}</div>
            </td>
          </tr>

          <!-- Catatan Keamanan Halus -->
          <tr>
            <td style="padding-top: 20px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
              ℹ️ <strong>Tips:</strong> Harap catat email dan kata sandi Anda dengan aman untuk login berikutnya. Kode dan tautan ini berlaku selama 30 menit.
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 24px; border-top: 1px solid #1f2937; margin-top: 20px; font-size: 11px; color: #64748b; text-align: center;">
              Jika Anda tidak merasa mendaftar di Game &amp; Email Hub, Anda dapat mengabaikan email ini dengan aman.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  // Pengiriman Email dengan Header Anti-Spam Lengkap
  // PRIORITAS 1: Kirim via Resend Resmi (mail.emailgratisan.fun)
  if (resendApiKey) {
    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [toEmail],
          subject: `Kode Verifikasi Akun: ${verifyCode}`,
          text: textContent,
          html: htmlContent,
          headers: {
            "X-Entity-Ref-ID": verifyCode,
          },
        }),
      });

      if (resendRes.ok) {
        return true;
      }
      console.warn("Resend API gagal, beralih ke Gmail SMTP...");
    } catch (err) {
      console.warn("Resend error, fallback to Gmail:", err);
    }
  }

  // PRIORITAS 2 (FALLBACK): Kirim via Gmail SMTP
  if (gmailUser && gmailPass) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    await transporter.sendMail({
      from: `"Game & Email Hub" <${gmailUser}>`,
      replyTo: gmailUser,
      to: toEmail,
      subject: `Kode Verifikasi Akun: ${verifyCode}`,
      text: textContent,
      html: htmlContent,
      headers: {
        "X-Entity-Ref-ID": verifyCode,
        "X-Mailer": "GameHub Auth Service",
      },
    });
    return true;
  }

  throw new Error("Tidak ada layanan email yang terhubung!");
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const action = req.query.action || (req.body && req.body.action);

  // --------------------------------------------------------------------------
  // 1. REGISTRASI PENGGUNA (KIRIM EMAIL VERIFIKASI ASLI)
  // --------------------------------------------------------------------------
  if (req.method === "POST" && action === "register") {
    try {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const email = (body.email || "").toLowerCase().trim();
      const password = (body.password || "").trim();

      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "Format email tidak valid!" });
      }
      if (!password || password.length < 6) {
        return res.status(400).json({ error: "Password minimal 6 karakter!" });
      }

      const clientIp = getClientIp(req);

      // A. Cek Proteksi IP: 1 IP hanya boleh 1 akun (Dikecualikan / Bypass untuk IP Anda)
      if (!isWhitelistedIp(clientIp)) {
        const ipKey = `ip_lock:${clientIp}`;
        const existingUserFromIp = await kvCommand(["GET", ipKey]);
        if (existingUserFromIp) {
          return res.status(403).json({
            error: `Pendaftaran Ditolak: Alamat IP Anda (${clientIp}) sudah pernah digunakan untuk mendaftar 1 akun! Sistem membatasi hanya 1 akun per IP.`,
          });
        }
      }

      // B. Cek apakah email sudah terdaftar
      const emailKey = `user_email:${email}`;
      const existingUserId = await kvCommand(["GET", emailKey]);
      if (existingUserId) {
        return res
          .status(400)
          .json({ error: "Email ini sudah terdaftar! Silakan login." });
      }

      // C. Buat data pendaftaran sementara (Pending Verification)
      const salt = crypto.randomBytes(16).toString("hex");
      const passwordHash = hashPassword(password, salt);
      const verifyToken = crypto.randomBytes(32).toString("hex");
      const verifyCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit code

      const pendingRecord = {
        email,
        passwordHash,
        salt,
        clientIp,
        verifyCode,
        createdAt: new Date().toISOString(),
      };

      // Simpan pending registration di Redis (berlaku 1800 detik / 30 menit)
      await kvCommand([
        "SET",
        `pending_verify:${verifyToken}`,
        JSON.stringify(pendingRecord),
        "EX",
        1800,
      ]);
      await kvCommand([
        "SET",
        `pending_code:${email}`,
        JSON.stringify({ token: verifyToken, verifyCode }),
        "EX",
        1800,
      ]);

      // Buat tautan aktivasi (otomatis mendeteksi domain custom gamemail.emailgratisan.fun atau vercel app)
      const host =
        req.headers["x-forwarded-host"] ||
        req.headers.host ||
        "gamemail.emailgratisan.fun";
      const proto = req.headers["x-forwarded-proto"] || "https";
      const baseUrl = process.env.APP_URL || `${proto}://${host}`;
      const verifyUrl = `${baseUrl}/?verify_token=${verifyToken}#verify`;

      // D. Kirim email verifikasi via Resend
      await sendVerificationEmail(email, verifyUrl, verifyCode);

      return res.status(200).json({
        success: true,
        pending: true,
        message: `Tautan dan kode verifikasi telah dikirim ke ${email}. Silakan periksa inbox email Anda untuk aktivasi!`,
        email,
      });
    } catch (err) {
      return res
        .status(500)
        .json({ error: err.message || "Gagal memproses pendaftaran" });
    }
  }

  // --------------------------------------------------------------------------
  // 1B. VERIFIKASI EMAIL (VIA LINK TOKEN ATAU KODE 6-DIGIT)
  // --------------------------------------------------------------------------
  if (req.method === "POST" && action === "verify") {
    try {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      let token = (body.token || req.query.token || "").trim();
      const code = (body.code || "").trim();
      const email = (body.email || "").toLowerCase().trim();

      // Jika verifikasi via kode 6 digit
      if (!token && code && email) {
        const rawCodeMap = await kvCommand(["GET", `pending_code:${email}`]);
        if (rawCodeMap) {
          const parsedCodeMap =
            typeof rawCodeMap === "string"
              ? JSON.parse(rawCodeMap)
              : rawCodeMap;
          if (parsedCodeMap.verifyCode === code) {
            token = parsedCodeMap.token;
          } else {
            return res
              .status(400)
              .json({ error: "Kode verifikasi 6-digit salah!" });
          }
        } else {
          return res.status(400).json({
            error: "Kode verifikasi telah kedaluwarsa atau tidak valid.",
          });
        }
      }

      if (!token) {
        return res
          .status(400)
          .json({ error: "Token atau kode verifikasi wajib disertakan!" });
      }

      const pendingKey = `pending_verify:${token}`;
      const rawPending = await kvCommand(["GET", pendingKey]);
      if (!rawPending) {
        return res.status(400).json({
          error:
            "Tautan verifikasi tidak valid atau telah kedaluwarsa (maksimal 30 menit). Silakan daftar ulang.",
        });
      }

      const pending =
        typeof rawPending === "string" ? JSON.parse(rawPending) : rawPending;
      const clientIp = pending.clientIp;
      const verifiedEmail = pending.email;

      // Cek ulang 1 IP = 1 Akun sebelum finalisasi (Dikecualikan / Bypass untuk IP Anda)
      const ipKey = `ip_lock:${clientIp}`;
      if (!isWhitelistedIp(clientIp)) {
        const existingUserFromIp = await kvCommand(["GET", ipKey]);
        if (existingUserFromIp) {
          return res.status(403).json({
            error: `Alamat IP Anda (${clientIp}) sudah terdaftar akun lain.`,
          });
        }
      }

      // Buat User ID definitif
      const userId =
        "usr_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex");
      const userRecord = {
        id: userId,
        email: verifiedEmail,
        passwordHash: pending.passwordHash,
        salt: pending.salt,
        registeredIp: clientIp,
        verified: true,
        verifiedAt: new Date().toISOString(),
        createdAt: pending.createdAt,
      };

      const initialEmptyData = {
        lastUpdated: new Date().toISOString(),
        games: [],
        emails: [],
        registrations: [],
      };

      // Simpan User Permanen & Kunci IP (hanya kunci jika bukan whitelisted)
      await kvCommand(["SET", `user:${userId}`, JSON.stringify(userRecord)]);
      await kvCommand(["SET", `user_email:${verifiedEmail}`, userId]);
      if (!isWhitelistedIp(clientIp)) {
        await kvCommand(["SET", ipKey, userId]); // 1 IP terkunci untuk publik
      }
      await kvCommand([
        "SET",
        `data:${userId}`,
        JSON.stringify(initialEmptyData),
      ]);

      // Hapus pending token
      await kvCommand(["DEL", pendingKey]);
      await kvCommand(["DEL", `pending_code:${verifiedEmail}`]);

      // Buat session token otomatis (langsung login)
      const sessionToken = crypto.randomBytes(32).toString("hex");
      await kvCommand(["SET", `session:${sessionToken}`, userId]);

      return res.status(200).json({
        success: true,
        message:
          "Email berhasil diverifikasi! Akun aktif dan ruang kerja kosong Anda telah siap.",
        token: sessionToken,
        user: { id: userId, email: verifiedEmail },
      });
    } catch (err) {
      return res
        .status(500)
        .json({ error: err.message || "Gagal memverifikasi akun" });
    }
  }

  // --------------------------------------------------------------------------
  // 2. LOGIN PENGGUNA
  // --------------------------------------------------------------------------
  if (req.method === "POST" && action === "login") {
    try {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const email = (body.email || "").toLowerCase().trim();
      const password = (body.password || "").trim();

      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email dan password wajib diisi!" });
      }

      const emailKey = `user_email:${email}`;
      const userId = await kvCommand(["GET", emailKey]);
      if (!userId) {
        return res.status(400).json({
          error:
            "Email belum terdaftar atau belum diverifikasi. Silakan daftar terlebih dahulu!",
        });
      }

      const rawUser = await kvCommand(["GET", `user:${userId}`]);
      if (!rawUser) {
        return res
          .status(400)
          .json({ error: "Data pengguna tidak ditemukan." });
      }

      const userRecord =
        typeof rawUser === "string" ? JSON.parse(rawUser) : rawUser;
      const hashCheck = hashPassword(password, userRecord.salt);

      if (hashCheck !== userRecord.passwordHash) {
        return res
          .status(401)
          .json({
            error:
              "Email / Password salah! punya otak kok pendek kali ingatanya.!",
          });
      }

      // Buat session token
      const sessionToken = crypto.randomBytes(32).toString("hex");
      await kvCommand(["SET", `session:${sessionToken}`, userId]);

      return res.status(200).json({
        success: true,
        message: "Login berhasil!",
        token: sessionToken,
        user: { id: userId, email: userRecord.email },
      });
    } catch (err) {
      return res.status(500).json({ error: err.message || "Gagal login" });
    }
  }

  // --------------------------------------------------------------------------
  // 3. ME (CEK SESI PENGGUNA)
  // --------------------------------------------------------------------------
  if (req.method === "GET" && action === "me") {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();

      if (!token) {
        return res.status(401).json({ error: "Sesi tidak ditemukan" });
      }

      const userId = await kvCommand(["GET", `session:${token}`]);
      if (!userId) {
        return res
          .status(401)
          .json({ error: "Sesi telah kedaluwarsa. Silakan login kembali." });
      }

      const rawUser = await kvCommand(["GET", `user:${userId}`]);
      if (!rawUser) {
        return res.status(404).json({ error: "Pengguna tidak ditemukan." });
      }

      const userRecord =
        typeof rawUser === "string" ? JSON.parse(rawUser) : rawUser;
      return res.status(200).json({
        success: true,
        user: { id: userId, email: userRecord.email },
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // --------------------------------------------------------------------------
  // 4. LOGOUT PENGGUNA
  // --------------------------------------------------------------------------
  if (req.method === "POST" && action === "logout") {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (token) {
        await kvCommand(["DEL", `session:${token}`]);
      }
      return res
        .status(200)
        .json({ success: true, message: "Berhasil logout." });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: "Aksi tidak dikenali" });
}
