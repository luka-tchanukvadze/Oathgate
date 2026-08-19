// Named here rather than typed at each call site. A typo in a queue name does
// not fail, it quietly creates a second empty queue that nothing reads
export const WEBHOOK_QUEUE = 'webhook-delivery';

export const WEBHOOK_JOB = 'deliver';
