'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { createPayment, queryKeys } from '@/lib/api';
import { parseFiatInput, formatFiat } from '@/lib/format/money';
import { useToast } from '@/components/ui/toast';
import { useMode } from '@/hooks/use-mode';

const CURRENCIES = ['GEL', 'USD', 'EUR', 'TRY'];

export function CreatePaymentDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { mode } = useMode();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [amount, setAmount] = useState('10.50');
  const [currency, setCurrency] = useState('GEL');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Parsed here so the preview underneath shows exactly what will be sent. The
  // form works in what a person types, the API only ever sees minor units
  const minor = parseFiatInput(amount, currency);

  const mutation = useMutation({
    mutationFn: createPayment,
    onSuccess: (payment) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.payments(mode) });
      onClose();
      router.push(`/dashboard/payments/${payment.id}`);
      toast.success('Payment created', 'The quote is locked for 15 minutes');
    },
    onError: (error) => toast.error('Could not create the payment', error.message),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!minor) {
      setError('Enter an amount like 10.50, with no more decimal places than the currency has');
      return;
    }
    if (minor === '0') {
      setError('Amount has to be more than zero');
      return;
    }
    setError(null);
    mutation.mutate({
      fiatAmount: minor,
      fiatCurrency: currency,
      reference: reference.trim() || null,
      mode,
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create a payment"
      description="Oathgate quotes this in Bitcoin at the current rate and locks it for 15 minutes."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Amount" error={error}>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="10.50"
              autoFocus
            />
          </Field>
          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-28">
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Reference" hint="Your own order or invoice number. Optional.">
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="order-1046"
            maxLength={64}
          />
        </Field>

        <div className="rounded-md border border-line bg-surface-muted px-3 py-2.5">
          <p className="text-xs text-ink-subtle">Sent to the API as</p>
          <p className="mono mt-1 text-sm text-ink">
            {minor ? (
              <>
                {`{ "amount": ${minor}, "currency": "${currency}" }`}
              </>
            ) : (
              <span className="text-ink-subtle">waiting for a valid amount</span>
            )}
          </p>
          {minor && (
            <p className="mt-1.5 text-xs text-ink-subtle">
              Minor units, so {formatFiat(minor, currency)} {currency} travels as the integer {minor}. No
              float is involved at any point.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Create payment
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
