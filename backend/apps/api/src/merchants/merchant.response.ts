import { type Merchant } from '@app/shared';

// No passwordHash, and no relations
// A response mapper is the one place I can be certain of that, which is why
// nothing here ever returns a Prisma row directly
export function toMerchantResponse(merchant: Merchant) {
  return {
    id: merchant.id,
    email: merchant.email,
    name: merchant.name,
    settlementCurrency: merchant.settlementCurrency,
  };
}
