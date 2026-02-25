import { Queue } from "bullmq";
import { getRedisConnection } from "./connection";

export interface EmailJobData {
  emailId: string;
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: { filename: string; content?: string; path?: string; contentType?: string; encoding?: string }[];
}

let _queue: Queue | null = null;

export function getEmailQueue(): Queue<EmailJobData> {
  if (_queue) return _queue;

  _queue = new Queue<EmailJobData>("email-send", {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: {
        age: 24 * 3600, // keep completed jobs for 24h
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // keep failed jobs for 7 days
      },
    },
  });

  return _queue;
}

export async function addEmailJob(data: EmailJobData) {
  const queue = getEmailQueue();
  return queue.add("send", data, {
    jobId: data.emailId,
  });
}
