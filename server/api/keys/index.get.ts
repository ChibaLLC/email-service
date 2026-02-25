import { db, schema } from "../../database";
import { desc, eq } from "drizzle-orm";

export default defineEventHandler(async () => {
  const keys = await db
    .select({
      id: schema.apiKeys.id,
      keyPrefix: schema.apiKeys.keyPrefix,
      email: schema.apiKeys.email,
      name: schema.apiKeys.name,
      active: schema.apiKeys.active,
      createdAt: schema.apiKeys.createdAt,
      lastUsedAt: schema.apiKeys.lastUsedAt,
    })
    .from(schema.apiKeys)
    .orderBy(desc(schema.apiKeys.createdAt));

  return keys;
});
