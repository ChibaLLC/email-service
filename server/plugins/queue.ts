import { startEmailWorker } from "../queue/email.worker";

export default defineNitroPlugin(() => {
  startEmailWorker();
  console.log("[plugin:queue] Email queue worker initialized");
});
