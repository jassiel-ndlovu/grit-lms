/**
 * Checks the Paystack provider without a network or a real key
 * (docs/revamp/a/design/04-payments.md, sections 2 and 6):
 *   - webhook signatures: HMAC-SHA512 of the raw body, constant-time, fails closed;
 *     the fixed vector was computed independently with `openssl dgst -sha512 -hmac`
 *   - event normalisation and dedupe keys
 *   - request shapes sent to Paystack (amounts in cents, ZAR, flat split)
 *   - status mapping and declined charges
 *
 *   npx tsx scripts/check-paystack.ts
 */

import { PaystackProvider, mapStatus, normalisePaystackEvent } from "../src/features/payments/provider/paystack";
import { paystackSignature, verifyPaystackSignature } from "../src/features/payments/provider/signature";
import { InvalidSignatureError, ProviderError } from "../src/features/payments/provider/types";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const KEY = "sk_test_not_a_real_key";
const BODY = '{"event":"charge.success","data":{"id":302961,"reference":"nx-inv-abc-1","amount":333600,"currency":"ZAR"}}';
const VECTOR =
  "01c49541b36f4b1d8d734f83f625e828022136cde214e264616cd0083618bc72014b34ed9352e99e0cb3e9d683aa805470445a81846df69d69c238ae74f67484";

// --- Signatures ------------------------------------------------------------
check("signature matches the openssl vector", paystackSignature(BODY, KEY), VECTOR);
check("valid signature verifies", verifyPaystackSignature(BODY, VECTOR, KEY), true);
check("upper-case hex verifies", verifyPaystackSignature(BODY, VECTOR.toUpperCase(), KEY), true);
check("tampered body fails", verifyPaystackSignature(BODY.replace("333600", "333601"), VECTOR, KEY), false);
check("wrong key fails", verifyPaystackSignature(BODY, VECTOR, "sk_test_other"), false);
check("one flipped hex digit fails", verifyPaystackSignature(BODY, VECTOR.slice(0, -1) + "5", KEY), false);
check("truncated signature fails", verifyPaystackSignature(BODY, VECTOR.slice(0, 64), KEY), false);
check("non-hex signature fails", verifyPaystackSignature(BODY, "z".repeat(128), KEY), false);
check("missing header fails", verifyPaystackSignature(BODY, null, KEY), false);
check("empty secret fails closed", verifyPaystackSignature(BODY, paystackSignature(BODY, ""), ""), false);
check("whitespace around header is tolerated", verifyPaystackSignature(BODY, ` ${VECTOR}\n`, KEY), true);

const provider = new PaystackProvider({ secretKey: KEY, fetch: (() => { throw new Error("no network"); }) as typeof fetch });
const ev = provider.verifyWebhook(BODY, new Headers({ "x-paystack-signature": VECTOR }));
check("verifyWebhook normalises charge.success", { type: ev.type, ref: ev.reference, key: ev.dedupeKey },
  { type: "charge.succeeded", ref: "nx-inv-abc-1", key: "paystack:charge.success:302961" });
let threw: unknown = null;
try {
  provider.verifyWebhook(BODY, new Headers({ "x-paystack-signature": "00".repeat(64) }));
} catch (e) {
  threw = e;
}
check("verifyWebhook throws InvalidSignatureError on a bad signature", threw instanceof InvalidSignatureError, true);

// --- Normalisation ---------------------------------------------------------
check("refund event uses the transaction reference",
  normalisePaystackEvent('{"event":"refund.processed","data":{"id":9,"transaction_reference":"nx-ck-1"}}').reference, "nx-ck-1");
check("dispute maps to dispute.opened",
  normalisePaystackEvent('{"event":"charge.dispute.create","data":{"id":5,"transaction":{"reference":"r1"}}}').type, "dispute.opened");
check("unknown events are other", normalisePaystackEvent('{"event":"transfer.success","data":{"id":1}}').type, "other");
const noId = normalisePaystackEvent('{"event":"charge.success","data":{"reference":"r2"}}');
check("no data.id falls back to a body hash", noId.dedupeKey.startsWith("paystack:charge.success:sha256:"), true);
check("status mapping", ["success", "failed", "reversed", "abandoned", "ongoing"].map(mapStatus),
  ["SUCCEEDED", "FAILED", "FAILED", "ABANDONED", "PENDING"]);

