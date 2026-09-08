import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { GroqClient } from './groq.client';

// How long to stop asking after a failure
// Long enough that a provider outage costs a handful of attempts an hour,
// short enough that a recovery is noticed while somebody is still looking
const COOLDOWN_MS = 5 * 60_000;

// A circuit breaker, which is a small state machine with three positions
// Closed means the provider is working, open means a call just failed so stop
// asking for a while, half open means the cooldown passed so the next real
// call goes through as a trial
@Injectable()
export class AiAvailabilityService implements OnModuleInit {
  private readonly logger = new Logger(AiAvailabilityService.name);

  private healthy = false;
  private openedAt: number | null = null;

  // Nothing polls, so this only moves when a real search happens or at boot.
  // Reporting the state without saying when it was last confirmed would present
  // an answer from this morning as an answer about now
  private checkedAt: number | null = null;

  constructor(private readonly groq: GroqClient) {}

  onModuleInit(): void {
    // Not awaited, because a slow provider must never slow my own boot
    // check never throws, so there is nothing here that could go unhandled
    void this.check();
  }

  // What the dashboard draws the mark from
  // Cosmetic only: it reports the last thing I learned and gates nothing
  isAvailable(): boolean {
    return this.healthy;
  }

  // When that answer was last true of a real call, not of a guess
  lastCheckedAt(): Date | null {
    return this.checkedAt === null ? null : new Date(this.checkedAt);
  }

  // The mark in the dashboard must never gate this, or the feature switches
  // itself off for good: a provider down at boot hides the mark, so nobody
  // searches, so no call ever happens to find out it came back
  shouldTry(): boolean {
    if (!this.groq.isConfigured()) {
      return false;
    }

    if (this.healthy) {
      return true;
    }

    return this.openedAt !== null && Date.now() - this.openedAt >= COOLDOWN_MS;
  }

  // Every real search is already a live test of the connection, so the health
  // state is a free side effect of work I was doing anyway and nothing polls
  recordSuccess(): void {
    if (!this.healthy) {
      this.logger.log('natural language search is available');
    }

    this.healthy = true;
    this.openedAt = null;
    this.checkedAt = Date.now();
  }

  recordFailure(reason: unknown): void {
    if (this.healthy) {
      this.logger.warn(`natural language search is off: ${String(reason)}`);
    }

    this.healthy = false;
    this.openedAt = Date.now();
    this.checkedAt = Date.now();
  }

  private async check(): Promise<void> {
    if (!this.groq.isConfigured()) {
      this.logger.log('natural language search is off, no GROQ_API_KEY set');
      return;
    }

    try {
      const models = await this.groq.listModels();
      const model = this.groq.model;

      if (!models.includes(model)) {
        // The single most common way a free tier feature dies, so the log says
        // what to put in GROQ_MODEL instead rather than only that it broke
        //
        // All of them, because the list carries speech and safety models too
        // and a short slice of it is as likely to be three things that cannot
        // hold a conversation as it is to be useful
        this.logger.error(
          `GROQ_MODEL ${model} is not available, pick a chat model from: ${models.join(', ')}`,
        );
        this.recordFailure(`model ${model} not available`);
        return;
      }

      this.recordSuccess();
    } catch (error) {
      this.recordFailure(error);
    }
  }
}
