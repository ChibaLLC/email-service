import { db, schema } from "../../database";
import { desc } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const limit = Math.min(Number(query.limit) || 50, 100);
  const offset = Number(query.offset) || 0;

  const emails = await db
    .select({
      id: schema.emails.id,
      from: schema.emails.from,
      to: schema.emails.to,
      subject: schema.emails.subject,
      status: schema.emails.status,
      provider: schema.emails.provider,
      error: schema.emails.error,
      queuedAt: schema.emails.queuedAt,
      sentAt: schema.emails.sentAt,
    })
    .from(schema.emails)
    .orderBy(desc(schema.emails.queuedAt))
    .limit(limit)
    .offset(offset);

  return emails;
});
