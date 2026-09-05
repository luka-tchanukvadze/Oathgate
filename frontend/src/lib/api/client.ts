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

// Undefined values are dropped rather than sent as the string "undefined",
// which is what a template literal would have done
export function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }

  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

// Every list route answers with the rows and whether there are more of them
//
// The screens want an array, so the envelope is opened here. Not in http,
// which is transport and has no idea which routes paginate, and not in a
// component, which should never learn the shape of the wire at all
export async function page<T>(
  path: string,
  params: Record<string, string | number | undefined>,
): Promise<T[]> {
  const body = await http<{ data: T[]; hasMore: boolean }>(`${path}${query(params)}`);
  return body.data;
}
