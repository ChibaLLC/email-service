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
`;
}
