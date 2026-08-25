export interface RedisConnection {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db: number;
  maxRetriesPerRequest: null;
}

// The driver takes a URL, the queue wants an options object
// Parsed by hand, so the password never has to be logged
export function redisConnection(url: string): RedisConnection {
  const parsed = new URL(url);

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0,
    // A worker holds a blocking read open and the default cap aborts it
    // Null is what BullMQ requires
    // It also means a command sent while Redis is down waits, not fails
    maxRetriesPerRequest: null,
  };
}

export function redisTarget(url: string): string {
  const parsed = new URL(url);

  return `${parsed.hostname}:${parsed.port || 6379}`;
}
