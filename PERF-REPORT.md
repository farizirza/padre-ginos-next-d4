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
| C | Overview lambat di laptop staf | | | | | | |
| D | Detail order lama terbuka | | | | | | |

## Catatan

- Apa yang paling mengejutkan dari hasil pengukuran?
- Perbaikan mana yang TIDAK memberi hasil, dan kenapa?
