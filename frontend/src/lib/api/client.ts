// The single seam between the UI and the data
//
// With NEXT_PUBLIC_API_URL empty the whole app runs on the mock store, which is
// how the public demo and local development work. Set it and every call here
// goes to the real API instead. Nothing outside src/lib/api ever imports the
// mock, so wiring up the backend never touches a component

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export const USING_MOCK = API_BASE.trim().length === 0;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// A little latency so loading states are real during development instead of
// only showing up in production
export function delay<T>(value: T, ms = 260): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
    // The dashboard authenticates with an httpOnly cookie. A secret API key must
    // never be held in browser JavaScript, so there is no Authorization header
    // anywhere in this app
    credentials: 'include',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.message ?? `Request failed with ${response.status}`, response.status);
  }

  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
