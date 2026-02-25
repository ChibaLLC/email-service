import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { getRedisConnection } from "./connection";
import { getEmailProvider } from "../email/providers";
import { db, schema } from "../database";
import type { EmailJobData } from "./email.queue";

let _worker: Worker | null = null;

export function startEmailWorker() {
  if (_worker) return _worker;

  const provider = getEmailProvider();

  _worker = new Worker<EmailJobData>(
    "email-send",
    async (job) => {
      const { emailId, from, to, subject, text, html } = job.data;

      // Mark as sending
      await db
        .update(schema.emails)
        .set({ status: "sending", provider: provider.name })
        .where(eq(schema.emails.id, emailId));

      // Send via provider
      const result = await provider.send({ from, to, subject, text, html });

      if (result.success) {
        await db
          .update(schema.emails)
          .set({
            status: "sent",
            providerId: result.messageId || null,
            sentAt: new Date(),
          })
          .where(eq(schema.emails.id, emailId));
      } else {
        await db
          .update(schema.emails)
          .set({
            status: "failed",
            error: result.error || "Unknown error",
          })
          .where(eq(schema.emails.id, emailId));

        throw new Error(result.error || "Email send failed");
      }

      return result;
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
