import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNavFallback } from "@/components/admin/AdminNav";
import AdminNavigation from "@/components/admin/AdminNavigation";
import NewOrdersBadge from "@/components/admin/NewOrdersBadge";
import SidebarUser from "@/components/admin/SidebarUser";
import FailureToggle from "@/components/FailureToggle";

export const metadata: Metadata = {
  title: "Padre Gino's — Dashboard",
};

// Wraps every /admin/* page. It stays mounted while you move between them.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-stone-100">
      <aside className="flex w-56 shrink-0 flex-col bg-ink text-white">
        <Link href="/admin" className="px-6 py-6">
          <span className="block text-xl font-black">Padre Gino&apos;s</span>
          <span className="text-xs font-medium text-white/60">
            Dashboard staf
          </span>
        </Link>
        {/* The user (cookie) and usePathname() are both request data */}
        <Suspense fallback={<AdminNavFallback />}>
          <AdminNavigation />
        </Suspense>
        <NewOrdersBadge />
        <div className="mt-auto">
          <Suspense fallback={null}>
            <SidebarUser />
          </Suspense>
        </div>
        <div className="flex flex-col gap-3 px-6 py-5 text-sm text-white/70">
          <FailureToggle />
          <Link href="/" className="hover:text-white">
            ← Ke toko
          </Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">{children}</main>
    </div>
  );
}
