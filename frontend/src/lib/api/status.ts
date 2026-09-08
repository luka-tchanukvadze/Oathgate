import { delay, http, USING_MOCK } from './client';

export interface DegradedJob {
  label: string;
  // What stops being true for a merchant while this is quiet
  effect: string;
}

export interface SystemStatus {
  healthy: boolean;
  // Only what is currently wrong. Empty is the healthy answer, and the API
  // deliberately does not list the parts that are fine
  degraded: DegradedJob[];
  search: boolean;
}

// Whether the background jobs that move money are still running
//
// A job that dies stops writing rows and stops logging, and every screen goes
// on showing the last thing it wrote. Without this the first sign of trouble is
// a merchant asking why a payment never settled
export async function getStatus(): Promise<SystemStatus> {
  if (USING_MOCK) {
    return delay({ healthy: true, degraded: [], search: false }, 80);
  }

  return http<SystemStatus>('/api/dashboard/status');
}
