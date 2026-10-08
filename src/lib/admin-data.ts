import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { requirePermission } from "./auth";
import { all, get, run } from "./db";
import { failReadIfSimulated, simulateLatency } from "./demo";
import type { OrderStatus } from "./orders";
import type { PizzaSize } from "./types";

// Data access for the staff dashboard (/admin).
// Staff should see the current state, so almost nothing here is cached.
// Day 3: this is the Data Access Layer. Every read checks the user HERE,
// so no page, layout or future component can forget to.

export const ORDERS_PAGE_SIZE = 20;

export interface ProductRow {
  id: string;
  name: string;
  category: string;
  sizes: Record<PizzaSize, number>;
  sold: number;
}

export interface OrderSummary {
  id: number;
  date: string;
  time: string;
  status: OrderStatus;
  items: number;
  total: number;
}

export interface OrderLine {
  pizzaId: string;
  name: string;
  size: PizzaSize;
  quantity: number;
  price: number;
}

export interface OrderDetail extends Omit<OrderSummary, "items"> {
  lines: OrderLine[];
}

export async function getProductRows(): Promise<ProductRow[]> {
  await requirePermission("products:manage");
  await simulateLatency("read");
  await failReadIfSimulated();
  const [types, prices, sales] = await Promise.all([
    all<{ id: string; name: string; category: string }>(
      "SELECT pizza_type_id AS id, name, category FROM pizza_types ORDER BY name",
    ),
    all<{ id: string; size: PizzaSize; price: string }>(
      "SELECT pizza_type_id AS id, size, price FROM pizzas",
    ),
    all<{ id: string; sold: number }>(
      `SELECT p.pizza_type_id AS id, SUM(d.quantity) AS sold
       FROM order_details d JOIN pizzas p ON p.pizza_id = d.pizza_id
       GROUP BY p.pizza_type_id`,
    ),
  ]);
  return types.map((t) => {
    const sizes = { S: 0, M: 0, L: 0 };
    for (const p of prices) if (p.id === t.id) sizes[p.size] = Number(p.price);
    return { ...t, sizes, sold: sales.find((s) => s.id === t.id)?.sold ?? 0 };
  });
}

// Used inside updatePricesAction only, after its permission check
export async function updatePizzaPrices(
  id: string,
  sizes: Record<PizzaSize, number>,
): Promise<void> {
  for (const size of ["S", "M", "L"] as const) {
    await run("UPDATE pizzas SET price = ? WHERE pizza_type_id = ? AND size = ?", [
      sizes[size].toFixed(2),
      id,
      size,
    ]);
  }
}

export async function getOrders({
  page,
  date,
}: {
  page: number;
  date: string | null;
}): Promise<{ orders: OrderSummary[]; totalPages: number }> {
  await requirePermission("admin:view");
  await simulateLatency("read");
  await failReadIfSimulated();
  const offset = (page - 1) * ORDERS_PAGE_SIZE;
  const [orders, count] = await Promise.all([
    all<OrderSummary>(
      `WITH page AS (
         SELECT order_id, date, time, status FROM orders
         WHERE (?1 IS NULL OR date = ?1)
         ORDER BY order_id DESC LIMIT ?2 OFFSET ?3
       )
       SELECT page.order_id AS id, page.date, page.time, page.status,
              SUM(d.quantity) AS items,
              ROUND(SUM(d.quantity * p.price), 2) AS total
       FROM page
       JOIN order_details d ON d.order_id = page.order_id
       JOIN pizzas p ON p.pizza_id = d.pizza_id
       GROUP BY page.order_id
       ORDER BY page.order_id DESC`,
      [date, ORDERS_PAGE_SIZE, offset],
    ),
    get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM orders WHERE (?1 IS NULL OR date = ?1)",
      [date],
    ),
  ]);
  return {
    orders,
    totalPages: Math.max(1, Math.ceil((count?.n ?? 0) / ORDERS_PAGE_SIZE)),
  };
}

