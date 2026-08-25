import { createHash } from 'node:crypto';

// Keys sorted at every level, so {a,b} and {b,a} hash the same
// Otherwise the client's JSON key order decides whether a retry matches
function canonical(value: unknown): string {
  if (value === undefined) {
    return 'null';
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : 1));

  const pairs = entries.map(
    ([name, item]) => `${JSON.stringify(name)}:${canonical(item)}`,
  );

  return `{${pairs.join(',')}}`;
}

export function hashRequest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
