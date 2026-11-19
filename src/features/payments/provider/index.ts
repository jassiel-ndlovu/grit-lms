/**
 * getProvider(): the PaymentProvider named by PAYMENT_PROVIDER (default
 * PAYSTACK). Payfast is the documented fallback (design 04) and is not built
 * yet. Server only: it reads the secret key.
 */

import "server-only";

import { PaystackProvider } from "./paystack";
import { ProviderError, type PaymentProvider } from "./types";

export * from "./types";

let cached: PaymentProvider | null = null;

export function getProvider(): PaymentProvider {
  if (cached) return cached;
  const id = (process.env.PAYMENT_PROVIDER ?? "PAYSTACK").toUpperCase();
  if (id === "PAYSTACK") {
    cached = new PaystackProvider();
    return cached;
  }
  throw new ProviderError(`Payment provider ${id} is not available`);
}
