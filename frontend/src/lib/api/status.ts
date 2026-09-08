import { delay, http, USING_MOCK } from './client';

export interface JobStatus {
  name: string;
  label: string;
  // What stops being true for a merchant while this job is quiet
  effect: string;
  healthy: boolean;
  lastRunAt: string | null;
}

export interface SystemStatus {
  healthy: boolean;
  jobs: JobStatus[];
}

// Whether the background jobs that move money are still running
//
// A job that dies stops writing rows and stops logging, and every screen goes
// on showing the last thing it wrote. Without this the first sign of trouble is
// a merchant asking why a payment never settled
export async function getStatus(): Promise<SystemStatus> {
  if (USING_MOCK) return delay({ healthy: true, jobs: [] }, 80);
  return http<SystemStatus>('/api/dashboard/status');
}
