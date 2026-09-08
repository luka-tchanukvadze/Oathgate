import { describe, expect, it } from '@jest/globals';
import type { ExecutionContext } from '@nestjs/common';
import { OriginGuard } from './origin.guard';

// Express matches a route whatever its capitalisation, so one handler answers
// to several spellings of its own path
// These cases exist so the guard keeps treating all of them as one route
const contextFor = (path: string, origin?: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'POST',
        path,
        header: (name: string) => (name === 'origin' ? origin : undefined),
      }),
    }),
  }) as unknown as ExecutionContext;

describe('OriginGuard', () => {
  const guard = new OriginGuard();

  const spellings = [
    '/api/dashboard/payments',
    '/API/DASHBOARD/PAYMENTS',
    '/Api/Dashboard/Payments',
  ];

  for (const path of spellings) {
    it(`refuses another site posting to ${path}`, () => {
      expect(() =>
        guard.canActivate(contextFor(path, 'https://not-mine.example')),
      ).toThrow('origin not allowed');
    });

    it(`allows my own dashboard posting to ${path}`, () => {
      expect(guard.canActivate(contextFor(path, 'http://localhost:3000'))).toBe(
        true,
      );
    });
  }

  // A key carries no cookie, so a browser cannot spend somebody's session there
  it('leaves the public api alone', () => {
    expect(
      guard.canActivate(
        contextFor('/api/v1/payments', 'https://not-mine.example'),
      ),
    ).toBe(true);
  });

  // Absent means a non-browser client, which is where an api key is used
  it('allows a request with no origin at all', () => {
    expect(guard.canActivate(contextFor('/api/dashboard/payments'))).toBe(true);
  });
});
