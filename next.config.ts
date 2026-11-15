import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (local dev database) and mammoth (.docx parser) must stay as plain
  // Node packages instead of being bundled.
  serverExternalPackages: ["@electric-sql/pglite", "mammoth"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
