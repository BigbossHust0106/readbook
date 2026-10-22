import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
export default defineConfig({
  plugins: [
    react(),
    {
      name: "precache-application-shell",
      apply: "build",
      async closeBundle() {
        const assets = (await readdir("dist/assets"))
          .filter((f) => /\.(m?js|css|woff2?)$/.test(f))
          .map((f) => `/assets/${f}`)
          .sort();
        const hash = createHash("sha256")
          .update(assets.join("|"))
          .digest("hex")
          .slice(0, 12);
        const source = await readFile("public/sw.js", "utf8");
        await writeFile(
          "dist/sw.js",
          source
            .replace(
              /const CACHE\s*=\s*[\'\"]lasach-shell-v1[\'\"];?/,
              `const CACHE='lasach-shell-${hash}';`,
            )
            .replace(
              /const PRECACHE\s*=\s*\[[\s\S]*?\];/,
              `const PRECACHE=${JSON.stringify(["/", "/icon.svg", "/icons/app-192.png", "/icons/app-512.png", "/icons/apple-touch-icon.png", "/manifest.webmanifest", ...assets])};`,
            ),
        );
      },
    },
  ],
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
});
