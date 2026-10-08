"use client";

import { useDeferredValue, useState } from "react";
import type { DailySale } from "@/lib/admin-data";
import { type WeeklyRow as Row, withWeekAverage } from "@/lib/sales";
import { formatPrice } from "@/lib/format";

const MAX_ROWS = 1000;

export default function SalesExplorer({ sales }: { sales: DailySale[] }) {
  const [query, setQuery] = useState("");
  // The input updates right away; the table follows when React has time
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  // The week average does not depend on the filter: computed once.
  // No useMemo needed: the React Compiler memoizes it (it only depends on sales).
  const allRows = withWeekAverage(sales);

  const q = deferredQuery.trim().toLowerCase();
  const rows = allRows.filter(
    (s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q),
  );
  const totalRevenue = rows.reduce((sum, s) => sum + s.revenue, 0);
  const totalQuantity = rows.reduce((sum, s) => sum + s.quantity, 0);

  return (
    <div className="mt-6">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cari pizza atau kategori, misalnya: chicken"
        aria-label="Cari pizza atau kategori"
        className="w-full max-w-md rounded-lg border border-black/10 bg-white px-4 py-2"
      />
      <Summary count={rows.length} quantity={totalQuantity} revenue={totalRevenue} />
      <div style={{ opacity: isStale ? 0.6 : 1 }}>
        <SalesTable rows={rows} />
      </div>
    </div>
  );
}

function Summary({ count, quantity, revenue }: { count: number; quantity: number; revenue: number }) {
  return (
    <p className="mt-3 text-sm text-ink/70" data-testid="sales-summary">
      {count.toLocaleString("en-US")} baris · {quantity.toLocaleString("en-US")} pizza ·{" "}
      {formatPrice(revenue)}
      {count > MAX_ROWS && ` · menampilkan ${MAX_ROWS} teratas`}
    </p>
  );
}

// No memo() needed either: with the compiler, the <SalesTable> element is
// reused while `rows` is the same array, so typing only re-renders the input
function SalesTable({ rows }: { rows: Row[] }) {
  return (
    <table className="mt-4 w-full overflow-hidden rounded-xl bg-white text-left text-sm shadow-sm">
      <thead className="bg-stone-50 text-xs uppercase text-ink/60">
        <tr>
          <th className="px-4 py-2">Tanggal</th>
          <th className="px-4 py-2">Pizza</th>
          <th className="px-4 py-2">Kategori</th>
          <th className="px-4 py-2 text-right">Qty</th>
          <th className="px-4 py-2 text-right">Rata-rata 7 hari</th>
          <th className="px-4 py-2 text-right">Pendapatan</th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, MAX_ROWS).map((row) => (
          <SalesRow key={`${row.date}-${row.pizzaId}`} row={row} />
        ))}
      </tbody>
    </table>
  );
}

// A plain function from lib/format: no context, so the clock cannot reach it
function SalesRow({ row }: { row: Row }) {
  return (
    <tr className="border-t border-black/5">
      <td className="px-4 py-1.5">{row.date}</td>
      <td className="px-4 py-1.5">{row.name}</td>
      <td className="px-4 py-1.5">{row.category}</td>
      <td className="px-4 py-1.5 text-right">{row.quantity}</td>
      <td className="px-4 py-1.5 text-right">{row.weekAverage.toFixed(1)}</td>
      <td className="px-4 py-1.5 text-right">{formatPrice(row.revenue)}</td>
    </tr>
  );
}