// --- Request shapes --------------------------------------------------------
type Sent = { url: string; method: string; auth: string | null; body: unknown };
function fakeFetch(responses: Array<{ status?: number; json: unknown }>, sent: Sent[]): typeof fetch {
  let i = 0;
  return (async (url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    sent.push({
      url: String(url),
      method: init?.method ?? "GET",
      auth: headers.get("authorization"),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    const r = responses[Math.min(i++, responses.length - 1)];
    return new Response(JSON.stringify(r.json), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

async function requests() {
  const sent: Sent[] = [];
  const p = new PaystackProvider({
    secretKey: KEY,
    fetch: fakeFetch([{ json: { status: true, message: "ok", data: { authorization_url: "https://checkout.paystack.com/x", reference: "nx-ck-1" } } }], sent),
  });
  const r = await p.initializeCheckout({
    reference: "nx-ck-1", email: "payer@example.invalid", amountCents: 263000, callbackUrl: "https://example.invalid/pay/return",
    splits: [{ subaccountCode: "ACCT_x", shareCents: 140041 }, { subaccountCode: "ACCT_y", shareCents: 117515 }],
    feeBearer: "PAYEES_PROPORTIONAL", metadata: { paymentId: "p1" },
  });
  check("initializeCheckout returns the URL", r, { authorizationUrl: "https://checkout.paystack.com/x", reference: "nx-ck-1" });
  check("initializeCheckout posts to /transaction/initialize", [sent[0].method, sent[0].url], ["POST", "https://api.paystack.co/transaction/initialize"]);
  check("bearer is the secret key", sent[0].auth, `Bearer ${KEY}`);
  const b = sent[0].body as Record<string, unknown>;
  check("amount in cents, ZAR", [b.amount, b.currency], [263000, "ZAR"]);
  check("flat split, all-proportional", b.split, {
    type: "flat", bearer_type: "all-proportional",
    subaccounts: [{ subaccount: "ACCT_x", share: 140041 }, { subaccount: "ACCT_y", share: 117515 }],
  });

  let err: unknown = null;
  try {
    await p.initializeCheckout({ reference: "r", email: "e@example.invalid", amountCents: 100, callbackUrl: "x", splits: [{ subaccountCode: "A", shareCents: 101 }], metadata: {} });
  } catch (e) { err = e; }
  check("shares above the amount are refused", err instanceof ProviderError, true);
  err = null;
  try {
    await p.initializeCheckout({ reference: "r", email: "e@example.invalid", amountCents: 99.5, callbackUrl: "x", metadata: {} });
  } catch (e) { err = e; }
  check("fractional cents are refused", err instanceof ProviderError, true);

  const sent2: Sent[] = [];
  const p2 = new PaystackProvider({
    secretKey: KEY,
    fetch: fakeFetch([{ status: 400, json: { status: false, message: "Declined", data: null } }], sent2),
  });
  const c = await p2.chargeAuthorization({ authorizationCode: "AUTH_x", email: "e@example.invalid", amountCents: 457400, reference: "nx-inv-1-1", metadata: {} });
  check("a declined charge is FAILED, not an exception", c.status, "FAILED");
  check("charge_authorization body", (sent2[0].body as Record<string, unknown>).amount, 457400);

  const p3 = new PaystackProvider({
    secretKey: KEY,
    fetch: fakeFetch([{ json: { status: true, message: "ok", data: {
      status: "success", amount: 333600, currency: "ZAR", fees: 10000, channel: "card", paid_at: "2027-02-03T08:00:00.000Z",
      authorization: { authorization_code: "AUTH_y", reusable: true, brand: "visa", last4: "4081", exp_month: "12", exp_year: "2030" },
    } } }], []),
  });
  const v = await p3.verifyTransaction("nx-inv-abc-1");
  check("verifyTransaction maps the authorisation", [v.status, v.amountCents, v.feeCents, v.authorization?.expYear, v.authorization?.reusable],
    ["SUCCEEDED", 333600, 10000, 2030, true]);

  const p4 = new PaystackProvider({ secretKey: "", fetch: fakeFetch([], []) });
  err = null;
  try { await p4.listBanks(); } catch (e) { err = e; }
  check("no secret key: calls refuse before any request", err instanceof ProviderError, true);
}

requests()
  .then(() => {
    console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
    process.exitCode = failures === 0 ? 0 : 1;
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
