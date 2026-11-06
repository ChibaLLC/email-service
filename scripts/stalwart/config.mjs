import { readFileSync } from "node:fs";

function envValue(env, name, defaultValue = "") {
  const value = env[name];
  return value === undefined || value === "" ? defaultValue : value;
}

function envBoolean(env, name, defaultValue = false) {
  return ["1", "true", "yes", "on"].includes(envValue(env, name, defaultValue ? "true" : "false").toLowerCase());
}

function parseList(value) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function secretEnv(name) {
  return { "@type": "EnvironmentVariable", variableName: name };
}

function defaultDomain(hostname) {
  const [, domain] = hostname.split(/\.(.+)/);
  return domain || hostname;
}

function serverHostname(env) {
  const hostname = envValue(env, "STALWART_HOSTNAME", "mail.example.com");
  if (!hostname.includes(".") || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(hostname)) {
    throw new Error("STALWART_HOSTNAME must be a public DNS hostname, without a scheme or port");
  }
  return hostname;
}

function buildDatastore(env) {
  return {
    "@type": "PostgreSql",
    host: "stalwart-db",
    port: 5432,
    database: envValue(env, "STALWART_DB_NAME", "stalwart"),
    authUsername: envValue(env, "STALWART_DB_USER", "stalwart"),
    authSecret: secretEnv("STALWART_DB_PASSWORD"),
    poolMaxConnections: 10,
  };
}

function buildBootstrap(env) {
  const hostname = serverHostname(env);
  return {
    defaultHostname: hostname,
    defaultDomain: envValue(env, "STALWART_DEFAULT_DOMAIN", defaultDomain(hostname)),
    requestTlsCertificate: envBoolean(env, "STALWART_ACME_ENABLED", false),
    generateDkimKeys: true,
    dataStore: buildDatastore(env),
    blobStore: {
      "@type": "S3",
      bucket: envValue(env, "STALWART_S3_BUCKET", "stalwart"),
      region: { "@type": "Custom", region: envValue(env, "STALWART_S3_REGION", "garage"), url: envValue(env, "STALWART_S3_ENDPOINT", "http://stalwart-garage:3900") },
      accessKeyId: { "@type": "Value", value: envValue(env, "STALWART_S3_ACCESS_KEY") || readFileSync(envValue(env, "STALWART_S3_ACCESS_KEY_FILE", "/etc/stalwart-s3/access-key"), "utf8").trim() },
      secretKey: { "@type": "File", filePath: envValue(env, "STALWART_S3_SECRET_KEY_FILE", "/etc/stalwart-s3/secret-key") },
      keyPrefix: "stalwart/",
    },
    searchStore: { "@type": "Default" },
    inMemoryStore: {
      "@type": "Redis",
      url: `redis://:${encodeURIComponent(envValue(env, "STALWART_REDIS_PASSWORD", "stalwart"))}@stalwart-redis:6379/0`,
    },
    directory: { "@type": "Internal" },
    dnsServer: { "@type": "Manual" },
  };
}

export function buildApplyPlan(env) {
  const hostname = serverHostname(env);
  const corsOrigins = parseList(env.STALWART_HTTP_CORS_ALLOWED_ORIGINS);
  if (corsOrigins.length > 1 || corsOrigins.includes("*")) {
    throw new Error("Set one explicit STALWART_HTTP_CORS_ALLOWED_ORIGINS origin; use STALWART_HTTP_PERMISSIVE_CORS for wildcard CORS");
  }
  if (corsOrigins.length) {
    const origin = new URL(corsOrigins[0]);
    if (!["https:", "http:"].includes(origin.protocol) || origin.origin !== corsOrigins[0]) {
      throw new Error("CORS origin must contain only the scheme, hostname and optional port");
    }
  }
  const responseHeaders = corsOrigins.length > 0
    ? {
        "Access-Control-Allow-Origin": corsOrigins[0],
        "Access-Control-Allow-Methods": "POST, GET, PATCH, PUT, DELETE, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-Requested-With",
        "Access-Control-Allow-Credentials": "true",
      }
    : {};

  const plan = [
    {
      "@type": "update",
      object: "Http",
      value: {
        usePermissiveCors: envBoolean(env, "STALWART_HTTP_PERMISSIVE_CORS", false),
        clientIpSource: envBoolean(env, "STALWART_HTTP_USE_X_FORWARDED", false) ? "xForwardedFor" : "peer",
        forwardedHops: 1,
        responseHeaders,
      },
    },
    { "@type": "update", object: "SystemSettings", value: { defaultHostname: hostname } },
    { "@type": "update", object: "MtaStageConnect", value: {
      hostname: { match: {}, else: `'${hostname}'` },
      smtpGreeting: { match: {}, else: `'${hostname} Stalwart ESMTP at your service'` },
    } },
  ];

  return plan;
}

export function buildStalwartArtifacts(env) {
  return {
    config: buildDatastore(env),
    bootstrap: buildBootstrap(env),
    applyPlan: buildApplyPlan(env),
  };
}
