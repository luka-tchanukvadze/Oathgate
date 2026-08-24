// One channel, not one per event type. Redis can pattern-subscribe, but every
// pattern is another thing to get subtly wrong, and a consumer skipping an event
// it does not care about costs nothing at this volume
export const EVENTS_CHANNEL = 'oathgate:events';
