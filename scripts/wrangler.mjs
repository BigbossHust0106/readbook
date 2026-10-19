import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
const local = resolve(".wrangler");
mkdirSync(local, { recursive: true });
const env = {
  ...process.env,
  WRANGLER_LOG_PATH:
    process.env.WRANGLER_LOG_PATH || join(local, "runtime.log"),
  WRANGLER_SEND_METRICS: process.env.WRANGLER_SEND_METRICS || "false",
};
// Preserve configured auth; use a writable project path when the default config does not exist.
if (
  !env.XDG_CONFIG_HOME &&
  !existsSync(join(homedir(), ".config", ".wrangler"))
)
  env.XDG_CONFIG_HOME = join(local, "config");
const child = spawn(
  process.execPath,
  [
    fileURLToPath(
      new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
    ),
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", env },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", () => {
  console.error("Không khởi chạy được Wrangler. Chạy npm ci trước.");
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
