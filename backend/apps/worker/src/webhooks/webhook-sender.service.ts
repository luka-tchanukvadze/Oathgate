import { Injectable, Logger } from '@nestjs/common';
import {
  BACKOFF_SECONDS,
  DELIVERY_HEADER,
  EVENT_HEADER,
  PrismaService,
  SecretCipher,
  SEND_TIMEOUT_MS,
  SIGNATURE_HEADER,
  WebhookDeliveryStatus,
} from '@app/shared';
import { signPayload } from './webhook-signature';

interface SendOutcome {
  ok: boolean;
  // Null when nothing answered at all, so a timeout and a 500 stay tellable apart
  status: number | null;
  error: string | null;
  durationMs: number;
}

@Injectable()
export class WebhookSenderService {
  private readonly logger = new Logger(WebhookSenderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipher,
  ) {}

  async deliver(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { endpoint: true },
    });

    if (!delivery) {
      this.logger.warn(`delivery ${deliveryId} is gone, dropping the job`);
      return;
    }

    // The queue can hand me the same job twice and the retry sweep can queue one
    // a worker is already holding. Anything not PENDING is already finished with
    if (delivery.status !== WebhookDeliveryStatus.PENDING) {
      return;
    }

    // FAILED rather than DEAD_LETTER: nothing went wrong, the merchant turned
    // this endpoint off, and it should not show up in a list of things to chase
    if (delivery.endpoint.disabledAt) {
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { status: WebhookDeliveryStatus.FAILED, nextAttemptAt: null },
      });

      return;
    }

    // Serialized once. This exact string is what gets signed and what gets sent,
    // and doing it twice would risk signing bytes I did not send
    const body = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1_000);
    const secret = this.cipher.decrypt(delivery.endpoint.secretCiphertext);

    const outcome = await this.post(delivery.endpoint.url, body, {
      [SIGNATURE_HEADER]: signPayload(secret, timestamp, body),
      [EVENT_HEADER]: delivery.eventType,
      [DELIVERY_HEADER]: delivery.id,
    });

    await this.record(
      delivery.id,
      delivery.attempts + 1,
      delivery.maxAttempts,
      outcome,
    );
  }

  private async post(
    url: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<SendOutcome> {
    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body,
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        // Not followed. A url that passed the check at registration time and
        // then redirects to an internal address would walk straight around it,
        // and a 3xx counts as a failure here anyway
        redirect: 'manual',
      });

      // Nothing reads the response, and leaving it unread holds the socket open
      await response.body?.cancel();

      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        error: null,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      return {
        ok: false,
        status: null,
        error: String(error).slice(0, 500),
        durationMs: Date.now() - startedAt,
      };
    }
  }

  private async record(
    deliveryId: string,
    attempt: number,
    maxAttempts: number,
    outcome: SendOutcome,
  ): Promise<void> {
    // Read off the row rather than the constant, because a manual replay raises
    // this delivery's own budget without changing the policy for everyone else
    const exhausted = attempt >= maxAttempts;

    // One transaction, so a delivery can never claim more attempts than it has
    // rows to show for
    await this.prisma.$transaction([
      this.prisma.webhookAttempt.create({
        data: {
          deliveryId,
          attempt,
          responseStatus: outcome.status,
          error: outcome.error,
          durationMs: outcome.durationMs,
        },
      }),
      this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          attempts: attempt,
          lastResponseStatus: outcome.status,
          status: outcome.ok
            ? WebhookDeliveryStatus.DELIVERED
            : exhausted
              ? WebhookDeliveryStatus.DEAD_LETTER
              : WebhookDeliveryStatus.PENDING,
          deliveredAt: outcome.ok ? new Date() : null,
          // Null means there is nothing more to try, which is what the retry
          // sweep uses to leave a row alone
          nextAttemptAt:
            outcome.ok || exhausted ? null : this.nextAttemptAt(attempt),
        },
      }),
    ]);

    if (outcome.ok) {
      this.logger.log(`delivered ${deliveryId} on attempt ${attempt}`);
    } else if (exhausted) {
      this.logger.warn(`giving up on ${deliveryId} after ${attempt} attempts`);
    }
  }

  private nextAttemptAt(attempt: number): Date {
    const seconds =
      BACKOFF_SECONDS[Math.min(attempt, BACKOFF_SECONDS.length) - 1];

    return new Date(Date.now() + seconds * 1_000);
  }
}
