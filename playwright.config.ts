import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:5173",
    headless: true,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox", "--use-fake-device-for-media-stream"],
    },
  },
  webServer: [
    {
      command: "npm run preview -- --local --ip 127.0.0.1 --port 8787",
      url: "http://127.0.0.1:8787/api/health",
      reuseExistingServer: !process.env.CI,
      env: {
        WRANGLER_SEND_METRICS: "false",
        WRANGLER_LOG_PATH: "/tmp/lasach-test-wrangler.log",
      },
    },
    {
      command: "npm run dev -- --port 5173",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI,
    },
  ],
  reporter: "list",
});
