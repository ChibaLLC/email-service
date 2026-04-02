#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { EOL } from "node:os";
import { execFile } from "node:child_process";
import http from "node:http";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const options = {
    envFile: null,
    format: "env",
    network: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--env-file") {
      options.envFile = argv[index + 1] || null;
      index += 1;
      continue;
    }

    if (arg === "--format") {
      options.format = argv[index + 1] || "env";
      index += 1;
      continue;
    }

    if (arg === "--network") {
      options.network = argv[index + 1] || null;
      index += 1;
      continue;
    }
  }

  return options;
}

export function resolveNetworkName(options = {}) {
  return (
    options.network ||
    process.env.STALWART_TRAEFIK_DOCKER_NETWORK ||
    `${process.env.COMPOSE_PROJECT_NAME || "email-service"}_default`
  );
}

function formatOutput(format, networkName, trustedNetworks) {
  if (format === "value") {
    return trustedNetworks;
  }

  if (format === "json") {
    return JSON.stringify({ network: networkName, trustedNetworks }, null, 2);
  }

  return `STALWART_PROXY_TRUSTED_NETWORKS=${trustedNetworks}`;
}

function extractSubnets(details, networkName) {
  const network = Array.isArray(details) ? details[0] : details;
  const configs = network?.IPAM?.Config || [];
  const subnets = configs.map((config) => config?.Subnet).filter(Boolean);

  if (subnets.length === 0) {
    throw new Error(`No subnet found for Docker network \"${networkName}\".`);
  }

  return subnets.join(",");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function dockerSocketRequest(path, socketPath) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        socketPath,
        path,
        method: "GET",
      },
      (response) => {
        let data = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`Docker API returned ${response.statusCode} for ${path}.`));
            return;
          }
          resolve(data);
        });
      },
    );

    request.on("error", reject);
    request.end();
  });
}

async function inspectNetwork(networkName) {
  const { stdout } = await execFileAsync("docker", ["network", "inspect", networkName], {
    windowsHide: true,
  });
  const details = JSON.parse(stdout);

  return extractSubnets(details, networkName);
}

export async function inspectNetworkViaSocket(
  networkName,
  socketPath = process.env.STALWART_DOCKER_SOCKET_PATH || "/var/run/docker.sock",
) {
  const path = `/networks/${encodeURIComponent(networkName)}`;
  const body = await dockerSocketRequest(path, socketPath);

  return extractSubnets(JSON.parse(body), networkName);
}

export async function inspectContainerNetworksViaSocket(
  containerId = process.env.HOSTNAME,
  socketPath = process.env.STALWART_DOCKER_SOCKET_PATH || "/var/run/docker.sock",
) {
  if (!containerId) {
    throw new Error("Current container id is unavailable. Set HOSTNAME or provide an explicit Traefik Docker network.");
  }

  const path = `/containers/${encodeURIComponent(containerId)}/json`;
  const body = await dockerSocketRequest(path, socketPath);
  const details = JSON.parse(body);
  const networks = Object.keys(details?.NetworkSettings?.Networks || {});

  if (networks.length === 0) {
    throw new Error(`No attached Docker networks found for container \"${containerId}\".`);
  }

  const subnetGroups = await Promise.all(
    networks.map((networkName) => inspectNetworkViaSocket(networkName, socketPath)),
  );
  const trustedNetworks = unique(subnetGroups.flatMap((group) => group.split(",").map((item) => item.trim()))).join(
    ",",
  );

  return {
    containerId,
    networkNames: networks,
    trustedNetworks,
  };
}

async function updateEnvFile(envFile, assignment) {
  const current = await readFile(envFile, "utf8");
  const lines = current.split(/\r?\n/);
  const key = assignment.slice(0, assignment.indexOf("="));
  const lineIndex = lines.findIndex((line) => line.startsWith(`${key}=`));

  if (lineIndex >= 0) {
    lines[lineIndex] = assignment;
  } else {
    lines.push(assignment);
  }

  const next = `${lines.join(EOL)}${EOL}`;
  await writeFile(envFile, next, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const networkName = resolveNetworkName(options);
  const trustedNetworks = await inspectNetwork(networkName);
  const assignment = `STALWART_PROXY_TRUSTED_NETWORKS=${trustedNetworks}`;

  if (options.envFile) {
    await updateEnvFile(options.envFile, assignment);
    console.log(`Updated ${options.envFile} with ${assignment}`);
    return;
  }

  console.log(formatOutput(options.format, networkName, trustedNetworks));
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to resolve Stalwart proxy trusted networks: ${message}`);
    process.exitCode = 1;
  });
}
