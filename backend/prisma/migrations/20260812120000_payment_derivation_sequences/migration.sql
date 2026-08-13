-- Hand-written. Prisma has no syntax for a sequence, and a counted
-- "max index + 1" would hand the same number to two concurrent requests.
-- nextval is atomic and does not roll back, so a failed payment burns its
-- index rather than letting the next one reuse it.
--
-- One sequence per mode, because test and live will derive from different
-- xpubs and their index spaces must not interleave.
--
-- INTEGER rather than BIGINT on purpose: a non-hardened BIP32 index stops at
-- 2^31-1, which is exactly this type's ceiling, so the database refuses an
-- index the derivation could not have used anyway.

CREATE SEQUENCE "payment_derivation_index_test" AS INTEGER START WITH 0 MINVALUE 0;
CREATE SEQUENCE "payment_derivation_index_live" AS INTEGER START WITH 0 MINVALUE 0;
