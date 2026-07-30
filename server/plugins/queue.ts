import { startEmailWorker } from "../queue/email.worker";

export default defineNitroPlugin(() => {
  if (import.meta.prerender) return;
  startEmailWorker();
  console.log("[plugin:queue] Email queue worker initialized");
});