export async function getOrder(id: number): Promise<OrderDetail | null> {
  await requirePermission("admin:view");
  await simulateLatency("read");
  const order = await get<{
    id: number;
    date: string;
    time: string;
    status: OrderStatus;
  }>("SELECT order_id AS id, date, time, status FROM orders WHERE order_id = ?", [
    id,
  ]);
  if (!order) return null;
  const lines = await all<OrderLine>(
    `SELECT t.pizza_type_id AS pizzaId, t.name, p.size, d.quantity,
            CAST(p.price AS REAL) AS price
     FROM order_details d
     JOIN pizzas p ON p.pizza_id = d.pizza_id
     JOIN pizza_types t ON t.pizza_type_id = p.pizza_type_id
     WHERE d.order_id = ?`,
    [id],
  );
  const total = lines.reduce((sum, l) => sum + l.quantity * l.price, 0);
  return { ...order, lines, total: Math.round(total * 100) / 100 };
}

// Used inside Server Actions only. Mutations check their own permission
// as the FIRST line of the action (see updateOrderStatusAction).
export async function getOrderStatus(id: number): Promise<OrderStatus | null> {
  const row = await get<{ status: OrderStatus }>(
    "SELECT status FROM orders WHERE order_id = ?",
    [id],
  );
  return row?.status ?? null;
}

export async function setOrderStatus(
  id: number,
  status: OrderStatus,
): Promise<void> {
  await run("UPDATE orders SET status = ? WHERE order_id = ?", [status, id]);
}

// --- Overview widgets -------------------------------------------------------

/** The most recent business day in the data (the dataset ends 2015-12-31). */
export async function getLatestDay(): Promise<{
  date: string;
  orders: number;
  revenue: number;
}> {
  await requirePermission("admin:view");
  await simulateLatency("read");
  const row = await get<{ date: string; orders: number; revenue: number }>(
    `SELECT o.date, COUNT(DISTINCT o.order_id) AS orders,
            ROUND(SUM(d.quantity * p.price), 2) AS revenue
     FROM orders o
     JOIN order_details d ON d.order_id = o.order_id
     JOIN pizzas p ON p.pizza_id = d.pizza_id
     WHERE o.date = (SELECT MAX(date) FROM orders)
     GROUP BY o.date`,
  );
  return row ?? { date: "-", orders: 0, revenue: 0 };
}

/** All-time best sellers. A heavy aggregate: slow on purpose. */
export async function getTopPizzas(): Promise<TopPizza[]> {
  // "use cache" cannot read cookies, so check first, then call the cached part
  await requirePermission("admin:view");
  return topPizzas();
}

type TopPizza = { id: string; name: string; sold: number; revenue: number };

// Not exported: the only way in is through the check above
async function topPizzas(): Promise<TopPizza[]> {
  // History does not change minute to minute: compute it once an hour at most
  "use cache";
  cacheLife("hours");
  cacheTag("sales");
  await simulateLatency("read");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return all(
    `SELECT t.pizza_type_id AS id, t.name, SUM(d.quantity) AS sold,
            ROUND(SUM(d.quantity * p.price), 2) AS revenue
     FROM order_details d
     JOIN pizzas p ON p.pizza_id = d.pizza_id
     JOIN pizza_types t ON t.pizza_type_id = p.pizza_type_id
     GROUP BY t.pizza_type_id ORDER BY sold DESC LIMIT 5`,
  );
}

/** Orders per status on the latest day. Fails when "Simulasi gagal" is on. */
export async function getStatusCounts(): Promise<Record<OrderStatus, number>> {
  await requirePermission("admin:view");
  await simulateLatency("read");
  await failReadIfSimulated();
  const rows = await all<{ status: OrderStatus; n: number }>(
    `SELECT status, COUNT(*) AS n FROM orders
     WHERE date = (SELECT MAX(date) FROM orders) GROUP BY status`,
  );
  const counts = { pending: 0, preparing: 0, ready: 0, delivered: 0, cancelled: 0 };
  for (const r of rows) counts[r.status] = r.n;
  return counts;
}

export async function getSalesBySize(
  id: string,
): Promise<{ size: PizzaSize; sold: number }[]> {
  await requirePermission("products:manage");
  await simulateLatency("read");
  await failReadIfSimulated();
  return all(
    `SELECT p.size, COALESCE(SUM(d.quantity), 0) AS sold
     FROM pizzas p LEFT JOIN order_details d ON d.pizza_id = p.pizza_id
     WHERE p.pizza_type_id = ?
     GROUP BY p.size ORDER BY CASE p.size WHEN 'S' THEN 1 WHEN 'M' THEN 2 ELSE 3 END`,
    [id],
  );
}

