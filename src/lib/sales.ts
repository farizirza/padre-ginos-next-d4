import type { DailySale } from "./admin-data";

// Pure functions for the analytics page: no React, easy to test

export interface WeeklyRow extends DailySale {
  weekAverage: number;
}

const DAY = 24 * 60 * 60 * 1000;

// Average quantity of the same pizza over the 7 days up to this row's date.
// Before: every row scanned every other row (11k × 11k). Now: index the
// quantities by pizza and day once, then look up 7 days per row.
export function withWeekAverage(rows: DailySale[]): WeeklyRow[] {
  const quantityByKey = new Map<string, number>();
  for (const row of rows) quantityByKey.set(`${row.pizzaId}|${Date.parse(row.date)}`, row.quantity);
  return rows.map((row) => {
    const end = Date.parse(row.date);
    let total = 0;
    for (let i = 0; i < 7; i++) total += quantityByKey.get(`${row.pizzaId}|${end - i * DAY}`) ?? 0;
    return { ...row, weekAverage: total / 7 };
  });
}
