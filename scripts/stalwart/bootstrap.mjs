#!/usr/bin/env node
// Explicit first-install operation. Stalwart refuses an already initialized store.
import { readFile } from "node:fs/promises";

if (process.argv[2] !== "--new-install") {
  throw new Error("First install only: node /scripts/bootstrap.mjs --new-install");
}
if (!process.env.STALWART_ADMIN_PASSWORD) throw new Error("STALWART_ADMIN_PASSWORD is required");
const config = JSON.parse(await readFile(`${process.env.STALWART_CONFIG_DIR || "/etc/stalwart"}/bootstrap.json`, "utf8"));
const base = (process.env.STALWART_API_URL || "http://stalwart:8080").replace(/\/$/, "");
const response = await fetch(`${base}/jmap/`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Basic " + Buffer.from(`${process.env.STALWART_ADMIN_USER || "admin"}:${process.env.STALWART_ADMIN_PASSWORD}`).toString("base64"),
  },
  body: JSON.stringify({ using: ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"], methodCalls: [
    ["x:Bootstrap/set", { update: { singleton: config } }, "bootstrap"],
  ] }),
  signal: AbortSignal.timeout(120000),
});
if (!response.ok) throw new Error(`Bootstrap failed: HTTP ${response.status}`);
const [method, result] = (await response.json()).methodResponses?.[0] || [];
if (method !== "x:Bootstrap/set" || !Object.hasOwn(result.updated || {}, "singleton")) {
  throw new Error(`Bootstrap failed: ${JSON.stringify(result.notUpdated || result)}`);
}
// Do not print the generated administrator password returned by the server.
console.log("Stalwart initialized. Restart Stalwart, then run /scripts/apply.mjs.");
