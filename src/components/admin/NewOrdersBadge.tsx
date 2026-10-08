"use client";

import { useEffect, useState } from "react";

export default function NewOrdersBadge() {
  const [now, setNow] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);

  // Jam untuk hitungan "dicek X dtk lalu"
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Polling order menunggu setiap 5 detik
  useEffect(() => {
    async function poll() {
      const response = await fetch("/api/admin/live");
      if (!response.ok) return;
      const data = (await response.json()) as { pending: number };
      setPending(data.pending);
      setCheckedAt(Date.now());
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  if (pending === null) return null;
  const seconds = now && checkedAt ? Math.max(0, Math.round((now - checkedAt) / 1000)) : 0;
  return (
    <div className="mx-3 mt-4 rounded-lg bg-white/10 px-3 py-2 text-xs" data-testid="new-orders-badge">
      <span className="font-semibold text-white">{pending} order menunggu</span>
      <span className="block text-white/60">dicek {seconds} dtk lalu</span>
    </div>
  );
}
