import { getEmailQueue } from "../../queue/email.queue";
import { assertDashboardOperator } from "../../settings/policy";

export default defineEventHandler(async (event) => {
  await assertDashboardOperator(event);
  const queue = getEmailQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + delayed,
  };
});
