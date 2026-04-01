#!/usr/bin/env node

import { execSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPostalConfig, generateSigningKey } from "./postal/config.mjs";
import { ensureEnvFile, loadEnvFile } from "./postal/env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const ENV_FILE = resolve(ROOT, ".env");
const ENV_EXAMPLE = resolve(ROOT, ".env.example");
const POSTAL_CONFIG_DIR = resolve(ROOT, "docker/postal/config");
const POSTAL_CONFIG_FILE = resolve(POSTAL_CONFIG_DIR, "postal.yml");
const POSTAL_SIGNING_KEY_FILE = resolve(POSTAL_CONFIG_DIR, "signing.key");
const PROJECT_NAME = "email-service-dev";

function log(message) {
  console.log(message);
}

function usage() {
  console.error("Usage: node scripts/postal.mjs [prepare|preview|up|down|reset] [--force]");
}

function run(command) {
  execSync(command, { cwd: ROOT, stdio: "inherit" });
}

function compose(args) {
  run(`docker compose -f "${resolve(ROOT, "docker-compose.dev.yml")}" -f "${resolve(ROOT, "docker-compose.postal.yml")}" -p ${PROJECT_NAME} --env-file "${ENV_FILE}" ${args}`);
}

async function loadPostalEnv() {
  const createdEnv = await ensureEnvFile(ENV_FILE, ENV_EXAMPLE);
  if (createdEnv) {
    log("Created .env from .env.example");
  }

  const parsed = await loadEnvFile(ENV_FILE);
  return { ...process.env, ...parsed };
}

async function ensurePostalArtifacts({ force = false, preview = false } = {}) {
  const env = await loadPostalEnv();
  await mkdir(POSTAL_CONFIG_DIR, { recursive: true });

  if (!preview && (force || !existsSync(POSTAL_SIGNING_KEY_FILE))) {
    if (force && existsSync(POSTAL_SIGNING_KEY_FILE)) {
      await rm(POSTAL_SIGNING_KEY_FILE, { force: true });
    }

    await writeFile(POSTAL_SIGNING_KEY_FILE, generateSigningKey(), "utf8");
    log(`Generated Postal signing key at ${POSTAL_SIGNING_KEY_FILE}`);
  }

  const content = buildPostalConfig(env);

  if (preview) {
    process.stdout.write(content);
    return;
  }

  await writeFile(POSTAL_CONFIG_FILE, content, "utf8");
  log(`Generated Postal config at ${POSTAL_CONFIG_FILE}`);
}

async function main() {
  const [action = "prepare", ...rest] = process.argv.slice(2);
  const force = rest.includes("--force");

  try {
    switch (action) {
      case "prepare":
        await ensurePostalArtifacts({ force });
        break;
      case "preview":
        await ensurePostalArtifacts({ preview: true });
        break;
      case "up":
        await ensurePostalArtifacts({ force });
        compose("up -d --wait");
        break;
      case "down":
        await loadPostalEnv();
        compose("down");
        break;
      case "reset":
        await ensurePostalArtifacts({ force });
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