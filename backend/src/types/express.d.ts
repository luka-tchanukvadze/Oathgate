import type { AuthenticatedMerchant } from '../auth/authenticated-merchant';

declare global {
  namespace Express {
    interface Request {
      merchant?: AuthenticatedMerchant;
    }
  }
}
