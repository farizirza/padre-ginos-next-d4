import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Day 4: automatic memoization (replaces hand-written memo/useMemo/useCallback)
  reactCompiler: true,
  experimental: {
    // Day 3: unauthorized() → 401 page, forbidden() → 403 page
    authInterrupts: true,
  },
};

export default nextConfig;