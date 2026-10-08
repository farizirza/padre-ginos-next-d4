"use client";

import { formatPrice } from "@/lib/format";

export function LiveProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useLive() {
  return {
    now: null,
    pending: null,
    checkedAt: null,
    formatPrice,
  };
}
