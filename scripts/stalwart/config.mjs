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
  const hostname = envValue(env, "STALWART_HOSTNAME", "mail.example.com");
  return {
    serverHostname: hostname,
    defaultDomain: envValue(env, "STALWART_DEFAULT_DOMAIN", defaultDomain(hostname)),
    requestTlsCertificate: envBoolean(env, "STALWART_ACME_ENABLED", false),
    generateDkimKeys: true,
    dataStore: buildDatastore(env),
    blobStore: {
      "@type": "S3Compatible",
      bucket: envValue(env, "STALWART_MINIO_BUCKET", "stalwart"),
      region: envValue(env, "STALWART_MINIO_REGION", "us-east-1"),
      accessKey: envValue(env, "STALWART_MINIO_ROOT_USER", "stalwart"),
      secretKey: secretEnv("STALWART_MINIO_ROOT_PASSWORD"),
      endpoint: envValue(env, "STALWART_MINIO_ENDPOINT", "http://stalwart-minio:9000"),
      keyPrefix: "stalwart/",
    },
    searchStore: { "@type": "Default" },
    inMemoryStore: {
      "@type": "Redis",
      urls: [`redis://:${envValue(env, "STALWART_REDIS_PASSWORD", "stalwart")}@stalwart-redis:6379/0`],
    },
    directory: { "@type": "Internal" },
    dnsServer: { "@type": "Manual" },
  };
}

function buildListener(env, name, bind, protocol, useImplicitTls = false) {
  const listener = { name, bind: [bind], protocol };
  const trustedNetworks = parseList(env.STALWART_PROXY_TRUSTED_NETWORKS);

  if (trustedNetworks.length > 0 && ["smtp", "submissions", "imaptls", "https"].includes(name)) {
    listener.overrideProxyTrustedNetworks = trustedNetworks;
  }

  if (useImplicitTls) {
    listener.useImplicitTls = true;
  }

  return listener;
}

function buildAcmeProvider(env, hostname) {
  const challenge = envValue(env, "STALWART_ACME_CHALLENGE", "tls-alpn-01");
  const challengeTypes = {
    "tls-alpn-01": "TlsAlpn01",
    "http-01": "Http01",
    "dns-01": "Dns01",
  };

  if (challenge === "dns-01" && !envValue(env, "STALWART_ACME_DNS_PROVIDER")) {
    throw new Error(
      "STALWART_ACME_CHALLENGE is dns-01 but STALWART_ACME_DNS_PROVIDER is not set. " +
        "Set it to 'cloudflare' or 'rfc2136-tsig'.",
    );
  }

  return {
    directory: envValue(env, "STALWART_ACME_DIRECTORY", "https://acme-v02.api.letsencrypt.org/directory"),
    challengeType: challengeTypes[challenge] || challenge,
    contact: parseList(env.STALWART_ACME_CONTACT).length > 0
      ? parseList(env.STALWART_ACME_CONTACT)
      : [`postmaster@${defaultDomain(hostname)}`],
    domains: parseList(env.STALWART_ACME_DOMAINS).length > 0 ? parseList(env.STALWART_ACME_DOMAINS) : [hostname],
    renewBefore: envValue(env, "STALWART_ACME_RENEW_BEFORE", "30d"),
    default: envBoolean(env, "STALWART_ACME_DEFAULT", true),
  };
}

function buildApplyPlan(env) {
  const hostname = envValue(env, "STALWART_HOSTNAME", "mail.example.com");
  const corsOrigins = parseList(env.STALWART_HTTP_CORS_ALLOWED_ORIGINS);
  const responseHeaders = corsOrigins.length > 0
    ? {
        "Access-Control-Allow-Origin": corsOrigins[0],
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS, DELETE, PUT",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
        "Access-Control-Allow-Credentials": "true",
      }
    : {};

  const listeners = {
    smtp: buildListener(env, "smtp", "[::]:25", "smtp"),
    submission: buildListener(env, "submission", "[::]:587", "smtp"),
    submissions: buildListener(env, "submissions", "[::]:465", "smtp", true),
    imap: buildListener(env, "imap", "[::]:143", "imap"),
    imaptls: buildListener(env, "imaptls", "[::]:993", "imap", true),
    pop3: buildListener(env, "pop3", "[::]:110", "pop3"),
    pop3s: buildListener(env, "pop3s", "[::]:995", "pop3", true),
    sieve: buildListener(env, "sieve", "[::]:4190", "managesieve"),
    http: buildListener(env, "http", "[::]:8080", "http"),
    https: buildListener(env, "https", "[::]:443", "http", true),
  };

  const plan = [
    { "@type": "update", object: "Bootstrap", value: buildBootstrap(env) },
    { "@type": "destroy", object: "NetworkListener" },
    { "@type": "create", object: "NetworkListener", value: listeners },
    {
      "@type": "update",
      object: "Http",
      value: {
        usePermissiveCors: true,
        useXForwarded: envBoolean(env, "STALWART_HTTP_USE_X_FORWARDED", false),
        responseHeaders,
      },
    },
    { "@type": "update", object: "SystemSettings", value: { defaultHostname: hostname } },
  ];

  if (envBoolean(env, "STALWART_ACME_ENABLED", false)) {
    plan.push(
      { "@type": "destroy", object: "AcmeProvider" },
      { "@type": "create", object: "AcmeProvider", value: { letsencrypt: buildAcmeProvider(env, hostname) } },
    );
  }

  return plan;
}

export function buildStalwartArtifacts(env) {
  return {
    config: buildDatastore(env),
    bootstrap: buildBootstrap(env),
    applyPlan: buildApplyPlan(env),
  };
}
