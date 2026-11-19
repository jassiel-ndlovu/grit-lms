/**
 * Paystack implementation of PaymentProvider (design 04, section 2).
 * Plain fetch to https://api.paystack.co with the secret key from
 * PAYSTACK_SECRET_KEY. Amounts are ZAR cents, which is Paystack's subunit.
 *
 * No "server-only" import, so check scripts can drive it with a fake fetch;
 * the app reaches it only through getProvider() in ./index.ts, which is
 * server-only.
 */

import { createHash } from "node:crypto";

import { PAYSTACK_SIGNATURE_HEADER, verifyPaystackSignature } from "./signature";
import {
  InvalidSignatureError,
  ProviderError,
  type NormalisedEvent,
  type PaymentProvider,
  type ProviderStatus,
} from "./types";

const API = "https://api.paystack.co";
const TIMEOUT_MS = 15_000;

type Fetch = typeof fetch;
type Envelope<T> = { status: boolean; message: string; data: T; meta?: Record<string, unknown> };

export class PaystackProvider implements PaymentProvider {
  readonly id = "PAYSTACK" as const;
  private readonly secretKey: string;
  private readonly fetchImpl: Fetch;

  constructor(opts: { secretKey?: string; fetch?: Fetch } = {}) {
    this.secretKey = opts.secretKey ?? process.env.PAYSTACK_SECRET_KEY ?? "";
    this.fetchImpl = opts.fetch ?? fetch;
  }

  capabilities() {
    return { multiSplit: true, variableCharge: true, refunds: true, eft: true };
  }

