import { Queue } from 'bullmq';
import { WEBHOOK_JOB } from '@app/shared';
import { webhookJobId } from './webhook.constants';

// Redis retries a command for ever rather than failing it
// Right for a worker, wrong for anything on a clock or in a request
const ENQUEUE_TIMEOUT_MS = 5_000;

export interface Enqueueable {
  id: string;
  updatedAt: Date;
}

// Losing these is survivable, and that is the design
// The rows are committed with a nextAttemptAt, so the sweep finds them
export async function enqueueDeliveries(
  queue: Queue,
  deliveries: Enqueueable[],
): Promise<void> {
  if (deliveries.length === 0) {
    return;
  }

  let timer: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      queue.addBulk(
        deliveries.map((delivery) => ({
          name: WEBHOOK_JOB,
          data: { deliveryId: delivery.id },
          opts: { jobId: webhookJobId(delivery.id, delivery.updatedAt) },
        })),
      ),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(`redis did not answer in ${ENQUEUE_TIMEOUT_MS}ms`),
            ),
          ENQUEUE_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    // Losing the race does not cancel the timer, and this runs every 5 seconds
    // Without this the process carries a drift of live timers
    clearTimeout(timer);
  }
}
