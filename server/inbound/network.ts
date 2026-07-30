import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { env } from "std-env";

export interface SafeWebhookDestination {
  url: URL;
  hostname: string;
  address?: string;
}

function privateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) return true;
  const [a, b] = octets as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function privateIp(address: string): boolean {
  if (isIP(address) === 4) return privateIpv4(address);
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return privateIpv4(normalized.slice(7));
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff")
  );
}

export async function assertSafeWebhookDestination(value: string): Promise<SafeWebhookDestination> {
  const url = new URL(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const privateNetworksAllowed = env.INBOUND_WEBHOOK_ALLOW_PRIVATE_NETWORKS === "true";
  if (url.protocol !== "https:" && !privateNetworksAllowed) {
    throw new Error("Inbound webhook URL must use HTTPS");
  }
  if (url.username || url.password) throw new Error("Inbound webhook URL must not contain credentials");
  if (privateNetworksAllowed) return { url, hostname };

  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Inbound webhook URL resolves to a private network");
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => privateIp(address))) {
    throw new Error("Inbound webhook URL resolves to a private network");
  }
  return { url, hostname, address: addresses[0]!.address };
}
