import { consola } from "consola";
import { isWorkerd } from "std-env";

export default defineLazyEventHandler(() => {
  const console = consola.withTag("visitor.log");
  return defineEventHandler((context) => {
    if (!isWorkerd) {
      console.info(`[${context.node.req.method}]   ${context.node.req.url}`);
    }
  });
});
