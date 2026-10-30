import type { NextConfig } from "next";

// A static export: every page is rendered to HTML at build time from ../content/data,
// so the site has to be rebuilt to show a new day (SKILL.md, Step 4).
const nextConfig: NextConfig = {
  output: "export",
  // Emit out/<date>/index.html rather than out/<date>.html.
  trailingSlash: true,
  images: { unoptimized: true },
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
