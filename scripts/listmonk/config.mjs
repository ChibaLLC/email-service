function parsePort(value, name, fallback) {
  const normalized = value || fallback;
  const numeric = Number(normalized);

  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 65535) {
    throw new Error(`${name} must be a valid port number`);
  }

  return numeric;
}

export function buildListmonkConfig(env) {
  const appPort = parsePort(env.LISTMONK_APP_PORT, "LISTMONK_APP_PORT", "9000");
  const dbPort = parsePort(env.LISTMONK_DB_PORT, "LISTMONK_DB_PORT", "9432");
  const dbUser = env.LISTMONK_DB_USER || "listmonk";
  const dbPassword = env.LISTMONK_DB_PASSWORD || "listmonk";
  const dbName = env.LISTMONK_DB_NAME || "listmonk";

  return `[app]
address = "0.0.0.0:${appPort}"

[db]
host = "listmonk-db"
port = 5432
user = "${dbUser}"
password = "${dbPassword}"
database = "${dbName}"
ssl_mode = "disable"
max_open = 25
max_idle = 25
max_lifetime = "300s"
`;
}

export function buildListmonkPreview(env) {
  return {
    image: env.LISTMONK_IMAGE || "listmonk/listmonk:latest",
    appPort: Number(env.LISTMONK_APP_PORT || "9000"),
    databasePort: Number(env.LISTMONK_DB_PORT || "9432"),
    databaseUser: env.LISTMONK_DB_USER || "listmonk",
    databaseName: env.LISTMONK_DB_NAME || "listmonk",
    timezone: env.LISTMONK_TIMEZONE || "Etc/UTC",
    adminUserConfigured: Boolean(env.LISTMONK_ADMIN_USER),
    adminPasswordConfigured: Boolean(env.LISTMONK_ADMIN_PASSWORD),
  };
}