import { validateSelectedEmailProviderConfig } from "../email/config";

export default defineNitroPlugin(() => {
  const config = validateSelectedEmailProviderConfig();
  console.log(`[plugin:email-config] Validated ${config.EMAIL_PROVIDER} email provider configuration`);
});