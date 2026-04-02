function parseList(value) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildStalwartConfig(env) {
  const dbName = env.STALWART_DB_NAME || "stalwart";
  const dbUser = env.STALWART_DB_USER || "stalwart";
  const dbPassword = env.STALWART_DB_PASSWORD || "stalwart";
  const redisPassword = env.STALWART_REDIS_PASSWORD || "stalwart";
  const minioBucket = env.STALWART_MINIO_BUCKET || "stalwart";
  const minioRegion = env.STALWART_MINIO_REGION || "us-east-1";
  const minioUser = env.STALWART_MINIO_ROOT_USER || "stalwart";
  const minioPassword = env.STALWART_MINIO_ROOT_PASSWORD || "stalwart-minio";
  const minioEndpoint = env.STALWART_MINIO_ENDPOINT || "http://stalwart-minio:9000";
  const hostname = env.STALWART_HOSTNAME || "mail.example.com";
  const adminUser = env.STALWART_ADMIN_USER || "admin";
  const adminPassword = env.STALWART_ADMIN_PASSWORD || "change-me-stalwart-admin";
  const acmeEnabled = env.STALWART_ACME_ENABLED === "true";
  const acmeDirectory = env.STALWART_ACME_DIRECTORY || "https://acme-v02.api.letsencrypt.org/directory";
  const acmeChallenge = env.STALWART_ACME_CHALLENGE || "tls-alpn-01";
  const acmeContacts = parseList(env.STALWART_ACME_CONTACT);
  const acmeDomains = parseList(env.STALWART_ACME_DOMAINS);
  const acmeCache = env.STALWART_ACME_CACHE || "%{BASE_PATH}%/etc/acme";
  const acmeRenewBefore = env.STALWART_ACME_RENEW_BEFORE || "30d";
  const acmeDefault = env.STALWART_ACME_DEFAULT !== "false";
  const proxyTrustedNetworks = parseList(env.STALWART_PROXY_TRUSTED_NETWORKS);
  const httpUseXForwarded = env.STALWART_HTTP_USE_X_FORWARDED === "true";
  const resolvedAcmeDomains = acmeDomains.length > 0 ? acmeDomains : [hostname];

  // DNS-01 provider settings
  const acmeDnsProvider = env.STALWART_ACME_DNS_PROVIDER || "";
  const acmeDnsPollingInterval = env.STALWART_ACME_DNS_POLLING_INTERVAL || "15s";
  const acmeDnsPropagationTimeout = env.STALWART_ACME_DNS_PROPAGATION_TIMEOUT || "1m";
  const acmeDnsTtl = env.STALWART_ACME_DNS_TTL || "5m";
  const acmeDnsOrigin = env.STALWART_ACME_DNS_ORIGIN || "";

  let dns01Config = "";
  if (acmeEnabled && acmeChallenge === "dns-01" && acmeDnsProvider) {
    const lines = [];
    lines.push(`provider = ${JSON.stringify(acmeDnsProvider)}`);
    lines.push(`polling-interval = ${JSON.stringify(acmeDnsPollingInterval)}`);
    lines.push(`propagation-timeout = ${JSON.stringify(acmeDnsPropagationTimeout)}`);
    lines.push(`ttl = ${JSON.stringify(acmeDnsTtl)}`);
    if (acmeDnsOrigin) {
      lines.push(`origin = ${JSON.stringify(acmeDnsOrigin)}`);
    }

    if (acmeDnsProvider === "cloudflare") {
      const cfSecret = env.STALWART_ACME_DNS_CF_SECRET || "";
      const cfEmail = env.STALWART_ACME_DNS_CF_EMAIL || "";
      const cfTimeout = env.STALWART_ACME_DNS_CF_TIMEOUT || "30s";
      if (cfSecret) lines.push(`secret = ${JSON.stringify(cfSecret)}`);
      if (cfEmail) lines.push(`email = ${JSON.stringify(cfEmail)}`);
      lines.push(`timeout = ${JSON.stringify(cfTimeout)}`);
    } else if (acmeDnsProvider === "rfc2136-tsig") {
      const rfcHost = env.STALWART_ACME_DNS_RFC_HOST || "";
      const rfcPort = env.STALWART_ACME_DNS_RFC_PORT || "53";
      const rfcProtocol = env.STALWART_ACME_DNS_RFC_PROTOCOL || "udp";
      const rfcAlgorithm = env.STALWART_ACME_DNS_RFC_ALGORITHM || "hmac-sha256";
      const rfcKey = env.STALWART_ACME_DNS_RFC_KEY || "";
      const rfcSecret = env.STALWART_ACME_DNS_RFC_SECRET || "";
      if (rfcHost) lines.push(`host = ${JSON.stringify(rfcHost)}`);
      lines.push(`port = ${parseInt(rfcPort, 10)}`);
      lines.push(`protocol = ${JSON.stringify(rfcProtocol)}`);
      lines.push(`tsig-algorithm = ${JSON.stringify(rfcAlgorithm)}`);
      if (rfcKey) lines.push(`key = ${JSON.stringify(rfcKey)}`);
      if (rfcSecret) lines.push(`secret = ${JSON.stringify(rfcSecret)}`);
    }

    dns01Config = "\n" + lines.join("\n") + "\n";
  }

  const acmeConfig = acmeEnabled
    ? `

[acme."letsencrypt"]
directory = ${JSON.stringify(acmeDirectory)}
challenge = ${JSON.stringify(acmeChallenge)}
${
  acmeContacts.length > 0
    ? `contact = ${JSON.stringify(acmeContacts)}
`
    : ""
}domains = ${JSON.stringify(resolvedAcmeDomains)}
cache = ${JSON.stringify(acmeCache)}
renew-before = ${JSON.stringify(acmeRenewBefore)}
default = ${acmeDefault}
${dns01Config}`
    : "";
  const httpConfig = httpUseXForwarded
    ? `

[http]
use-x-forwarded = true
`
    : "";
  const proxyConfig =
    proxyTrustedNetworks.length > 0
      ? `

[server.listener."smtp".proxy]
trusted-networks = ${JSON.stringify(proxyTrustedNetworks)}

[server.listener."submissions".proxy]
trusted-networks = ${JSON.stringify(proxyTrustedNetworks)}

[server.listener."imaptls".proxy]
trusted-networks = ${JSON.stringify(proxyTrustedNetworks)}

[server.listener."https".proxy]
trusted-networks = ${JSON.stringify(proxyTrustedNetworks)}
`
      : "";

  return `[server]
hostname = "${hostname}"

[server.listener."smtp"]
bind = ["[::]:25"]
protocol = "smtp"

[server.listener."submission"]
bind = ["[::]:587"]
protocol = "smtp"

[server.listener."submissions"]
bind = ["[::]:465"]
protocol = "smtp"
tls.implicit = true

[server.listener."imap"]
bind = ["[::]:143"]
protocol = "imap"

[server.listener."imaptls"]
bind = ["[::]:993"]
protocol = "imap"
tls.implicit = true

[server.listener."pop3"]
bind = ["[::]:110"]
protocol = "pop3"

[server.listener."pop3s"]
bind = ["[::]:995"]
protocol = "pop3"
tls.implicit = true

[server.listener."sieve"]
bind = ["[::]:4190"]
protocol = "managesieve"

[server.listener."http"]
bind = ["[::]:8080"]
protocol = "http"

[server.listener."https"]
bind = ["[::]:443"]
protocol = "http"
tls.implicit = true
${httpConfig}${proxyConfig}

[storage]
data = "postgresql"
blob = "minio"
fts = "postgresql"
lookup = "redis"
directory = "internal"

[store."postgresql"]
type = "postgresql"
host = "stalwart-db"
port = 5432
database = "${dbName}"
user = "${dbUser}"
password = "${dbPassword}"
timeout = "15s"

[store."postgresql".pool]
max-connections = 10

[store."minio"]
type = "s3"
bucket = "${minioBucket}"
region = "${minioRegion}"
access-key = "${minioUser}"
secret-key = "${minioPassword}"
endpoint = "${minioEndpoint}"
timeout = "30s"
key-prefix = "stalwart/"

[store."redis"]
type = "redis"
redis-type = "single"
urls = "redis://:${redisPassword}@stalwart-redis:6379/0"
timeout = "10s"

[directory."internal"]
type = "internal"
store = "postgresql"

[authentication.fallback-admin]
user = "${adminUser}"
secret = "${adminPassword}"
${acmeConfig}`;
}
