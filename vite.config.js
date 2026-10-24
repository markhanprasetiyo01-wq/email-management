import { defineConfig } from "vite";

// ============================================================================
// KONFIGURASI VITE (MURNI CLOUD DATABASE STORAGE)
// ============================================================================
// Seluruh data pengguna mutlak disimpan di Cloud Database (Upstash Redis).
// Tidak ada middleware lokal data.json yang mengintersepsi /api/data.

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
  },
});
