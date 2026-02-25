import { db, schema } from "../../database";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "Key ID is required" });
  }

  const [existing] = await db.select().from(schema.apiKeys).where(eq(schema.apiKeys.id, id)).limit(1);

  if (!existing) {
    throw createError({ statusCode: 404, message: "API key not found" });
  }

  await db.update(schema.apiKeys).set({ active: false }).where(eq(schema.apiKeys.id, id));

  return { success: true, message: "API key revoked" };
});