// --- Day 4: analytics, trend, order extras ---------------------------------

export interface DailySale {
  date: string;
  pizzaId: string;
  name: string;
  category: string;
  quantity: number;
  revenue: number;
}

/** Every pizza type, every day: ~11k rows. The analytics page filters them. */
export async function getDailySales(): Promise<DailySale[]> {
  await requirePermission("admin:view");
  await simulateLatency("read");
  return all<DailySale>(
    `SELECT o.date, t.pizza_type_id AS pizzaId, t.name, t.category,
            SUM(d.quantity) AS quantity,
            ROUND(SUM(d.quantity * p.price), 2) AS revenue
     FROM orders o
     JOIN order_details d ON d.order_id = o.order_id
     JOIN pizzas p ON p.pizza_id = d.pizza_id
     JOIN pizza_types t ON t.pizza_type_id = p.pizza_type_id
     GROUP BY o.date, t.pizza_type_id
     ORDER BY o.date DESC, t.name`,
  );
}

/** Revenue per day for the last 30 days in the data. */
export async function getSalesTrend(): Promise<{ date: string; revenue: number; orders: number }[]> {
  await requirePermission("admin:view");
  await simulateLatency("read");
  return all(
    `SELECT o.date, ROUND(SUM(d.quantity * p.price), 2) AS revenue,
            COUNT(DISTINCT o.order_id) AS orders
     FROM orders o
     JOIN order_details d ON d.order_id = o.order_id
     JOIN pizzas p ON p.pizza_id = d.pizza_id
     WHERE o.date > date((SELECT MAX(date) FROM orders), '-30 days')
     GROUP BY o.date ORDER BY o.date`,
  );
}

/** How many orders were placed on the same day. */
export async function getDayOrderCount(date: string): Promise<number> {
  await requirePermission("admin:view");
  await simulateLatency("read");
  const row = await get<{ n: number }>("SELECT COUNT(*) AS n FROM orders WHERE date = ?", [date]);
  return row?.n ?? 0;
}

/** How many times this pizza (type) was ordered on that day. */
export async function getPizzaSoldOnDay(pizzaId: string, date: string): Promise<number> {
  await requirePermission("admin:view");
  await simulateLatency("read");
  const row = await get<{ n: number }>(
    `SELECT COALESCE(SUM(d.quantity), 0) AS n
     FROM order_details d
     JOIN orders o ON o.order_id = d.order_id
     JOIN pizzas p ON p.pizza_id = d.pizza_id
     WHERE p.pizza_type_id = ? AND o.date = ?`,
    [pizzaId, date],
  );
  return row?.n ?? 0;
}

/** How many times each pizza type was ordered on that day, in a single batch query. */
export async function getPizzasSoldOnDay(
  pizzaIds: string[],
  date: string,
): Promise<Record<string, number>> {
  await requirePermission("admin:view");
  await simulateLatency("read");
  if (pizzaIds.length === 0) return {};
  const uniqueIds = Array.from(new Set(pizzaIds));
  const placeholders = uniqueIds.map(() => "?").join(", ");
  const rows = await all<{ pizzaId: string; n: number }>(
    `SELECT p.pizza_type_id AS pizzaId, COALESCE(SUM(d.quantity), 0) AS n
     FROM order_details d
     JOIN orders o ON o.order_id = d.order_id
     JOIN pizzas p ON p.pizza_id = d.pizza_id
     WHERE p.pizza_type_id IN (${placeholders}) AND o.date = ?
     GROUP BY p.pizza_type_id`,
    [...uniqueIds, date],
  );
  const result: Record<string, number> = {};
  for (const id of uniqueIds) result[id] = 0;
  for (const r of rows) result[r.pizzaId] = r.n;
  return result;
}

/** Live counter for the sidebar: orders still waiting on the latest day. */
export async function getPendingCount(): Promise<number> {
  await requirePermission("admin:view");
  const row = await get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'",
  );
  return row?.n ?? 0;
}
