'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, KeyRound, Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/field';
import { CopyButton } from '@/components/ui/copy-button';
import { TableSkeleton } from '@/components/ui/skeleton';
import { createApiKey, listApiKeys, queryKeys, revokeApiKey } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { ErrorState } from '@/components/ui/error-state';
import { formatDateTime, formatRelative } from '@/lib/format/date';
import type { ApiKeyWithSecret, KeyMode } from '@/types';

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [mode, setKeyMode] = useState<KeyMode>('TEST');

  // The full key lives in component state and nowhere else. It is deliberately
  // not put in the query cache, because the cache outlives this screen
  const [revealed, setRevealed] = useState<ApiKeyWithSecret | null>(null);

  const keys = useQuery({ queryKey: queryKeys.apiKeys(), queryFn: listApiKeys });

  const create = useMutation({
    mutationFn: createApiKey,
    onSuccess: (key) => {
      setRevealed(key);
      setCreating(false);
      setName('');
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys() });
    },
    onError: (error) => toast.error('Could not create the key', error.message),
  });

  const revoke = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys() });
      toast.success('Key revoked', 'It is marked rather than deleted, so old payments still explain themselves');
    },
    onError: (error) => toast.error('Could not revoke the key', error.message),
  });

  const rows = keys.data ?? [];

  return (
    <>
      <PageHeader
        title="API keys"
        description="Keys your server uses to authenticate API requests."
      />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-3.5" aria-hidden />
          Create key
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Keys</CardTitle>
        </CardHeader>

        {keys.isError && !keys.data ? (
          <ErrorState error={keys.error} onRetry={() => keys.refetch()} retrying={keys.isFetching} />
        ) : keys.isLoading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((key) => (
              <li key={key.id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-muted text-ink-subtle">
                  <KeyRound className="size-4" aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{key.name}</span>
                    <span
                      className="rounded px-1.5 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: key.mode === 'TEST' ? 'var(--warn-bg)' : 'var(--ok-bg)',
                        color: key.mode === 'TEST' ? 'var(--warn-fg)' : 'var(--ok-fg)',
                      }}
                    >
                      {key.mode}
                    </span>
                    {key.revokedAt && (
                      <span
                        className="rounded px-1.5 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: 'var(--bad-bg)', color: 'var(--bad-fg)' }}
                      >
                        Revoked
                      </span>
                    )}
                  </div>
                  <p className="mono mt-1 text-xs text-ink-subtle">{key.keyPrefix}••••••••••••••••</p>
                  <p className="mt-0.5 text-xs text-ink-subtle">
                    Created {formatDateTime(key.createdAt)}
                    {key.lastUsedAt ? ` · last used ${formatRelative(key.lastUsedAt)}` : ' · never used'}
                  </p>
                </div>

                {!key.revokedAt && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => revoke.mutate(key.id)}
                    loading={revoke.isPending && revoke.variables === key.id}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>


      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Create an API key"
        description="You will see the full key once, on the next screen."
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate({ name: name.trim() || 'Untitled key', mode });
          }}
        >
          <Field label="Name" hint="Something you will recognise later, like the server it lives on.">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Checkout server" autoFocus />
          </Field>

          {/* Mainnet is shown and disabled rather than hidden, so the two
              environments are still visible in the product without offering a
              key this workspace cannot issue */}
          <Field label="Environment" hint="Testnet keys can only ever touch testnet data.">
            <Select value={mode} onChange={(e) => setKeyMode(e.target.value as KeyMode)}>
              <option value="TEST">Testnet</option>
              <option value="LIVE" disabled>
                Mainnet, not activated
              </option>
            </Select>
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create key
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={revealed !== null}
        onClose={() => setRevealed(null)}
        title="Save this key now"
        description="This is the only time it will ever be shown."
      >
        <div className="space-y-4">
          <div
            className="flex gap-2.5 rounded-lg px-3 py-2.5 text-xs"
            style={{ backgroundColor: 'var(--warn-bg)', color: 'var(--warn-fg)' }}
          >
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            <p>
              Oathgate stores only a hash. Close this dialog without copying the key and it is gone for good,
              and you will have to create a new one.
            </p>
          </div>

          <div className="rounded-md bg-surface-muted p-3">
            <code className="mono block break-all text-sm text-ink">{revealed?.secret}</code>
            {revealed && <CopyButton value={revealed.secret} label="Copy key" className="-ml-2 mt-2" />}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setRevealed(null)}>I have saved it</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
