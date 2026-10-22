import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep an App Store build isolated from a locally running `next dev` server.
  distDir: process.env.PKT_NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["better-sqlite3"],
  webpack: (config) => {
    // @dnd-kit/state는 CommonJS main과 ESM module을 함께 제공한다.
    // Webpack 개발 모드에서는 main을 고르면 named export를 찾지 못하므로
    // untracked 등을 내보내는 ESM 진입점을 명시한다.
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@dnd-kit/state$": path.join(process.cwd(), "node_modules/@dnd-kit/state/dist/index.mjs"),
    };
    return config;
  },
};

export default nextConfig;
