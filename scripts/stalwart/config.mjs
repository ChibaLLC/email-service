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

  return `[server]
hostname = "${hostname}"

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
`;
}
