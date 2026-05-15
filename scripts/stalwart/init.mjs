#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { buildStalwartArtifacts } from "./config.mjs";
import { inspectContainerNetworksViaSocket, inspectNetworkViaSocket, resolveNetworkName } from "./proxy-network.mjs";

const configDir = process.env.STALWART_CONFIG_DIR || "/etc/stalwart";

async function maybeAutodetectProxyTrustedNetworks() {
  if (process.env.STALWART_PROXY_TRUSTED_NETWORKS) {
    return;
  }

  if (process.env.STALWART_PROXY_AUTODETECT !== "true") {
    return;
  }

  if (process.env.STALWART_TRAEFIK_DOCKER_NETWORK) {
    const networkName = resolveNetworkName({ network: process.env.STALWART_TRAEFIK_DOCKER_NETWORK });
    const trustedNetworks = await inspectNetworkViaSocket(networkName);
    process.env.STALWART_PROXY_TRUSTED_NETWORKS = trustedNetworks;
    console.log(`Auto-detected STALWART_PROXY_TRUSTED_NETWORKS=${trustedNetworks} from Docker network ${networkName}`);
    return;
  }

  const { networkNames, trustedNetworks } = await inspectContainerNetworksViaSocket();
  process.env.STALWART_PROXY_TRUSTED_NETWORKS = trustedNetworks;
  console.log(
    `Auto-detected STALWART_PROXY_TRUSTED_NETWORKS=${trustedNetworks} from attached Docker networks ${networkNames.join(", ")}`,
  );
}

await maybeAutodetectProxyTrustedNetworks();
await mkdir(configDir, { recursive: true });
const artifacts = buildStalwartArtifacts(process.env);
await writeFile(`${configDir}/config.json`, `${JSON.stringify(artifacts.config, null, 2)}\n`, "utf8");
await writeFile(`${configDir}/bootstrap.json`, `${JSON.stringify(artifacts.bootstrap, null, 2)}\n`, "utf8");
await writeFile(
  `${configDir}/apply-plan.ndjson`,
  `${artifacts.applyPlan.map((item) => JSON.stringify(item)).join("\n")}\n`,
  "utf8",
);
console.log(`Wrote Stalwart config, bootstrap, and apply plan to ${configDir}`);
