#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { buildStalwartConfig } from "./config.mjs";

const configPath = process.env.STALWART_CONFIG_PATH || "/opt/stalwart/etc/config.toml";
const configDir = configPath.slice(0, configPath.lastIndexOf("/"));

await mkdir(configDir, { recursive: true });
await writeFile(configPath, buildStalwartConfig(process.env), "utf8");
console.log(`Wrote Stalwart config to ${configPath}`);
