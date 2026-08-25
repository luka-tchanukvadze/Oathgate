import { type KeyMode } from '@app/shared';

// Phase 4 derives a real address from an xpub at this index
// Until then it has to be impossible to pay
// It looks like unfunded:test:41, and no bitcoin address has a colon
export function placeholderAddress(mode: KeyMode, index: number): string {
  return `unfunded:${mode.toLowerCase()}:${index}`;
}
