#!/usr/bin/env node
// Apply only ordinary settings after completing the Stalwart setup wizard.
// Never initialize/reset the database, replace listeners, or migrate blob data.
import { buildApplyPlan } from "./config.mjs";

const env = process.env;
if (!env.STALWART_ADMIN_PASSWORD) throw new Error("STALWART_ADMIN_PASSWORD is required");
const base = (env.STALWART_API_URL || "http://stalwart:8080").replace(/\/$/, "");
const authorization = "Basic " + Buffer.from(`${env.STALWART_ADMIN_USER || "admin"}:${env.STALWART_ADMIN_PASSWORD}`).toString("base64");

async function call(method, args) {
  const response = await fetch(`${base}/jmap/`, {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ using: ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"], methodCalls: [[method, args, "apply"]] }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
  const [name, result] = (await response.json()).methodResponses?.[0] || [];
  if (name !== method || ["notCreated", "notUpdated", "notDestroyed"].some((key) => Object.keys(result?.[key] || {}).length)) {
    throw new Error(`${method} failed: ${JSON.stringify(result)}`);
  }
  return result;
}

const plan = buildApplyPlan(env);
const currentSettings = await call("x:SystemSettings/get", { ids: ["singleton"] });
const domains = (await call("x:Domain/get", { properties: ["id", "name"] })).list || [];
const configured = env.STALWART_DEFAULT_DOMAIN;
const domain = configured
  ? domains.find((item) => item.name === configured)
  : domains.find((item) => item.id === currentSettings.list?.[0]?.defaultDomainId) || (domains.length === 1 ? domains[0] : undefined);
if (!domain) throw new Error("Set STALWART_DEFAULT_DOMAIN to an existing Stalwart domain before applying settings");

for (const operation of plan) {
  const value = operation.value;
  if (operation.object === "Http") {
    const current = await call("x:Http/get", { ids: ["singleton"] });
    value.responseHeaders = { ...current.list?.[0]?.responseHeaders, ...value.responseHeaders };
  }
  if (operation.object === "SystemSettings") {
    value.defaultDomainId = domain.id;
  }
  await call(`x:${operation.object}/set`, { update: { singleton: value } });
  console.log(`Saved ${operation.object}`);
}

if (env.STALWART_ALLOWED_IP) {
  const allowed = await call("x:AllowedIp/get", {});
  if (!allowed.list?.some((item) => item.address === env.STALWART_ALLOWED_IP)) {
    await call("x:AllowedIp/set", { create: { proxy: { address: env.STALWART_ALLOWED_IP, reason: "Mail reverse proxy" } } });
  }
}
const result = await call("x:Action/set", { create: { reload: { "@type": "ReloadSettings" } } });
const warnings = result.created?.reload?.warnings;
if (warnings && Object.keys(warnings).length) console.warn("Reload warnings:", JSON.stringify(warnings));
console.log("Stalwart settings applied and reloaded");
