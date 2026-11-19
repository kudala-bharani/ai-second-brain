const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");

// Next 14 matches these patterns by substring. Keep query-history lightweight.
const embeddingRoutes = "/api/{query(?!-history),memories,memories/*,test-embedding}";
const nativeRuntime = "./node_modules/onnxruntime-node/bin/napi-v3";
const nativePlatform = `${nativeRuntime}/${process.platform}`;

module.exports = (phase) => {
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    reactStrictMode: true,
    // Keep dev and prod build outputs separate to avoid stale asset 404s.
    // This prevents `next build` from clobbering files used by `next dev`.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    experimental: {
      serverComponentsExternalPackages: ["openai", "onnxruntime-node"],
      outputFileTracingIncludes: {
        [embeddingRoutes]: [
          "./src/models/bge-small-en-v1.5/**/*",
          `${nativePlatform}/${process.arch}/**/*`,
        ],
      },
      outputFileTracingExcludes: {
        [embeddingRoutes]: [
          `${nativeRuntime}/!(${process.platform})/**/*`,
          `${nativePlatform}/!(${process.arch})/**/*`,
        ],
      },
    },
  };

  return nextConfig;
};
