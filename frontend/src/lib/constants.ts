// Numbers the backend decides and the browser only ever displays
// Copied here rather than fetched, because they change with a deploy and not
// with a request, and a page that has to ask before it can render a label is a
// page that flickers
//
// Every one of these has a single source in the backend, named below it

// worker: chain.constants.ts
export const MIN_CONFIRMATIONS = 1;

// api: quote.service.ts
export const QUOTE_TTL_MINUTES = 15;

// shared: webhook.constants.ts, BACKOFF_SECONDS.length + 1
export const MAX_WEBHOOK_ATTEMPTS = 7;
