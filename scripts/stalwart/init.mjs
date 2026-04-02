#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { buildStalwartConfig } from "./config.mjs";
import { inspectNetworkViaSocket, resolveNetworkName } from "./proxy-network.mjs";

const configPath = process.env.STALWART_CONFIG_PATH || "/opt/stalwart/etc/config.toml";
const configDir = configPath.slice(0, configPath.lastIndexOf("/"));

async function maybeAutodetectProxyTrustedNetworks() {
  if (process.env.STALWART_PROXY_TRUSTED_NETWORKS) {
    return;
  }

  if (process.env.STALWART_PROXY_AUTODETECT !== "true") {
    return;
  }

  const networkName = resolveNetworkName({ network: process.env.STALWART_TRAEFIK_DOCKER_NETWORK });
  const trustedNetworks = await inspectNetworkViaSocket(networkName);
  process.env.STALWART_PROXY_TRUSTED_NETWORKS = trustedNetworks;
  console.log(`Auto-detected STALWART_PROXY_TRUSTED_NETWORKS=${trustedNetworks} from Docker network ${networkName}`);
}

await maybeAutodetectProxyTrustedNetworks();
await mkdir(configDir, { recursive: true });
await writeFile(configPath, buildStalwartConfig(process.env), "utf8");
console.log(`Wrote Stalwart config to ${configPath}`);
