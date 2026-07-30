import { db, schema } from "../../database";
import { desc, eq } from "drizzle-orm";
import { getDashboardEmail, getDashboardRole, isAdminRole } from "../../settings/policy";

export default defineEventHandler(async (event) => {
  const email = getDashboardEmail(event);
  const { role } = await getDashboardRole(email);
  const query = db
    .select({
      id: schema.apiKeys.id,
      keyPrefix: schema.apiKeys.keyPrefix,
      email: schema.apiKeys.email,
      name: schema.apiKeys.name,
      active: schema.apiKeys.active,
      createdAt: schema.apiKeys.createdAt,
      lastUsedAt: schema.apiKeys.lastUsedAt,
    })
    .from(schema.apiKeys);
  const keys = await (isAdminRole(role) ? query : query.where(eq(schema.apiKeys.email, email))).orderBy(desc(schema.apiKeys.createdAt));

  return keys;
});