  private async call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<Envelope<T>> {
    if (!this.secretKey) throw new ProviderError("PAYSTACK_SECRET_KEY is not set");
    let res: Response;
    try {
      res = await this.fetchImpl(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (e) {
      throw new ProviderError(`Paystack ${method} ${path} failed: ${(e as Error).message}`);
    }
    let json: Envelope<T> | null = null;
    try {
      json = (await res.json()) as Envelope<T>;
    } catch {
      // fall through
    }
    if (!res.ok || !json || json.status !== true) {
      // The message is Paystack's; it never contains our secret.
      throw new ProviderError(`Paystack ${method} ${path}: ${json?.message ?? res.statusText}`, res.status);
    }
    return json;
  }

  async createCustomer(input: { email: string; name: string; metadata: Record<string, string> }) {
    const [first, ...rest] = input.name.trim().split(/\s+/);
    const r = await this.call<{ customer_code: string }>("POST", "/customer", {
      email: input.email,
      first_name: first || undefined,
      last_name: rest.join(" ") || undefined,
      metadata: input.metadata,
    });
    return { customerCode: r.data.customer_code };
  }

  async initializeCheckout(input: Parameters<PaymentProvider["initializeCheckout"]>[0]) {
    assertCents(input.amountCents);
    const splits = input.splits ?? [];
    for (const s of splits) assertCents(s.shareCents);
    if (splits.reduce((n, s) => n + s.shareCents, 0) > input.amountCents) {
      throw new ProviderError("Split shares exceed the amount");
    }
    const r = await this.call<{ authorization_url: string; reference: string }>("POST", "/transaction/initialize", {
      email: input.email,
      amount: input.amountCents,
      currency: "ZAR",
      reference: input.reference,
      callback_url: input.callbackUrl,
      channels: input.channels,
      metadata: input.metadata,
      ...(splits.length > 0
        ? {
            split: {
              type: "flat",
              bearer_type: input.feeBearer === "PLATFORM" ? "account" : "all-proportional",
              subaccounts: splits.map((s) => ({ subaccount: s.subaccountCode, share: s.shareCents })),
            },
          }
        : {}),
    });
    return { authorizationUrl: r.data.authorization_url, reference: r.data.reference };
  }

  async chargeAuthorization(input: Parameters<PaymentProvider["chargeAuthorization"]>[0]) {
    assertCents(input.amountCents);
    try {
      const r = await this.call<{ status: string; gateway_response?: string }>("POST", "/transaction/charge_authorization", {
        authorization_code: input.authorizationCode,
        email: input.email,
        amount: input.amountCents,
        currency: "ZAR",
        reference: input.reference,
        metadata: input.metadata,
      });
      const s = mapStatus(r.data.status);
      return {
        status: s === "SUCCEEDED" ? ("SUCCEEDED" as const) : s === "PENDING" ? ("PENDING" as const) : ("FAILED" as const),
        gatewayMessage: r.data.gateway_response,
      };
    } catch (e) {
      // A declined card comes back as a 4xx: a failed charge, not an outage.
      if (e instanceof ProviderError && e.httpStatus && e.httpStatus >= 400 && e.httpStatus < 500) {
        return { status: "FAILED" as const, gatewayMessage: e.message };
      }
      throw e;
    }
  }

  async createSubaccount(input: Parameters<PaymentProvider["createSubaccount"]>[0]) {
    const r = await this.call<{ subaccount_code: string; account_name?: string }>("POST", "/subaccount", {
      business_name: input.businessName,
      settlement_bank: input.bankCode,
      account_number: input.accountNumber,
      // A default only: every Nexa checkout sends a dynamic split.
      percentage_charge: 2,
      description: input.description,
      primary_contact_email: input.contactEmail,
    });
    return { subaccountCode: r.data.subaccount_code, accountName: r.data.account_name };
  }

  async verifyTransaction(reference: string) {
    const r = await this.call<{
      status: string;
      amount: number;
      currency: string;
      fees?: number | null;
      channel?: string;
      paid_at?: string | null;
      authorization?: {
        authorization_code: string;
        reusable: boolean;
        brand: string;
        last4: string;
        exp_month: string;
        exp_year: string;
      } | null;
    }>("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
    const d = r.data;
    if (d.currency !== "ZAR") throw new ProviderError(`Unexpected currency ${d.currency}`);
    const a = d.authorization;
    return {
      status: mapStatus(d.status),
      amountCents: d.amount,
      currency: "ZAR" as const,
      feeCents: d.fees ?? undefined,
      channel: d.channel,
      paidAt: d.paid_at ? new Date(d.paid_at) : undefined,
      authorization: a?.authorization_code
        ? {
            code: a.authorization_code,
            reusable: a.reusable === true,
            brand: a.brand,
            last4: a.last4,
            expMonth: Number(a.exp_month),
            expYear: Number(a.exp_year),
          }
        : undefined,
    };
  }

  async refund(input: Parameters<PaymentProvider["refund"]>[0]) {
    if (input.amountCents !== undefined) assertCents(input.amountCents);
    // Paystack has no idempotency header; the key travels in merchant_note so
    // a retried refund can be matched by hand. Callers check Refund rows first.
    const r = await this.call<{ id: number; status: string }>("POST", "/refund", {
      transaction: input.reference,
      amount: input.amountCents,
      currency: "ZAR",
      customer_note: input.reason,
      merchant_note: `nexa-refund:${input.idempotencyKey}`,
    });
    const s = r.data.status.toLowerCase();
    return {
      providerRefundId: String(r.data.id),
      status: s === "processed" ? ("PROCESSED" as const) : s === "failed" ? ("FAILED" as const) : ("PENDING" as const),
    };
  }

  async listBanks() {
    const out: Array<{ code: string; name: string }> = [];
    let next: string | null = null;
    for (let i = 0; i < 20; i++) {
      const q = new URLSearchParams({ country: "south africa", currency: "ZAR", perPage: "100", use_cursor: "true" });
      if (next) q.set("next", next);
      const r: Envelope<Array<{ code: string; name: string; active?: boolean }>> = await this.call("GET", `/bank?${q}`);
      for (const b of r.data) if (b.active !== false) out.push({ code: b.code, name: b.name });
      next = (r.meta?.next as string | null | undefined) ?? null;
      if (!next) break;
    }
    return out;
  }

  /**
   * Open question (design 04): South African accounts may need the holder's
   * ID number. Tries /bank/resolve; if that refuses and an ID number was
   * given, /bank/validate. The ID number is passed through, never stored.
   */
  async resolveAccount(input: { bankCode: string; accountNumber: string; idNumber?: string }) {
    try {
      const q = new URLSearchParams({ account_number: input.accountNumber, bank_code: input.bankCode });
      const r = await this.call<{ account_name: string }>("GET", `/bank/resolve?${q}`);
      return { accountName: r.data.account_name };
    } catch (e) {
      if (!(e instanceof ProviderError) || !e.httpStatus || e.httpStatus >= 500) throw e;
      if (!input.idNumber) return null;
    }
    try {
      const r = await this.call<{ verified: boolean; accountName?: string; account_name?: string }>("POST", "/bank/validate", {
        bank_code: input.bankCode,
        country_code: "ZA",
        account_number: input.accountNumber,
        account_type: "personal",
        document_type: "identityNumber",
        document_number: input.idNumber,
      });
      if (!r.data.verified) return null;
      return { accountName: r.data.accountName ?? r.data.account_name ?? "" };
    } catch (e) {
      if (e instanceof ProviderError && e.httpStatus && e.httpStatus < 500) return null;
      throw e;
    }
  }

  verifyWebhook(rawBody: string, headers: Headers): NormalisedEvent {
    if (!verifyPaystackSignature(rawBody, headers.get(PAYSTACK_SIGNATURE_HEADER), this.secretKey)) {
      throw new InvalidSignatureError();
    }
    return normalisePaystackEvent(rawBody);
  }

  async listTransactions(input: { from: Date; to: Date }) {
    const out: Array<{ reference: string; status: string; amountCents: number }> = [];
    for (let page = 1; page <= 100; page++) {
      const q = new URLSearchParams({
        from: input.from.toISOString(),
        to: input.to.toISOString(),
        perPage: "100",
        page: String(page),
      });
      const r = await this.call<Array<{ reference: string; status: string; amount: number }>>("GET", `/transaction?${q}`);
      for (const t of r.data) out.push({ reference: t.reference, status: t.status, amountCents: t.amount });
      const pageCount = Number(r.meta?.pageCount ?? 1);
      if (page >= pageCount || r.data.length === 0) break;
    }
    return out;
  }
}

/** Parses an already-verified body. Exported for the check script. */
export function normalisePaystackEvent(rawBody: string): NormalisedEvent {
  let parsed: { event?: string; data?: Record<string, unknown> };
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new ProviderError("Webhook body is not JSON");
  }
  const event = String(parsed.event ?? "unknown");
  const data = parsed.data ?? {};
  const tx = (data.transaction ?? null) as Record<string, unknown> | null;
  const reference =
    (typeof data.reference === "string" && data.reference) ||
    (typeof data.transaction_reference === "string" && data.transaction_reference) ||
    (tx && typeof tx.reference === "string" && tx.reference) ||
    null;
  const id = data.id ?? null;
  const dedupeKey =
    id != null
      ? `paystack:${event}:${String(id)}`
      : `paystack:${event}:sha256:${createHash("sha256").update(rawBody).digest("hex")}`;
  return { dedupeKey, type: mapEvent(event), providerType: event, reference, raw: parsed };
}

function mapEvent(event: string): NormalisedEvent["type"] {
  switch (event) {
    case "charge.success":
      return "charge.succeeded";
    case "charge.failed":
      return "charge.failed";
    case "refund.processed":
      return "refund.processed";
    case "refund.failed":
      return "refund.failed";
    case "charge.dispute.create":
      return "dispute.opened";
    default:
      return "other";
  }
}

export function mapStatus(status: string): ProviderStatus {
  switch (status) {
    case "success":
      return "SUCCEEDED";
    case "failed":
    case "reversed":
      return "FAILED";
    case "abandoned":
      return "ABANDONED";
    default:
      // ongoing, pending, processing, queued, send_otp, ...
      return "PENDING";
  }
}

function assertCents(n: number) {
  if (!Number.isSafeInteger(n) || n < 0) throw new ProviderError(`Amount must be whole cents, got ${n}`);
}
