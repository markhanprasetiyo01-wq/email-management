// ============================================================================
// MODUL CRYPTO TOKEN & DEX PRICE SERVICE (src/services/cryptoService.js)
// ============================================================================
// Service ini menangani pencarian info token via DexScreener & kurs USD/IDR:
// 1. DexScreener API: Mendukung EVM (Ethereum, BSC, Polygon, Arbitrum, Base, dll),
//    Solana, TON, Sui, Aptos, dsb langsung dari Smart Contract Address (CA).
//    Tanpa perlu API Key & gratis!
// 2. Kurs USD ke IDR: Menggunakan live rate dari CoinGecko (fallback ke 16.200 jika offline).

let cachedUsdToIdr = 16300;
let lastRateFetch = 0;

/**
 * Mendapatkan kurs USD ke IDR terkini
 */
export async function getUsdToIdrRate() {
  const now = Date.now();
  // Cache kurs selama 10 menit agar tidak membebani API
  if (now - lastRateFetch < 10 * 60 * 1000 && cachedUsdToIdr > 0) {
    return cachedUsdToIdr;
  }

  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=idr");
    if (res.ok) {
      const data = await res.json();
      if (data?.tether?.idr) {
        cachedUsdToIdr = Number(data.tether.idr);
        lastRateFetch = now;
        return cachedUsdToIdr;
      }
    }
  } catch (err) {
    console.warn("Gagal mengambil kurs USD/IDR dari CoinGecko, menggunakan fallback:", err);
  }

  return cachedUsdToIdr;
}

/**
 * Mencari data token crypto berdasarkan Smart Contract Address (CA)
 * @param {string} contractAddress - Alamat Smart Contract (EVM / Solana / dsb)
 * @returns {Promise<{success: boolean, token?: object, error?: string}>}
 */
export async function fetchTokenByContractAddress(contractAddress) {
  const cleanCA = (contractAddress || "").trim();
  if (!cleanCA) {
    return { success: false, error: "Contract address kosong!" };
  }

  try {
    // 1. Coba DexScreener tokens endpoint: https://api.dexscreener.com/latest/dex/tokens/:contractAddress
    let res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${cleanCA}`);
    let data = null;

    if (res.ok) {
      data = await res.json();
    }

    // Jika belum ketemu atau pairs kosong, coba search endpoint
    if (!data || !data.pairs || data.pairs.length === 0) {
      const searchRes = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(cleanCA)}`);
      if (searchRes.ok) {
        data = await searchRes.json();
      }
    }

    if (!data || !data.pairs || data.pairs.length === 0) {
      return { 
        success: false, 
        error: "Token dengan Contract Address tersebut tidak ditemukan di DEX (DexScreener). Pastikan token sudah listing di DEX liquidity pool." 
      };
    }

    // Filter pair yang valid dan memiliki harga USD
    const validPairs = data.pairs.filter((p) => p && Number(p.priceUsd) > 0);

    if (validPairs.length === 0) {
      return {
        success: false,
        error: "Token ditemukan tetapi belum memiliki harga likuiditas USD aktif di DEX.",
      };
    }

    // Skor kecocokan pair: Utamakan pair Stablecoin resmi (USDC, USDT, USD, DAI)
    // yang paling mencerminkan harga pasar sesungguhnya
    const getPairScore = (pair) => {
      let score = 0;
      const quoteSym = (pair.quoteToken?.symbol || "").toUpperCase();
      const liqUsd = Number(pair.liquidity?.usd) || 0;
      const vol24h = Number(pair.volume?.h24) || 0;

      // Prioritas 1: Pair Stablecoin (USDC / USDT / DAI)
      if (quoteSym === "USDC") score += 500000;
      else if (quoteSym === "USDT") score += 400000;
      else if (quoteSym.includes("USD") || quoteSym === "DAI") score += 300000;
      else if (["WETH", "ETH", "SOL", "WBNB", "BNB"].includes(quoteSym)) score += 100000;

      // Prioritas 2: Likuiditas dan Volume 24 jam
      score += Math.min(liqUsd, 200000);
      score += Math.min(vol24h, 100000);

      return score;
    };

    validPairs.sort((a, b) => getPairScore(b) - getPairScore(a));
    const bestPair = validPairs[0];

    // Pastikan baseToken yang diambil adalah token yang dicari, bukan token pairing-nya
    const isBaseTarget = (bestPair.baseToken?.address || "").toLowerCase() === cleanCA.toLowerCase();
    const targetToken = isBaseTarget ? bestPair.baseToken : (bestPair.quoteToken || bestPair.baseToken);

    const priceUsd = Number(bestPair.priceUsd) || 0;
    const usdToIdr = await getUsdToIdrRate();
    // Gunakan 2 desimal jika harga IDR kecil di bawah 100 rupiah, atau bulat jika >= 100
    const rawPriceIdr = priceUsd * usdToIdr;
    const priceIdr = rawPriceIdr >= 100 ? Math.round(rawPriceIdr) : Number(rawPriceIdr.toFixed(2));

    return {
      success: true,
      token: {
        address: targetToken?.address || cleanCA,
        name: targetToken?.name || "Unknown Token",
        symbol: targetToken?.symbol || "TOKEN",
        pairQuoteSymbol: bestPair.quoteToken?.symbol || "USD",
        chainId: bestPair.chainId || "multi",
        dexId: bestPair.dexId || "",
        dexUrl: bestPair.url || `https://dexscreener.com/search?q=${cleanCA}`,
        priceUsd: priceUsd,
        priceIdr: priceIdr,
        usdToIdrRate: usdToIdr,
        fdv: bestPair.fdv || 0,
        liquidityUsd: bestPair.liquidity?.usd || 0,
        pairAddress: bestPair.pairAddress || "",
        lastUpdated: new Date().toISOString()
      }
    };
  } catch (err) {
    return { success: false, error: "Gagal menghubungkan ke DexScreener: " + (err.message || String(err)) };
  }
}
