import http from 'node:http';
import https from 'node:https';
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
import { OutboundHostService } from './outbound-host.service';
import { signPayload } from './webhook-signature';

interface SendOutcome {
  ok: boolean;
  // Null when nothing answered, so a timeout and a 500 stay distinguishable
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
    private readonly hosts: OutboundHostService,
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

    // The queue can hand me the same job twice
    // Anything not PENDING is already finished with
    if (delivery.status !== WebhookDeliveryStatus.PENDING) {
      return;
    }

    // FAILED, not DEAD_LETTER, because nothing actually went wrong
    // The merchant turned this endpoint off, so it is not one to chase
    if (delivery.endpoint.disabledAt) {
      await this.prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: { status: WebhookDeliveryStatus.FAILED, nextAttemptAt: null },
      });

      return;
    }

    // Serialized once
    // This exact string is both signed and sent
    // Doing it twice risks signing bytes I did not send
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

  // node's own http client rather than fetch, because this is the only way to
  // choose the resolver the socket uses
  // fetch would look the name up again itself, and a check that ran before it
  // says nothing about the address it then connected to
  private async post(
    url: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<SendOutcome> {
    const startedAt = Date.now();

    const finish = (outcome: Omit<SendOutcome, 'durationMs'>): SendOutcome => ({
      ...outcome,
      durationMs: Date.now() - startedAt,
    });

    const failed = (error: unknown): SendOutcome =>
      finish({ ok: false, status: null, error: String(error).slice(0, 500) });

    try {
      // Checked here and not only at registration, because a name can be
      // repointed at a private address after the url was accepted
      // A refusal is recorded like any other failed attempt, so the delivery
      // retries and then dead letters
      await this.hosts.assertAllowed(url);

      const status = await this.send(new URL(url), body, headers);

      // A 3xx is not followed
      // A url that passed the check could still redirect to 169.254.169.254,
      // and a redirect counts as a failure here anyway
      return finish({ ok: status >= 200 && status < 300, status, error: null });
    } catch (error) {
      return failed(error);
    }
  }

  private send(
    url: URL,
    body: string,
    headers: Record<string, string>,
  ): Promise<number> {
    const transport = url.protocol === 'https:' ? https : http;

    return new Promise<number>((resolve, reject) => {
      const request = transport.request(
        url,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          // The addresses this resolves are the addresses it connects to, so
          // nothing can move between the check and the connection
          lookup: this.hosts.lookup,
          // No pooling, or a later delivery could inherit a socket opened
          // before the name was repointed
          agent: false,
          timeout: SEND_TIMEOUT_MS,
        },
        (response) => {
          // Nothing reads the body, and leaving it unread holds the socket open
          response.resume();

          resolve(response.statusCode ?? 0);
        },
      );

      // The timeout only fires the event, so the socket has to be torn down
      // here or the delivery waits for the merchant's server for ever
      request.on('timeout', () => {
        request.destroy(new Error(`no answer within ${SEND_TIMEOUT_MS}ms`));
      });

      request.on('error', reject);
      request.end(body);
    });
  }

  private async record(
    deliveryId: string,
    attempt: number,
    maxAttempts: number,
    outcome: SendOutcome,
  ): Promise<void> {
    // Read off the row, not the constant
    // A manual replay raises this one delivery's budget, not the policy
    const exhausted = attempt >= maxAttempts;

    // One transaction, so attempts can never exceed the rows to show for it
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
          // Null means nothing more to try, and the sweep skips the row
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
