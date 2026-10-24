// ============================================================================
// VERCEL SERVERLESS FUNCTION: /api/data
// ============================================================================
// Endpoint Multi-User Data Management:
// Data setiap user disimpan terisolasi di Upstash Redis:
// Key: `data:<USER_ID>`
// Mendukung otorisasi via Authorization Header: `Bearer <SESSION_TOKEN>`

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
  if (!url || !token) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commandArray),
    });

    if (!res.ok) return null;
    const json = await res.json();
    return json.result;
  } catch (err) {
    console.warn("KV Command Error:", err);
    return null;
  }
}

async function getUserIdFromToken(token) {
  if (!token) return null;
  const userId = await kvCommand(["GET", `session:${token}`]);
  return userId || null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 1. Ekstrak session token dari header Authorization (WAJIB LOGIN)
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const userId = await getUserIdFromToken(token);

  // KETAT: Semua akses ke route data WAJIB terautentikasi (Anti-Hacking & Perlindungan Data)
  if (!token || !userId) {
    return res.status(401).json({
      error: "Akses Ditolak! Anda harus login terlebih dahulu untuk mengakses data.",
      code: "UNAUTHORIZED",
    });
  }

  // Storage key spesifik untuk user yang terotentikasi
  const storageKey = `data:${userId}`;

  // --------------------------------------------------------------------------
  // GET /api/data: Mengambil data pengguna pribadi
  // --------------------------------------------------------------------------
  if (req.method === "GET") {
    try {
      res.setHeader("X-Storage-Source", "vercel-kv");
      const rawData = await kvCommand(["GET", storageKey]);
      if (rawData) {
        const parsed = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
        parsed.storageSource = "vercel-kv";
        return res.status(200).json(parsed);
      }

      // Jika user baru (belum ada data di key user), buatkan database kosong
      const emptyUserData = {
        lastUpdated: new Date().toISOString(),
        games: [],
        emails: [],
        registrations: [],
        storageSource: "vercel-kv",
      };
      await kvCommand(["SET", storageKey, JSON.stringify(emptyUserData)]);
      return res.status(200).json(emptyUserData);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // --------------------------------------------------------------------------
  // POST /api/data: Menyimpan data pengguna
  // --------------------------------------------------------------------------
  if (req.method === "POST") {
    try {
      const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

      if (
        !payload ||
        !Array.isArray(payload.games) ||
        !Array.isArray(payload.emails) ||
        !Array.isArray(payload.registrations)
      ) {
        return res.status(400).json({ error: "Format data tidak valid" });
      }

      payload.lastUpdated = new Date().toISOString();
      const stringData = JSON.stringify(payload);

      await kvCommand(["SET", storageKey, stringData]);

      return res.status(200).json({
        success: true,
        message: "Data berhasil disimpan!",
        lastUpdated: payload.lastUpdated,
        userId: userId || "public",
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
