#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────
// dev.mjs — Cross-platform dev server orchestration
//
//   pnpm dev:start          Start Docker infra + migrations + Nuxt
//   pnpm dev:stop           Stop Docker containers
//   pnpm dev:reset          Destroy volumes, restart, re-migrate
//
// Gracefully shuts down on Ctrl-C.
// ──────────────────────────────────────────────────────────────

import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const COMPOSE_FILE = resolve(ROOT, "docker-compose.dev.yml");
const ENV_FILE = resolve(ROOT, ".env");
const ENV_EXAMPLE = resolve(ROOT, ".env.example");
const PROJECT_NAME = "email-service-dev";

// ── Colors ──
const c = {
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

const log = (msg) => console.log(`${c.cyan("▸")} ${msg}`);
const ok = (msg) => console.log(`${c.green("✔")} ${msg}`);
const warn = (msg) => console.log(`${c.yellow("⚠")} ${msg}`);
const err = (msg) => console.error(`${c.red("✖")} ${msg}`);

// ── Defaults ──
const DEFAULTS = {
  POSTGRES_USER: "email_service",
  POSTGRES_PASSWORD: "email_service_pass",
  POSTGRES_DB: "email_service",
  DATABASE_URL: "postgresql://email_service:email_service_pass@localhost:5432/email_service",
  REDIS_URL: "redis://localhost:6379",
};

// ──────────────────────────────────────────────────────────────
// .env helpers
// ──────────────────────────────────────────────────────────────

function ensureEnv() {
  if (!existsSync(ENV_FILE)) {
    warn(".env not found");
    if (existsSync(ENV_EXAMPLE)) {
      copyFileSync(ENV_EXAMPLE, ENV_FILE);
      ok("Created .env from .env.example");
    } else {
      writeFileSync(ENV_FILE, "", "utf-8");
      ok("Created empty .env");
    }
  }

  let content = readFileSync(ENV_FILE, "utf-8");
  let modified = false;

  for (const [key, value] of Object.entries(DEFAULTS)) {
    const regex = new RegExp(`^${key}=`, "m");
    if (!regex.test(content)) {
      content += `\n${key}=${value}`;
      log(`Added ${key} to .env`);
      modified = true;
    }
  }

  if (modified) {
    writeFileSync(ENV_FILE, content.trimStart() + "\n", "utf-8");
  }

  // Load into process.env
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim();
      process.env[k] = v;
    }
  }
}

// ──────────────────────────────────────────────────────────────
// Shell helpers
// ──────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });
    return true;
  } catch {
    return false;
  }
}

function compose(args) {
  return run(`docker compose -f "${COMPOSE_FILE}" -p ${PROJECT_NAME} --env-file "${ENV_FILE}" ${args}`);
}

// ──────────────────────────────────────────────────────────────
// Actions
// ──────────────────────────────────────────────────────────────

function startInfra() {
  log("Starting Postgres + Redis containers...");
  if (!compose("up -d --wait")) {
    err("Failed to start Docker containers. Is Docker running?");
    process.exit(1);
  }
  ok("Postgres is ready on port " + (process.env.POSTGRES_PORT || "5432"));
  ok("Redis is ready on port " + (process.env.REDIS_PORT || "6379"));
}

function stopInfra() {
  log("Stopping containers...");
  compose("down");
  ok("Containers stopped");
}

function resetInfra() {
  warn("Destroying containers and volumes...");
  compose("down -v");
  ok("Volumes destroyed");
}

function runMigrations() {
  log("Running database migrations...");
  if (run("npx drizzle-kit migrate")) {
    ok("Migrations complete");
  } else {
    warn("Migration failed — try: pnpm db:generate && pnpm db:migrate");
  }
}

/** @type {import('node:child_process').ChildProcess | null} */
let nuxtProcess = null;

function startNuxt() {
  log("Starting Nuxt dev server...");
  nuxtProcess = spawn("npx", ["nuxt", "dev"], {
    stdio: "inherit",
    cwd: ROOT,
    shell: true,
  });

  nuxtProcess.on("error", (e) => err(`Nuxt failed to start: ${e.message}`));
  nuxtProcess.on("exit", (code) => {
    nuxtProcess = null;
    if (code && code !== 0) warn(`Nuxt exited with code ${code}`);
  });
}

// ──────────────────────────────────────────────────────────────
// Graceful shutdown
// ──────────────────────────────────────────────────────────────

let shuttingDown = false;

function cleanup() {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log("");
  log("Shutting down...");

  if (nuxtProcess) {
    log("Stopping Nuxt dev server...");
    nuxtProcess.kill("SIGTERM");
    nuxtProcess = null;
    ok("Nuxt stopped");
  }

  stopInfra();
  ok("Dev environment shut down cleanly");
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// ──────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────

function main() {
  const arg = process.argv[2];

  if (arg === "--help" || arg === "-h") {
    console.log(`
Usage: node scripts/dev.mjs [option]

  (no args)   Start Docker infra + DB migrations + Nuxt dev
  --stop      Stop Docker containers
  --reset     Destroy volumes, restart, re-migrate
  --help      Show this help
`);
    process.exit(0);
  }

  ensureEnv();

  if (arg === "--stop") {
    stopInfra();
    process.exit(0);
  }

  if (arg === "--reset") {
    resetInfra();
    startInfra();
    runMigrations();
    ok("Environment reset and ready");
    process.exit(0);
  }

  // Default: full start
  console.log("");
  console.log(c.cyan("╔══════════════════════════════════════╗"));
  console.log(c.cyan("║   📧  Email Service — Dev Server    ║"));
  console.log(c.cyan("╚══════════════════════════════════════╝"));
  console.log("");

  startInfra();
  runMigrations();
  startNuxt();

  console.log("");
  ok("Dev environment is running!");
  log("Press Ctrl+C to stop everything");
  console.log("");
}

main();
