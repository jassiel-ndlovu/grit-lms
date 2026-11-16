# Domain and email

**Answer first.** Register the `.co.za` at **xneelo** (R110 a year, same price on renewal, VAT included) and, if the owner wants the `.com` too, register it at **Cloudflare Registrar** (about US$10.46, roughly R178 a year, at cost). Cloudflare Registrar does **not** sell `.co.za`, but its free DNS plan can host the `.co.za` zone anyway, so both names end up on Cloudflare DNS. Send app mail through **Resend** on a subdomain (for example `notify.<domain>`), created in the **Ireland (eu-west-1)** region, on the Free plan (3,000 emails a month, 100 a day) until volume forces Pro at US$20 (about R340) a month. For people mailboxes, start with **Zoho Mail Forever Free** (up to 5 users, 5 GB each, web and mobile only), or with free **Cloudflare Email Routing** if only forwarding is needed. Total at launch: **R110 to R288 a year** (about R9 to R24 a month), with no monthly fees.

Currency: ZAR first. USD is converted at **R17.00/USD** (Wise mid-market 16.95 on 2026-11-16, rounded). Domain availability was **not** checked: the owner must search for the exact name before buying. Nothing was registered. `<domain>` below means the chosen name, for example a `nexa` name under `.co.za`.

## What Nexa needs

| Need | Detail |
|---|---|
| A. A brand domain | South African market, so `.co.za` reads as local. `.com` optional, to stop someone else taking it. |
| B. Transactional mail | Verification links, password resets, notifications, digests. Code already sends through Resend; only `EMAIL_FROM` changes (`src/lib/email/config.ts`). |
| C. People mailboxes | `hello@`, `support@`, maybe `billing@`. 1 to 3 addresses at launch. |
| D. Low cost, low effort | One owner, no IT staff. |

## Registrar prices

Prices are for a 1-year term. "Renew" is the price you pay every year after the first.

### .co.za

