const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");

module.exports = (phase) => {
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    reactStrictMode: true,
    // Keep dev and prod build outputs separate to avoid stale asset 404s.
    // This prevents `next build` from clobbering files used by `next dev`.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    experimental: {
      serverComponentsExternalPackages: ["openai"],
    },
  };

  return nextConfig;
};
