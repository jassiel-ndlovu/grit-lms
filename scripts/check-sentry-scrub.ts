/** npx tsx scripts/check-sentry-scrub.ts: beforeSend privacy checks. */
import assert from "node:assert/strict";

import { baseOptions, scrubEvent } from "../src/lib/sentry/scrub";

const ev = scrubEvent({
  user: { id: "u1", email: "thandi@example.com", username: "thandi", ip_address: "1.2.3.4" },
  message: "Failed for thandi@example.com",
  exception: { values: [{ value: "bad token for a.b+c@school.co.za" }] },
  request: {
    url: "https://nexa.example/api/x?email=thandi@example.com",
    data: { name: "Thandi Nkosi", password: "hunter2" },
    cookies: { session: "abc" },
    query_string: "email=thandi@example.com",
    headers: { Cookie: "s=1", Authorization: "Bearer xyz", "Upstash-Signature": "sig", "user-agent": "ua" },
  },
  breadcrumbs: [{ message: "sent to bob@x.com", data: { name: "Bob", count: 3, to: "bob@x.com" } }],
  extra: { fullName: "Thandi Nkosi", note: "ping bob@x.com", n: 1 },
  server_name: "host",
});

assert.deepEqual(ev.user, { id: "u1" });
assert.equal(ev.request?.data, undefined);
assert.equal(ev.request?.cookies, undefined);
assert.equal(ev.request?.query_string, undefined);
assert.equal(ev.request?.url, "https://nexa.example/api/x");
assert.deepEqual(ev.request?.headers, { "user-agent": "ua" });
assert.ok(!JSON.stringify(ev).match(/@(example|school|x)\./), "an email survived");
assert.ok(!JSON.stringify(ev).includes("Thandi"), "a name survived");
assert.ok(!JSON.stringify(ev).includes("Bob"), "a name survived");
assert.equal((ev.extra as { n: number }).n, 1);
assert.equal(ev.server_name, undefined);

const off = baseOptions(undefined);
assert.equal(off.enabled, false);
assert.equal(off.dsn, undefined);
const on = baseOptions("https://k@o0.ingest.sentry.io/1");
assert.equal(on.enabled, true);
assert.equal(on.sendDefaultPii, false);
assert.equal(on.tracesSampleRate, 0.1);

console.log("check-sentry-scrub: ok");
