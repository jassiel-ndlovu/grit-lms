/**
 * Paystack webhook signatures: `x-paystack-signature` is the lower-case hex
 * HMAC-SHA512 of the raw request body, keyed with the secret key. Compared in
 * constant time. Pure (node:crypto only), checked by scripts/check-paystack.ts.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const PAYSTACK_SIGNATURE_HEADER = "x-paystack-signature";

const HEX_SHA512 = /^[0-9a-f]{128}$/i;

export function paystackSignature(rawBody: string, secretKey: string): string {
  return createHmac("sha512", secretKey).update(rawBody, "utf8").digest("hex");
}

/**
 * True only when `signature` is the HMAC of `rawBody` under `secretKey`.
 * Fails closed: an empty key, a missing or malformed header is false.
 */
export function verifyPaystackSignature(rawBody: string, signature: string | null | undefined, secretKey: string): boolean {
  if (!secretKey || !signature) return false;
  const given = signature.trim();
  if (!HEX_SHA512.test(given)) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody, "utf8").digest();
  const actual = Buffer.from(given, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
