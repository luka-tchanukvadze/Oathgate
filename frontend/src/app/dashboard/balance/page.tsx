'use client';

import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card';
import { Stat } from '@/components/ui/stat';
import { LedgerTable } from '@/components/ledger/ledger-table';
import { ErrorState, StaleBanner } from '@/components/ui/error-state';
import { listAccounts, listLedger, queryKeys } from '@/lib/api';
import { formatCrypto, sumMinor } from '@/lib/format/money';
import { useMode } from '@/hooks/use-mode';

export default function BalancePage() {
  const { mode } = useMode();

  const accounts = useQuery({ queryKey: queryKeys.accounts(mode), queryFn: () => listAccounts(mode) });
  const ledger = useQuery({ queryKey: queryKeys.ledger(mode), queryFn: () => listLedger(mode) });

  const entries = ledger.data ?? [];
  const merchantEntries = entries.filter((e) => e.accountId === 'acct_merchant_btc');

  // Recomputed here from the entries rather than read off the account, so the
  // page proves the point it is making instead of just claiming it
  const credits = sumMinor(merchantEntries.filter((e) => e.direction === 'CREDIT').map((e) => e.amount));
  const debits = sumMinor(merchantEntries.filter((e) => e.direction === 'DEBIT').map((e) => e.amount));
  const derived = (BigInt(credits) - BigInt(debits)).toString();

  const stored = accounts.data?.[0]?.balance ?? '0';
  const matches = derived === stored;

  return (
    <>
      <PageHeader
        title="Balance and ledger"
        description="Your recorded Bitcoin balance, and every ledger entry behind it."
      />

      {ledger.isError && ledger.data && (
        <StaleBanner onRetry={() => ledger.refetch()} retrying={ledger.isFetching} />
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Stored balance"
          value={`${formatCrypto(stored, 'BTC')} BTC`}
          previous="What the account row says"
          loading={accounts.isLoading}
        />
        <Stat
          label="Rebuilt from entries"
          value={`${formatCrypto(derived, 'BTC')} BTC`}
          previous="Credits minus debits, summed in BigInt"
          loading={ledger.isLoading}
        />
        <Stat
          label="Reconciliation"
          value={matches ? 'In sync' : 'Drifted'}
          previous={matches ? 'The cache agrees with the entries' : 'The cache disagrees, which is a bug'}
          loading={ledger.isLoading || accounts.isLoading}
        />
      </div>

      <Card className="mt-6">
        <CardBody className="text-sm leading-relaxed text-ink-subtle">
          Those first two numbers are produced two different ways on purpose. The stored balance is the
          column the settle transaction updates while holding a row lock. The second is recomputed from
          every entry, the way the reconciliation job does it. If they ever disagree, something wrote money
          without writing the entries that explain it.
        </CardBody>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <CardTitle>Ledger entries</CardTitle>
          <span className="text-xs text-ink-subtle">{entries.length} entries, newest first</span>
        </CardHeader>
        {ledger.isError && !ledger.data ? (
          <ErrorState
            title="Could not load the ledger"
            error={ledger.error}
            onRetry={() => ledger.refetch()}
            retrying={ledger.isFetching}
          />
        ) : (
          <LedgerTable entries={entries} loading={ledger.isLoading} />
        )}
      </Card>
    </>
  );
}
