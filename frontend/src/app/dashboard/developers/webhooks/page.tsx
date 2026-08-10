'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { WebhookBadge } from '@/components/ui/status-badge';
import { JsonBlock } from '@/components/ui/json-block';
import { CopyButton } from '@/components/ui/copy-button';
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  extraKeys,
  getWebhookEndpoint,
  listWebhooks,
  queryKeys,
  replayWebhook,
  updateWebhookEndpoint,
} from '@/lib/api';
import { formatDateTime, formatRelative } from '@/lib/format/date';
import { cn, truncateMiddle } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { ErrorState } from '@/components/ui/error-state';
import { useMode } from '@/hooks/use-mode';

// Endpoint, secret and deliveries on one screen. Splitting "where events go"
// from "did they arrive" across two nav items was the worst part of the old
// structure: they are the same question

const VERIFY = `const [t, v1] = header.split(',');
const signed = \`\${t.slice(2)}.\${rawBody}\`;
const expected = hmacSha256(secret, signed);

// Constant time, otherwise the comparison leaks the signature
timingSafeEqual(expected, v1.slice(3));

// Reject anything older than five minutes
if (Date.now() / 1000 - Number(t.slice(2)) > 300) reject();`;

export default function WebhooksPage() {
  const { mode } = useMode();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const endpoint = useQuery({ queryKey: extraKeys.endpoint(), queryFn: getWebhookEndpoint });
  const deliveries = useQuery({ queryKey: queryKeys.webhooks(mode), queryFn: () => listWebhooks(mode) });

  useEffect(() => {
    if (endpoint.data) setUrl(endpoint.data.url);
  }, [endpoint.data]);

  const save = useMutation({
    mutationFn: updateWebhookEndpoint,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: extraKeys.endpoint() });
      toast.success('Endpoint saved');
    },
    onError: (error) => toast.error('Could not save the endpoint', error.message),
  });

  const replay = useMutation({
    mutationFn: replayWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks(mode) });
      toast.success('Delivery replayed', 'Your endpoint answered 200');
    },
    onError: (error) => toast.error('Replay failed', error.message),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    // Refusing plain http is not paranoia. The payload carries payment amounts
    // and a signature, and over http both are readable in transit
    if (!/^https:\/\/.+/.test(url.trim())) {
      setUrlError('Has to be an https URL. Payloads carry payment data and must not travel in the clear');
      return;
    }
    setUrlError(null);
    save.mutate(url.trim());
  }

  const rows = deliveries.data ?? [];

  return (
    <>
      <PageHeader
        title="Webhooks"
        description="Where Oathgate sends payment updates, and whether they arrived."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Deliveries</CardTitle>
            <span className="text-xs text-ink-faint">{rows.length} attempts</span>
          </CardHeader>

          {deliveries.isError && !deliveries.data ? (
            <ErrorState
              title="Could not load deliveries"
              error={deliveries.error}
              onRetry={() => deliveries.refetch()}
              retrying={deliveries.isFetching}
            />
          ) : deliveries.isLoading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No deliveries yet"
              description="Settle a payment and its webhook shows up here, with the signature that was sent."
            />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((delivery) => {
                const open = expanded === delivery.id;
                return (
                  <li key={delivery.id}>
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : delivery.id)}
                        aria-expanded={open}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <ChevronDown
                          className={cn('size-4 shrink-0 text-ink-faint transition-transform', open && 'rotate-180')}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="mono text-sm text-ink">{delivery.event}</span>
                            <WebhookBadge status={delivery.status} />
                            {delivery.attempts > 1 && (
                              <span className="text-xs text-ink-faint">{delivery.attempts} attempts</span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-ink-subtle">
                            HTTP {delivery.responseCode ?? '—'} · {formatRelative(delivery.createdAt)}
                          </p>
                        </div>
                      </button>

                      {delivery.status !== 'DELIVERED' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => replay.mutate(delivery.id)}
                          loading={replay.isPending && replay.variables === delivery.id}
                        >
                          <RotateCcw className="size-3.5" aria-hidden />
                          Replay
                        </Button>
                      )}
                    </div>

                    {open && (
                      <div className="space-y-3 border-t border-line bg-surface-muted px-4 py-4 sm:px-5">
                        <div>
                          <p className="mb-1 text-xs font-medium text-ink-subtle">Signature header</p>
                          <div className="flex items-start gap-2">
                            <code className="mono min-w-0 flex-1 break-all text-xs text-ink">
                              {delivery.signature}
                            </code>
                            <CopyButton value={delivery.signature} label="" />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-4 text-xs text-ink-subtle">
                          <span>Sent {formatDateTime(delivery.createdAt)}</span>
                          {delivery.nextRetryAt && <span>Next retry {formatDateTime(delivery.nextRetryAt)}</span>}
                          <Link
                            href={`/dashboard/payments/${delivery.paymentId}`}
                            className="text-accent hover:underline"
                          >
                            {truncateMiddle(delivery.paymentId, 12, 6)}
                          </Link>
                        </div>

                        <JsonBlock value={delivery.payload} title="Payload" />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="min-w-0 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Endpoint</CardTitle>
          </CardHeader>
          <CardBody>
            {endpoint.isLoading ? (
              <Skeleton className="h-8 w-full" />
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <Field label="URL" error={urlError} hint="Reply 2xx within 10 seconds or it gets retried.">
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/hooks" />
                </Field>
                <div className="flex items-center gap-2">
                  <Button type="submit" size="sm" loading={save.isPending}>
                    Save
                  </Button>
                  {save.isSuccess && !save.isPending && <span className="text-xs text-ink-faint">Saved</span>}
                </div>
              </form>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signing secret</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <code className="mono block break-all rounded-md bg-surface-muted p-2.5 text-xs text-ink">
              {endpoint.data?.secretPrefix}••••••••••••••••
            </code>

            <div>
              <p className="mb-1.5 text-xs font-medium text-ink">Verifying a delivery</p>
              <pre className="scrollbar-thin overflow-x-auto rounded-md bg-surface-muted p-2.5 text-2xs leading-relaxed">
                <code className="mono text-ink-muted">{VERIFY}</code>
              </pre>
              <p className="mt-2 text-xs text-ink-subtle">
                The timestamp is inside the signed string, not beside it. That is what stops someone
                replaying a captured request an hour later with a still-valid signature.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Events sent</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-1">
              {(endpoint.data?.events ?? []).map((event) => (
                <li key={event}>
                  <code className="mono text-xs text-ink-muted">{event}</code>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-ink-faint">
              Delivery is at least once, so your consumer has to be idempotent.
            </p>
          </CardBody>
        </Card>
      </div>
      </div>
    </>
  );
}
