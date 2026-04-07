import { buildStalwartConfig } from "./scripts/stalwart/config.mjs";

const mockEnv = {
  STALWART_HOSTNAME: "stalwart.finueva.com",
  STALWART_HTTP_CORS_ALLOWED_ORIGINS: "http://localhost:8080,https://webmail.finueva.com",
  STALWART_HTTP_USE_X_FORWARDED: "true"
};

try {
  const config = buildStalwartConfig(mockEnv);
  console.log(config);
} catch (e) {
  console.error(e);
}
