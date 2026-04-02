#!/usr/bin/env node
// Container-side config generator for postal-config service.
// Called by docker-compose.postal.yml with the postal_config_data volume mounted at /config.
// Reuses buildPostalConfig and generateSigningKey from config.mjs — no logic is duplicated.

import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { buildPostalConfig, generateSigningKey } from "./config.mjs";

const configDir = process.env.POSTAL_CONFIG_DIR || "/config";
const keyPath = `${configDir}/signing.key`;
const configPath = `${configDir}/postal.yml`;

await mkdir(configDir, { recursive: true });

// Generate signing key only if not already present (idempotent).
const keyExists = await access(keyPath, constants.F_OK)
  .then(() => true)
  .catch(() => false);
if (!keyExists) {
  await writeFile(keyPath, generateSigningKey(), { mode: 0o600 });
  console.log(`Generated signing key at ${keyPath}`);
} else {
  console.log(`Signing key already exists at ${keyPath}, skipping`);
}

// Always regenerate postal.yml so POSTAL_* env changes are applied on restart.
const config = buildPostalConfig(process.env);
await writeFile(configPath, config, { mode: 0o640 });
console.log(`Wrote postal config to ${configPath}`);
