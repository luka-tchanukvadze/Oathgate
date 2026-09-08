import { delay, http, USING_MOCK } from './client';

export interface DegradedPart {
  label: string;
  // What stops being true for a merchant while this one is unwell
  effect: string;
}

export interface SystemStatus {
  healthy: boolean;
  // Only what is currently wrong. Empty is the healthy answer, and the API
  // deliberately does not list the parts that are fine
  degraded: DegradedPart[];
  search: boolean;
}

// Whether the parts that have to work for a payment to go through still do
//
// A background job that dies stops writing rows and stops logging, and every
// screen goes on showing the last thing it wrote
// Without this the first sign of trouble is a merchant asking why a payment
// never settled
export async function getStatus(): Promise<SystemStatus> {
  if (USING_MOCK) {
    return delay({ healthy: true, degraded: [], search: false }, 80);
  }

  return http<SystemStatus>('/api/dashboard/status');
}
