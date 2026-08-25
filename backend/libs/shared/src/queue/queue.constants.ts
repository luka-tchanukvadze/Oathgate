// Named here rather than typed at each call site
// A typo quietly creates a second empty queue that nothing reads
export const WEBHOOK_QUEUE = 'webhook-delivery';

export const WEBHOOK_JOB = 'deliver';
