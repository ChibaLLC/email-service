import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { getRedisConnection } from "./connection";
import { getEmailProviderForSettings } from "../email/settings";
import { db, schema } from "../database";
import type { EmailJobData } from "./email.queue";

let _worker: Worker | null = null;

export function startEmailWorker() {
  if (_worker) return _worker;

  _worker = new Worker<EmailJobData>(
    "email-send",
    async (job) => {
      const { emailId, from, to, subject, text, html, attachments } = job.data;
      try {
        let settingsId = job.data.outboundSettingsId;
        if (!settingsId) {
          const [email] = await db.select({ outboundSettingsId: schema.emails.outboundSettingsId }).from(schema.emails).where(eq(schema.emails.id, emailId)).limit(1);
          settingsId = email?.outboundSettingsId || undefined;
        }
        // Jobs created before outbound settings IDs were introduced use the active DB row.
        const { provider } = await getEmailProviderForSettings(settingsId);

        await db
          .update(schema.emails)
          .set({ status: "sending", provider: provider.name, error: null })
          .where(eq(schema.emails.id, emailId));

        const result = await provider.send({ from, to, subject, text, html, attachments });
        if (!result.success) throw new Error(result.error || "Email send failed");

        await db
          .update(schema.emails)
          .set({
            status: "sent",
            providerId: result.messageId || null,
            sentAt: new Date(),
            error: null,
          })
          .where(eq(schema.emails.id, emailId));

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Email send failed";
        const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 1);
        await db
          .update(schema.emails)
          .set({ status: finalAttempt ? "failed" : "queued", error: message })
          .where(eq(schema.emails.id, emailId));
        throw error;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: 5,
    },
  );

  _worker.on("failed", (job, err) => {
    console.error(`[email-worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
  });

  _worker.on("completed", (job) => {
    console.log(`[email-worker] Job ${job.id} completed`);
  });

  console.log("[email-worker] Worker started, processing email-send queue");

  return _worker;
}