| Registrar | Sells .co.za? | Register (ZAR/yr) | Renew (ZAR/yr) | VAT | Source |
|---|---|---|---|---|---|
| Cloudflare Registrar | **No.** Not in its TLD list | - | - | - | [cloudflare.com/tld-policies](https://www.cloudflare.com/tld-policies/) (checked 2026-11-16) |
| Domains.co.za | Yes | R99 | R119 | Not stated | [domains.co.za/domain-registration](https://www.domains.co.za/domain-registration) (checked 2026-11-16) |
| Afrihost | Yes | R197 | R109 | Not stated | [afrihost.com/domains](https://www.afrihost.com/domains) (checked 2026-11-16) |
| xneelo (Hetzner SA) | Yes | R110 | R110 | **Included** | [xneelo.co.za/domains](https://xneelo.co.za/domains/) (checked 2026-11-16) |
| Namecheap | **Unverified:** no `.co.za` page found (its `/cctld/co-za/` and `/cctld/za/` pages return 404) | - | - | - | [namecheap.com](https://www.namecheap.com/domains/registration/cctld/co-za/) (checked 2026-11-16) |
| Porkbun | **No.** Only `.za.com` (a private second-level name, not `.co.za`) at US$308.24 | - | - | - | [porkbun.com/products/domains](https://porkbun.com/products/domains) (checked 2026-11-16) |

Notes:

- Afrihost also lists `.co.za` registration at R0 "with hosting". Nexa does not need Afrihost hosting, so that does not apply.
- 3-year cost of `.co.za`: xneelo R330, Domains.co.za R337, Afrihost R415. xneelo is cheapest over time and is the only one that states VAT is included.
- **Guess:** prices may rise. ZADNA announced a 6.2% registry fee adjustment for `co.za` from 1 October 2026 (reported in search results; the ZADNA page itself was not fetched, so **Unverified**). The xneelo price checked today should already reflect it.

### .com

| Registrar | Register (USD) | Renew (USD) | Register (ZAR) | Renew (ZAR) | Source |
|---|---|---|---|---|---|
| Cloudflare Registrar | 10.46 | 10.46 | R178 | R178 | Price from [cfdomainpricing.com](https://cfdomainpricing.com/) (third-party mirror of Cloudflare prices, checked 2026-11-16). Cloudflare's own page confirms "the wholesale price ... no surcharge fees for your renewal" but shows no number: [cloudflare.com buy .com](https://www.cloudflare.com/application-services/products/registrar/buy-com-domains/) (checked 2026-11-16). **Unverified** on an official Cloudflare page. |
| Porkbun | 11.81 | 11.81 | R201 | R201 | [porkbun.com/products/domains](https://porkbun.com/products/domains) (checked 2026-11-16) |
| Namecheap | 12.08 (25% off 1st year; regular 15.98) | 19.98 | R205 | R340 | Read from the price data embedded in [namecheap.com/domains/registration/gtld/com](https://www.namecheap.com/domains/registration/gtld/com/) (checked 2026-11-16). The page blocks normal fetching; treat as **Unverified** until seen in a browser. |
| Domains.co.za | - | - | R269 | R319 | [domains.co.za/domain-registration](https://www.domains.co.za/domain-registration) (checked 2026-11-16) |
| xneelo | - | - | R299 | R309 (VAT incl.) | [xneelo.co.za/domains](https://xneelo.co.za/domains/) (checked 2026-11-16) |
| Afrihost | - | - | R309 | Not listed | [afrihost.com/domains](https://www.afrihost.com/domains) (checked 2026-11-16) |

### Transfer lock and lock-in

| Item | Finding | Source |
|---|---|---|
| ICANN 60-day lock (gTLDs such as `.com`) | "You cannot transfer a domain name to a different registrar within 60 days of making changes to the registrant name"; registrars may also refuse a transfer within 60 days of the last transfer. Some registrars let you opt out. | [icann.org name-holder FAQs](https://www.icann.org/resources/pages/name-holder-faqs-2017-10-10-en) (checked 2026-11-16) |
| Cloudflare Registrar | A Change of Registrant applies a 60-day lock unless you tick "Do not apply 60 day transfer lock". All Registrar domains must use Cloudflare nameservers; to use other nameservers you must move the domain to another registrar. | [developers.cloudflare.com/registrar/faq](https://developers.cloudflare.com/registrar/faq/) (checked 2026-11-16) |
| `.co.za` transfer fee | Afrihost and Domains.co.za list R0 to transfer a `.co.za` in. | [afrihost.com/domains](https://www.afrihost.com/domains), [domains.co.za/domain-registration](https://www.domains.co.za/domain-registration) (checked 2026-11-16) |
| `.co.za` lock rules | **Unverified:** the registry's transfer rules were not fetched (registry site returned 404). | - |

The Cloudflare nameserver rule is not a problem for Nexa, since the plan puts DNS on Cloudflare anyway. It does mean the `.com` cannot move DNS elsewhere without also changing registrar.

Cloudflare and Porkbun bill in USD on a card, so the ZAR figure moves with the exchange rate and a bank may add a foreign-transaction fee. SA registrars bill in ZAR.

## .co.za rules (ZADNA and the registry)

| Topic | Finding | Source |
|---|---|---|
| Regulator | ZADNA (.za Domain Name Authority) manages `.za` under Chapter X of the ECT Act 25 of 2002. It decides which second-level domains exist; names are only registered under one (for example `co.za`). | [zadna.org.za](https://zadna.org.za/) and [zadna.org.za ZA regulations](https://zadna.org.za/publications/policies-legislation/za-regulations) (checked 2026-11-16) |
| Registry operator | The ZA Registry Consortium (ZARC, formerly ZACR) runs the commercial registry (`co.za`, `org.za`, `net.za`, `web.za`) under a 5-year agreement ending September 2027. ZADNA published a request for information on 29 May 2026 for a future operator. It says domain holders are not affected. | [itweb.co.za](https://www.itweb.co.za/article/zadna-searches-for-za-domain-names-operator/Pero37Z3o5NMQb6m) (checked 2026-11-16) |
| How to buy | Through a registrar accredited with the registry (all three SA registrars above are). You cannot buy from the registry directly. **Unverified** on a registry page: the registry site redirected and returned 404 when fetched. | - |
| Disputes | ZADNA's ADR Regulations (as amended 2017) cover abusive or offensive registrations, with mediation and arbitration by appointed ADR providers. | [zadna.org.za ZA regulations](https://zadna.org.za/publications/policies-legislation/za-regulations) (checked 2026-11-16) |
| Personal data | POPIA governs registrant data held by registries and registrars. | Same page (checked 2026-11-16) |
| Licensing | Draft registry and registrar licensing regulations were published for comment in 2022 (comments closed 6 June 2022). Whether they are final was not confirmed. | Same page (checked 2026-11-16) |
| Who may register | **Unverified:** no page fetched today stated whether a `co.za` registrant needs a South African presence. **Guess:** there is no such requirement for `co.za`, but Nexa will register as a South African business anyway, so it does not matter. | - |
| Term | Domains.co.za says registration can be "a year and 10 years"; `.co.za` minimum is 1 year there. | [domains.co.za/domain-registration](https://www.domains.co.za/domain-registration) (checked 2026-11-16) |

## DNS: Cloudflare Free

| Item | Finding | Source |
|---|---|---|
| Price | Free plan is US$0 a month. | [cloudflare.com/plans/network-cdn](https://www.cloudflare.com/plans/network-cdn/) (checked 2026-11-16) |
| Includes | "Fast, Easy-to-use DNS", "Unmetered DDoS Protection", "Universal SSL Certificate". | Same page (checked 2026-11-16) |
| .co.za on Cloudflare DNS | **Guess (high confidence):** a full Cloudflare zone works for any domain whose nameservers you can change, including `.co.za` bought elsewhere. Set the two Cloudflare nameservers at xneelo. | - |
| Vercel | Point the apex and `www` at Vercel with DNS-only (grey cloud) records, as Vercel issues its own certificates. **Guess:** proxying through Cloudflare in front of Vercel is not needed and adds a layer to debug. | - |
| Resend records | Must be "DNS only" (not proxied). | [resend.com/docs/knowledge-base/cloudflare](https://resend.com/docs/knowledge-base/cloudflare) (checked 2026-11-16) |

## Transactional mail: Resend on the domain

### Plans

| Plan | USD/month | ZAR/month | Emails/month | Daily limit | Domains | Log retention | Source |
|---|---|---|---|---|---|---|---|
| Free | 0 | R0 | 3,000 | 100 | 3 | 30 days | [resend.com/pricing](https://resend.com/pricing) (checked 2026-11-16) |
| Pro (entry) | 20 | R340 | 50,000 | none | 10 | 30 days | Same (checked 2026-11-16) |
| Pro (top) | 35 | R595 | 100,000 | none | 10 | 30 days | Same (checked 2026-11-16) |
| Scale | 90 to 1,150 | R1,530 to R19,550 | 100,000 to 2,500,000 | none | 1,000 | 30 days | Same (checked 2026-11-16) |

Pro overage at the US$20 tier is US$0.90 (about R15) per 1,000 emails ([resend.com/pricing](https://resend.com/pricing), checked 2026-11-16). A dedicated IP is a US$30/month add-on on Scale only, for senders above 3,000 emails a day (same page).

**When Free stops being enough.** The 100-a-day cap is the real limit, not the 3,000 a month. **Guess:** with 150 students, a morning digest plus due-date reminders can pass 100 sends in one day. Plan to move to Pro once Nexa has more than about 50 active users who get daily mail.

### Regions and data residency

| Question | Finding | Source |
|---|---|---|
| Which regions? | North Virginia (us-east-1), Ireland (eu-west-1), Sao Paulo (sa-east-1), Tokyo (ap-northeast-1). No Africa region. | [resend.com/docs/dashboard/domains/regions](https://resend.com/docs/dashboard/domains/regions) (checked 2026-11-16) |
| Set per? | Per domain, when you add it. To change it you delete the domain, add it again with the new region, and update DNS. | Same (checked 2026-11-16) |
| Latency | Resend says sending from the region closest to users can "reduce latency and ensure a faster time-to-inbox". No figures given. | Same (checked 2026-11-16) |
| Data residency | Region controls only where mail is sent from. Account data, email metadata, logs and API records are "stored in the United States regardless of the sending region". | Same (checked 2026-11-16) |

Recommendation: choose **eu-west-1 (Ireland)** when adding the domain. **Guess:** Ireland is the closest Resend region to South African mail servers (Gmail and Microsoft 365 users in SA are served from Europe or SA), and the difference is seconds at most. It is not a data-residency fix: logs stay in the US either way, which the POPIA write-up (topic 9) must cover as a cross-border transfer.

### DNS records for Resend

Resend recommends sending from a subdomain, to keep its reputation separate from people mail ([resend.com/docs/dashboard/domains/introduction](https://resend.com/docs/dashboard/domains/introduction), checked 2026-11-16). Add `notify.<domain>` in Resend, not the bare domain. Copy the exact values from the Resend "Records" tab; the ones below are the shape from Resend's Cloudflare guide ([resend.com/docs/knowledge-base/cloudflare](https://resend.com/docs/knowledge-base/cloudflare), checked 2026-11-16).

| Purpose | Type | Name (in the `<domain>` zone) | Value | Priority |
|---|---|---|---|---|
| Bounce/return path (SPF domain) | MX | `send.notify` | `feedback-smtp.eu-west-1.amazonses.com` (copy from Resend) | 10 |
| SPF | TXT | `send.notify` | `v=spf1 include:amazonses.com ~all` | - |
| DKIM | TXT | `resend._domainkey.notify` | Public key from Resend | - |
| DMARC | TXT | `_dmarc` (whole domain) | `v=DMARC1; p=none; rua=mailto:dmarc@<domain>;` | - |

DMARC: start at `p=none`, check that mail passes, then move to `p=quarantine`, then `p=reject` ([resend.com/docs/dashboard/domains/dmarc](https://resend.com/docs/dashboard/domains/dmarc), checked 2026-11-16). One `_dmarc` record covers the whole domain, so it must suit both Resend and the mailbox provider.

Code change after verification: set `EMAIL_FROM` to `Nexa <no-reply@notify.<domain>>` and `EMAIL_REPLY_TO` to `support@<domain>`. Nothing else changes (`src/lib/email/config.ts`).

## People mailboxes

| Option | Price per user | ZAR/user/month | Storage/user | Limits that matter | Source |
|---|---|---|---|---|---|
| Zoho Mail Forever Free | Free | R0 | 5 GB | Up to 5 users; 1 domain; "IMAP/ POP/ Active Sync not included" (web and Zoho mobile app only) | [zoho.com/mail/zohomail-pricing.html](https://www.zoho.com/mail/zohomail-pricing.html) (checked 2026-11-16) |
| Zoho Mail Lite 5 GB | R14 (ZAR list) | R14 | 5 GB | Annual billing only, no monthly plan; tax added | Same (checked 2026-11-16) |
| Zoho Mail Lite 10 GB | R17.50 (ZAR list) | R17.50 | 10 GB | Annual only | Same (checked 2026-11-16) |
| Zoho Mail Premium | R56 (ZAR list) | R56 | 50 GB + 50 GB retention | Annual only | Same (checked 2026-11-16) |
| Google Workspace Business Starter | US$7.00 annual plan, US$8.40 flexible | R119 annual, R143 flexible | 30 GB pooled | Google lists no ZAR price; **Unverified** whether SA customers are billed in USD or get a local or discounted price (Google's ZA page showed EUR to our fetcher) | [knowledge.workspace.google.com](https://knowledge.workspace.google.com/admin/billing/compare-flexible-and-annual-fixed-term-payment-plans) and [workspace.google.com en_za](https://workspace.google.com/intl/en_za/pricing.html) (checked 2026-11-16) |
| Microsoft 365 Business Basic | **Unverified.** Microsoft's ZA pages timed out. Search results say US$6 rising to US$7 from 1 July 2026, which would be about R119. | about R100 to R126 (**Unverified**) | **Unverified** | Get a quote in the Microsoft ZA store before deciding | [microsoft.com en-za Business Basic](https://www.microsoft.com/en-za/microsoft-365/business/microsoft-365-business-basic) (fetch timed out 2026-11-16) |

## Forwarding only

| Option | Price | What you get | Outbound from the address? | Source |
|---|---|---|---|---|
| Cloudflare Email Routing | Free on Free and paid plans | Up to 200 routing rules per domain, 200 destination addresses per account, 25 MiB message size | **No.** Inbound and forwarding only. Cloudflare's "Email Sending" is a separate beta on Workers Paid. | [developers.cloudflare.com/email-routing](https://developers.cloudflare.com/email-routing/) and [limits](https://developers.cloudflare.com/email-routing/limits/) (checked 2026-11-16) |
| ImprovMX Free | US$0 | 1 domain, 25 aliases, 500 emails forwarded a day | No SMTP on Free | [improvmx.com/pricing](https://improvmx.com/pricing) (checked 2026-11-16) |
| ImprovMX Light | US$50/yr (R850/yr) | Up to 5 domains, 750 SMTP sends a month | Yes, limited | Same (checked 2026-11-16) |
| ImprovMX Premium | US$9/mo (R153/mo) | Up to 30 domains, 12,000 SMTP sends a month | Yes | Same (checked 2026-11-16) |

Forwarding sends `support@<domain>` to the owner's existing inbox. The weak point is replies: they go out from the personal address unless the owner sets up "send as" through some SMTP server. **Unverified:** Resend offers SMTP that a Gmail "send mail as" could use; this was not checked today and would mix people mail into the app's sending reputation, so it is not recommended.

## Comparison and recommendation

| Setup | What it is | Year 1 (ZAR) | Later years (ZAR/yr) | Per month (ZAR) |
|---|---|---|---|---|
| **1. Minimum (recommended start)** | `.co.za` at xneelo, Cloudflare DNS Free, Resend Free on `notify.`, Zoho Mail Free for `hello@` and `support@` | R110 | R110 | about R9 |
| **2. Minimum plus .com** | Setup 1 plus `.com` at Cloudflare | R288 | R288 | about R24 |
| 3. Growth | Setup 2, Resend Pro US$20, Zoho Mail Lite 5 GB for 2 users | R288 + R4,080 + R336 = R4,704 | R4,704 | about R392 |
| 4. Google instead of Zoho | Setup 2, Resend Free, Google Business Starter annual for 2 users | R288 + R2,856 = R3,144 | R3,144 | about R262 |
| 5. Forwarding only | Setup 2, Resend Free, Cloudflare Email Routing to the owner's inbox | R288 | R288 | about R24 |

Workings: Resend Pro R340 x 12 = R4,080. Zoho Lite R14 x 2 users x 12 = R336. Google R119 x 2 x 12 = R2,856.

Why this setup:

- `.co.za` at xneelo is the cheapest over 3 years among registrars that sell it, and the only one that states VAT is included. Domains.co.za is R1 a year more over 3 years and a fine fallback.
- `.com` at Cloudflare is at cost with no renewal mark-up. It is optional; buy it only if the owner wants to block copycats or plans to sell outside South Africa.
- Keeping all DNS in one Cloudflare account means one place for Vercel, Resend and mailbox records.
- Resend Free covers launch. The 100-a-day cap, not cost, is the trigger to upgrade.
- Zoho Free gives real addresses that can send and receive at no cost. Its catch is no IMAP, so no Outlook or Apple Mail; the web app and Zoho mobile app are fine for 1 to 3 shared inboxes. Move to Mail Lite (R14/user/month) if IMAP is needed.

Order of work once the owner approves (owner does the paid steps):

1. Owner searches and registers `<domain>.co.za` at xneelo (and `.com` at Cloudflare, if wanted).
2. Add the zone to Cloudflare Free; set Cloudflare nameservers at xneelo.
3. Add Vercel records for the apex and `www`.
4. Add `notify.<domain>` in Resend with region eu-west-1; add its records; verify.
5. Sign up for Zoho Mail Free; add Zoho's MX, SPF and DKIM records on the root domain (**Unverified:** exact Zoho record values depend on the Zoho data centre the account lands in; copy them from Zoho's setup screen).
6. Add `_dmarc` with `p=none`; review reports after 2 to 4 weeks; tighten.
7. Set `EMAIL_FROM` and `EMAIL_REPLY_TO` in Vercel env; send a test to the owner only.

## Against the plan

The plan's rows (Hosting, region and storage, revision 2) say: domain "through a local registrar or Cloudflare Registrar, DNS on Cloudflare", settle "cheapest registrar, renewal price, transfer lock"; email "Resend ... mailboxes on Zoho Mail, Google Workspace or Microsoft 365, or forwarding only through Cloudflare Email Routing".

| Plan says | This research finds | Change suggested |
|---|---|---|
| `.co.za` or `.com` through a local registrar **or Cloudflare Registrar** | Cloudflare Registrar does not sell `.co.za`. It can only be the registrar for the `.com`. | `.co.za` at a local registrar (xneelo); Cloudflare Registrar only for an optional `.com`. |
| DNS on Cloudflare | Agrees. Cloudflare Free covers it at R0. | None. |
| Resend on the new domain | Agrees, with two details the plan does not state: send from a subdomain (`notify.`), and pick the region when adding the domain (eu-west-1), because changing it later means deleting and re-adding the domain. Resend keeps logs in the US in every region. | Add the subdomain and region to the plan's Email row; flag the US log storage to the POPIA topic. |
| Mailboxes on Zoho, Google or Microsoft, or forwarding only | Zoho Mail Free (R0, up to 5 users) or Mail Lite (R14/user/month) is 8 to 10 times cheaper than Google (about R119) or Microsoft (**Unverified**, about R100 to R126). | Start on Zoho Free; drop Google and Microsoft unless the owner already uses them. |
| Earlier "Rough monthly running cost" lists "the Resend ... starter tiers" | Resend Free (R0) is enough at launch; the 100-a-day cap is the trigger for Pro (R340/month). | Budget R0 for Resend at launch and R340/month once daily mail passes 100. |

## Open questions for the owner

1. Which exact name? Availability must be checked at the registrar before buying; this research did not check it.
2. Do you want the `.com` as well (R178 a year), or only `.co.za`?
3. How many people need their own mailbox at launch: none (forward only), 1 to 5 (Zoho Free), or more?
4. Do you need mail in Outlook or Apple Mail (IMAP)? If yes, Zoho Mail Lite at R14/user/month, not Zoho Free.
5. Are you happy for Resend to keep email logs in the US (it does in every region)? This feeds the POPIA write-up.
6. Should the from-address be `no-reply@notify.<domain>` or a friendlier `hello@notify.<domain>` with replies to `support@<domain>`?

## Sources

- https://www.cloudflare.com/tld-policies/ (checked 2026-11-16)
- https://www.cloudflare.com/products/registrar/ (checked 2026-11-16)
- https://www.cloudflare.com/application-services/products/registrar/buy-com-domains/ (checked 2026-11-16)
- https://cfdomainpricing.com/ (third-party, checked 2026-11-16)
- https://www.cloudflare.com/plans/network-cdn/ (checked 2026-11-16)
- https://developers.cloudflare.com/email-routing/ (checked 2026-11-16)
- https://developers.cloudflare.com/email-routing/limits/ (checked 2026-11-16)
- https://www.domains.co.za/domain-registration (checked 2026-11-16)
- https://www.afrihost.com/domains (checked 2026-11-16)
- https://xneelo.co.za/domains/ (checked 2026-11-16)
- https://www.namecheap.com/domains/registration/gtld/com/ (checked 2026-11-16)
- https://www.namecheap.com/domains/registration/cctld/co-za/ (404, checked 2026-11-16)
- https://porkbun.com/products/domains (checked 2026-11-16)
- https://zadna.org.za/ (checked 2026-11-16)
- https://zadna.org.za/publications/policies-legislation/za-regulations (checked 2026-11-16)
- https://www.itweb.co.za/article/zadna-searches-for-za-domain-names-operator/Pero37Z3o5NMQb6m (checked 2026-11-16)
- https://resend.com/pricing (checked 2026-11-16)
- https://resend.com/docs/dashboard/domains/regions (checked 2026-11-16)
- https://resend.com/docs/dashboard/domains/introduction (checked 2026-11-16)
- https://resend.com/docs/dashboard/domains/dmarc (checked 2026-11-16)
- https://resend.com/docs/knowledge-base/cloudflare (checked 2026-11-16)
- https://www.zoho.com/mail/zohomail-pricing.html (checked 2026-11-16)
- https://knowledge.workspace.google.com/admin/billing/compare-flexible-and-annual-fixed-term-payment-plans (checked 2026-11-16)
- https://workspace.google.com/intl/en_za/pricing.html (checked 2026-11-16)
- https://www.microsoft.com/en-za/microsoft-365/business/microsoft-365-business-basic (fetch timed out, 2026-11-16)
- https://improvmx.com/pricing (checked 2026-11-16)
- https://www.icann.org/resources/pages/name-holder-faqs-2017-10-10-en (checked 2026-11-16)
- https://developers.cloudflare.com/registrar/faq/ (checked 2026-11-16)
