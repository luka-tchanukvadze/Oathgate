import { type KeyMode } from '@app/shared';

// Phase 4 derives a real address from an xpub at this index. Until then the
// value has to be impossible to pay: no bitcoin address contains a colon, so
// nothing can send coins to somewhere I hold no key for. Unique per payment
// either way, because the index is
export function placeholderAddress(mode: KeyMode, index: number): string {
  return `unfunded:${mode.toLowerCase()}:${index}`;
}
