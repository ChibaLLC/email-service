import { db, schema } from "../../database";
import { sql, eq, gte, count } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  weekStart.setHours(0, 0, 0, 0);

  // Total counts by status
  const statusCounts = await db
    .select({
      status: schema.emails.status,
      count: count(),
    })
    .from(schema.emails)
    .groupBy(schema.emails.status);

  const totals = {
    queued: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    total: 0,
  };

  for (const row of statusCounts) {
    totals[row.status as keyof typeof totals] = Number(row.count);
    totals.total += Number(row.count);
  }

  // Sent today
  const [todayResult] = await db
    .select({ count: count() })
    .from(schema.emails)
    .where(sql`${schema.emails.status} = 'sent' AND ${schema.emails.sentAt} >= ${todayStart}`);

  // Sent this week
  const [weekResult] = await db
    .select({ count: count() })
    .from(schema.emails)
    .where(sql`${schema.emails.status} = 'sent' AND ${schema.emails.sentAt} >= ${weekStart}`);

  // Daily counts for last 30 days (for chart)
  const dailyCounts = await db.execute(sql`
    SELECT 
      DATE(queued_at) as date,
      COUNT(*) FILTER (WHERE status = 'sent') as sent,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) as total
    FROM ${schema.emails}
    WHERE queued_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(queued_at)
    ORDER BY DATE(queued_at) ASC
  `);

  // Active API keys count
  const [keysResult] = await db.select({ count: count() }).from(schema.apiKeys).where(eq(schema.apiKeys.active, true));

  return {
    totals,
    sentToday: Number(todayResult?.count || 0),
    sentThisWeek: Number(weekResult?.count || 0),
    activeKeys: Number(keysResult?.count || 0),
    dailyCounts: dailyCounts.rows,
    successRate:
      totals.sent + totals.failed > 0 ? Math.round((totals.sent / (totals.sent + totals.failed)) * 100) : 100,
  };
});
