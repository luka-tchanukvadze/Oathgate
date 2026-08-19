import type {
  AuthenticatedMerchant,
  AuthenticatedSession,
} from '../auth/auth.types';

declare global {
  namespace Express {
    interface Request {
      merchant?: AuthenticatedMerchant;
      session?: AuthenticatedSession;
    }
  }
}
