import { consola } from "consola";
import { runInboundCycle } from "../inbound/service";

export default defineNitroPlugin((nitroApp) => {
  if (import.meta.prerender) return;
  const logger = consola.withTag("plugin:inbound-email");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  async function poll() {
    const intervalSeconds = await runInboundCycle().catch((error) => {
      logger.error("Unhandled inbound email poll error", error);
      return 30;
    });
    if (!stopped) timer = setTimeout(poll, intervalSeconds * 1_000);
  }

  timer = setTimeout(poll, 1_000);
  nitroApp.hooks.hook("close", () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  });
});
