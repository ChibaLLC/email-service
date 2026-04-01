#!/usr/bin/env node

import { execSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildListmonkConfig, buildListmonkPreview } from "./listmonk/config.mjs";
import { ensureEnvFile, loadEnvFile } from "./listmonk/env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ENV_FILE = resolve(ROOT, ".env");
const ENV_EXAMPLE = resolve(ROOT, ".env.example");
const LISTMONK_CONFIG_DIR = resolve(ROOT, "docker/listmonk/config");
const LISTMONK_UPLOADS_DIR = resolve(ROOT, "docker/listmonk/uploads");
const LISTMONK_CONFIG_FILE = resolve(LISTMONK_CONFIG_DIR, "config.toml");
const PROJECT_NAME = "email-service-dev";

function usage() {
  console.error("Usage: node scripts/listmonk.mjs [prepare|preview|up|down|reset] [--force]");
}

function run(command) {
  execSync(command, { cwd: ROOT, stdio: "inherit" });
}

function compose(args) {
  run(`docker compose -f "${resolve(ROOT, "docker-compose.dev.yml")}" -f "${resolve(ROOT, "docker-compose.listmonk.yml")}" -p ${PROJECT_NAME} --env-file "${ENV_FILE}" ${args}`);
}

async function loadListmonkEnv() {
  const createdEnv = await ensureEnvFile(ENV_FILE, ENV_EXAMPLE);
  if (createdEnv) {
    console.log("Created .env from .env.example");
  }

  const parsed = await loadEnvFile(ENV_FILE);
  return { ...process.env, ...parsed };
}

async function ensureListmonkArtifacts({ preview = false } = {}) {
  const env = await loadListmonkEnv();

  if (preview) {
    process.stdout.write(`${JSON.stringify(buildListmonkPreview(env), null, 2)}\n\n`);
    process.stdout.write(buildListmonkConfig(env));
    return;
  }

  await mkdir(LISTMONK_CONFIG_DIR, { recursive: true });
  await mkdir(LISTMONK_UPLOADS_DIR, { recursive: true });
  await writeFile(LISTMONK_CONFIG_FILE, buildListmonkConfig(env), "utf8");
  console.log(`Generated Listmonk config at ${LISTMONK_CONFIG_FILE}`);
}

async function main() {
  const [action = "prepare"] = process.argv.slice(2);

  try {
    switch (action) {
      case "prepare":
        await ensureListmonkArtifacts();
        break;
      case "preview":
        await ensureListmonkArtifacts({ preview: true });
        break;
      case "up":
        await ensureListmonkArtifacts();
        compose("up -d --wait");
        break;
      case "down":
        await loadListmonkEnv();
        compose("down");
        break;
      case "reset":
        await ensureListmonkArtifacts();
        compose("down -v");
        compose("up -d --wait");
        break;
      default:
        usage();
        process.exit(1);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

await main();