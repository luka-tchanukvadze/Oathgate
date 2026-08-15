import { ApiError, delay, http, USING_MOCK } from './client';

// The session, not the merchant. The API answers this from the session row, so
// it knows who you are and nothing else. Profile fields come from getMerchant
export interface Session {
  merchantId: string;
}

// Mock only. The real session lives in an httpOnly cookie that JavaScript
// cannot read, which is the entire point of it, so there is nothing to keep
// here once the backend is wired up
const MOCK_SESSION_KEY = 'oathgate-mock-session';

export async function login(email: string, password: string): Promise<Session> {
  if (USING_MOCK) {
    // Deliberately shallow. There is no password to check against in a mock,
    // and pretending otherwise would suggest this screen is doing more than it
    // is. One message for both fields, same as the API
    if (!email.includes('@') || password.length < 8) {
      await delay(null, 400);
      throw new ApiError('Invalid email or password', 401);
    }

    localStorage.setItem(MOCK_SESSION_KEY, email);
    return delay({ merchantId: 'mock-merchant' }, 400);
  }

  return http<Session>('/api/dashboard/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function logout(): Promise<void> {
  if (USING_MOCK) {
    localStorage.removeItem(MOCK_SESSION_KEY);
    return delay(undefined, 200);
  }

  await http<{ ok: boolean }>('/api/dashboard/auth/logout', { method: 'POST' });
}

// Null rather than a thrown error for the signed-out case, because "not signed
// in" is an ordinary answer here and every caller would otherwise catch it
export async function getSession(): Promise<Session | null> {
  if (USING_MOCK) {
    const stored = localStorage.getItem(MOCK_SESSION_KEY);
    return delay(stored ? { merchantId: 'mock-merchant' } : null, 120);
  }

  try {
    return await http<Session>('/api/dashboard/auth/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}
