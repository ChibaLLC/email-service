import { copyFile, readFile } from "node:fs/promises";

export async function ensureEnvFile(envFile, envExample) {
  try {
    await readFile(envFile, "utf8");
  } catch {
    await copyFile(envExample, envFile);
    return true;
  }

  return false;
}

export async function loadEnvFile(envFile) {
  const content = await readFile(envFile, "utf8");
  const parsed = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    parsed[key] = rawValue.replace(/^(["'])(.*)\1$/, "$2");
  }

  return parsed;
}