# Performance Investigation Report — Day 4

Nama: ______________________   Tag awal: `d4-start`

Cara mengukur (selalu sama):

- `npm run build && npm run start` (bukan `dev`)
- Chrome DevTools → Performance → CPU **4× slowdown**
- Ulangi 3 kali, catat median

| # | Keluhan | Alat ukur | Metrik | Sebelum | Hipotesis | Perbaikan | Sesudah |
|---|---|---|---|---|---|---|---|
| A | Filter analitik terasa lambat saat mengetik | DevTools Performance (CPU 4×) & React Profiler | Event duration & INP (saat filter) | Terlama ±3.100 ms, median ±530 ms (21 long tasks) | Perhitungan O(n²) per ketikan & render 1.000 baris memblokir input | Algoritma linear O(n) via Map, hitung sekali (useMemo), useDeferredValue + memo(SalesTable) | Terlama ±240 ms, median 16–80 ms (hanya 3 event > 200 ms) |
| B | Dashboard makin berat kalau dibiarkan terbuka | DevTools Performance (CPU 4×) & React Profiler | Scripting time (5 detik diam) & commit frekuensi | Scripting 3.397 ms, commit tiap ~1 dtk (6 commit), 1.000 SalesRow ikut render | State `now` di `LiveProvider` trigger context update tiap detik; SalesRow render karena consume context (memo tidak menahan context) | Colocate state live ke `NewOrdersBadge`, ganti `useLive` di tabel dengan `formatPrice` murni dari `lib/format`, hapus `LiveProvider` | Scripting 26 ms (-99.2%), hanya NewOrdersBadge yang render (<0.1 ms) |
| C | Overview lambat di laptop staf | `route-bundle-stats.json` & DevTools Network | `firstLoadUncompressedJsBytes` rute `/admin` | 847.310 bytes (±847 KB), ±359 KB lebih berat | Library `recharts` diimpor langsung di initial bundle, padahal grafik disembunyikan | Pisahkan chart ke `TrendChart.tsx`, lazy load via `next/dynamic` saat tombol diklik | 499.431 bytes (±499 KB), turun ±348 KB (-41%), chunk baru diunduh setelah klik |
| D | Detail order lama terbuka | DevTools Network (TTFB / Timing) & console.time | Waktu sampai order terlihat vs semua terlihat | Total order terlihat: ±1.800 ms, semua terlihat: ±1.800 ms (N+1 query sekuensial di server) | Server waterfall memblokir respon HTML; N+1 query per baris pizza menambah latensi sekuensial | Batch query `getPizzasSoldOnDay` (`IN (...)`), jalankan query paralel, streaming via `<Suspense>` | Total order terlihat: ±300 ms (-83%), info pelengkap menyusul ter-stream |

## Catatan

- Apa yang paling mengejutkan dari hasil pengukuran?
  - Di Masalah B: Komponen yang sudah di-`memo` (`SalesTable`) tetap me-render 1.000 baris setiap detik karena `SalesRow` di dalamnya mengonsumsi Context (`useLive`) yang nilainya berubah setiap detik. Context subscription mem-bypass `memo`.
  - Di Masalah D: Halaman server component yang menunggu N+1 query sekuensial menahan seluruh respon HTML ke browser, membuat layar kosong/menunggu lama.
- Perbaikan mana yang TIDAK memberi hasil, dan kenapa?
  - Membungkus tabel dengan `memo` sebelum melepas dependensi Context tidak memberikan hasil karena `memo` hanya membandingkan props.
