import { generateKeyPairSync, randomBytes } from "node:crypto";

const HOSTNAME_PATTERN = /^(?=.{1,253}$)(?!-)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.(?!-)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

function fail(message) {
  throw new Error(message);
}

function validateHostname(value, name) {
  if (!HOSTNAME_PATTERN.test(value)) {
    fail(`${name} must be a valid hostname`);
  }
}

export function generateSigningKey() {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: {
      type: "pkcs1",
      format: "pem",
    },
  });

  return privateKey;
}

export function generateSecretKey() {
  return randomBytes(64).toString("hex");
}

export function buildPostalDnsBlock(env) {
  const rawMxRecords = env.POSTAL_DNS_MX_RECORDS || "";
  const spfInclude = env.POSTAL_DNS_SPF_INCLUDE || "";
  const returnPathDomain = env.POSTAL_DNS_RETURN_PATH_DOMAIN || "";
  const routeDomain = env.POSTAL_DNS_ROUTE_DOMAIN || "";
  const trackDomain = env.POSTAL_DNS_TRACK_DOMAIN || "";

  const hasAnyDnsConfig = [rawMxRecords, spfInclude, returnPathDomain, routeDomain, trackDomain].some(Boolean);
  if (!hasAnyDnsConfig) {
    return "";
  }

  if (!rawMxRecords) fail("POSTAL_DNS_MX_RECORDS is required when configuring Postal DNS env values");
  if (!spfInclude) fail("POSTAL_DNS_SPF_INCLUDE is required when configuring Postal DNS env values");
  if (!returnPathDomain) fail("POSTAL_DNS_RETURN_PATH_DOMAIN is required when configuring Postal DNS env values");

  const mxRecords = rawMxRecords
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (mxRecords.length === 0) {
    fail("POSTAL_DNS_MX_RECORDS must contain at least one hostname");
  }

  for (const mxRecord of mxRecords) {
    validateHostname(mxRecord, `Invalid hostname in POSTAL_DNS_MX_RECORDS: ${mxRecord}`);
  }

  validateHostname(spfInclude, "POSTAL_DNS_SPF_INCLUDE");
  validateHostname(returnPathDomain, "POSTAL_DNS_RETURN_PATH_DOMAIN");
  if (routeDomain) validateHostname(routeDomain, "POSTAL_DNS_ROUTE_DOMAIN");
  if (trackDomain) validateHostname(trackDomain, "POSTAL_DNS_TRACK_DOMAIN");

  const lines = ["", "dns:", "  mx_records:"];
  for (const mxRecord of mxRecords) {
    lines.push(`    - ${mxRecord}`);
  }

  lines.push(`  spf_include: ${spfInclude}`);
  lines.push(`  return_path_domain: ${returnPathDomain}`);
  if (routeDomain) lines.push(`  route_domain: ${routeDomain}`);
  if (trackDomain) lines.push(`  track_domain: ${trackDomain}`);

  return `${lines.join("\n")}\n`;
}

export function buildPostalConfig(env) {
  const postalDbName = env.POSTAL_DB_NAME || "postal";
  const postalDbPassword = env.POSTAL_DB_ROOT_PASSWORD || "postal";
  const postalWebProtocol = env.POSTAL_WEB_PROTOCOL || "http";
  const postalWebHostname = env.POSTAL_WEB_HOSTNAME || `localhost:${env.POSTAL_WEB_PORT || "5000"}`;
  const postalSmtpHostname = env.POSTAL_SMTP_HOSTNAME || "localhost";
  const postalMessageDbPrefix = env.POSTAL_MESSAGE_DB_PREFIX || "postal";
  const postalRailsSecretKey = env.POSTAL_RAILS_SECRET_KEY || generateSecretKey();
  const postalDnsBlock = buildPostalDnsBlock(env);

  if (!["http", "https"].includes(postalWebProtocol)) {
    fail("POSTAL_WEB_PROTOCOL must be either http or https");
  }

  return `version: 2

postal:
  web_hostname: ${postalWebHostname}
  web_protocol: ${postalWebProtocol}
  smtp_hostname: ${postalSmtpHostname}

main_db:
  host: postal-db
  username: root
  password: ${postalDbPassword}
  database: ${postalDbName}

message_db:
  host: postal-db
  username: root
  password: ${postalDbPassword}
  prefix: ${postalMessageDbPrefix}

logging:
  rails_log_enabled: true
  highlighting_enabled: false

rails:
  environment: development
  secret_key: ${postalRailsSecretKey}
${postalDnsBlock}`;
}