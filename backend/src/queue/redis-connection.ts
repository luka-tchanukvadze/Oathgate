export interface RedisConnection {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db: number;
  maxRetriesPerRequest: null;
}

// The driver takes a URL in its constructor but not in an options object, and
// the queue wants an options object. Parsed by hand, which also means the
// password never has to be logged to say where I connected
export function redisConnection(url: string): RedisConnection {
  const parsed = new URL(url);

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0,
    // A worker holds a blocking read open, and the driver's default retry cap
    // aborts one. Null is what BullMQ requires, and it also means a command
    // sent while Redis is down waits forever rather than failing
    maxRetriesPerRequest: null,
  };
}

export function redisTarget(url: string): string {
  const parsed = new URL(url);

  return `${parsed.hostname}:${parsed.port || 6379}`;
}
