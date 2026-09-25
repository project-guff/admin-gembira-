/* Service Worker — Kasir Baso & Mie Ayam
   Hanya menyimpan cache "app shell" (halaman & aset statis) supaya aplikasi tetap
   bisa terbuka (misal sampai layar login) walau internet putus sesaat.
   Data transaksi/menu/pengguna TIDAK pernah di-cache — selalu diambil langsung
   dari Supabase saat online, sesuai desain aplikasi ini yang tidak punya mode lokal. */

const CACHE_NAME = "kasir-baso-shell-v1";
const APP_SHELL = ["./", "./index.html"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => { /* abaikan jika salah satu aset gagal di-precache */ })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Biarkan semua request non-GET (POST/PATCH/DELETE ke Supabase saat transaksi, dsb)
  // langsung ke jaringan tanpa campur tangan service worker.
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Data dari Supabase tidak boleh di-cache — harus selalu yang terbaru dari server.
  if (url.hostname.endsWith("supabase.co")) return;

  // Navigasi ke halaman utama: coba jaringan dulu (biar selalu dapat versi terbaru),
  // kalau offline baru pakai cache.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./")))
    );
    return;
  }

  // Aset lain (font Google, dsb): pakai cache dulu biar cepat, sambil diperbarui di belakang layar.
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
