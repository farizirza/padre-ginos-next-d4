"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type Point = { date: string; revenue: number; orders: number };

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export default function TrendChart({ trend }: { trend: Point[] }) {
  return (
    <div className="mt-4 h-64" data-testid="trend-chart">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trend}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value) => usd.format(Number(value))} />
          <Line type="monotone" dataKey="revenue" stroke="#b91c1c" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
