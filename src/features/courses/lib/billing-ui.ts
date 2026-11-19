/**
 * Display helpers for B's billing screens (contracts/billing.md, a/ux/03).
 * Pure and client-safe. They only format and group what A's billing calls
 * return; no price is computed here (billing.md, rules for B, 1).
 * Checked by scripts/check-billing-ui.ts.
 */

export type TierKey = "CORE" | "PLUS" | "PRO";
export type BillingState = "TRIAL" | "ACTIVE" | "PAST_DUE" | "READ_ONLY" | "COMPED" | "CANCELLED";
export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

export const TIER_LABEL: Record<TierKey, string> = { CORE: "Core", PLUS: "Plus", PRO: "Pro" };

/** Integer cents → "R1 668" or "R139,50" (en-ZA grouping and decimal comma). */
export function formatRand(cents: number): string {
  const sign = cents < 0 ? "−" : "";
  const abs = Math.abs(Math.round(cents));
  const whole = abs % 100 === 0;
  const n = (abs / 100).toLocaleString("en-ZA", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
  return `${sign}R${n.replace(/ /g, " ")}`;
}

/** A signed change: "+R480", "−R480", "R0". */
export function formatDelta(cents: number): string {
  if (cents === 0) return "R0";
  return cents > 0 ? `+${formatRand(cents)}` : formatRand(cents);
}

export const STATE_CHIP: Record<BillingState, { label: string; tone: Tone }> = {
  TRIAL: { label: "Trial", tone: "info" },
  ACTIVE: { label: "Active", tone: "success" },
  PAST_DUE: { label: "Payment overdue", tone: "warning" },
  READ_ONLY: { label: "Read-only", tone: "danger" },
  COMPED: { label: "Complimentary", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

const ERRORS: Record<string, string> = {
  TRIAL_CAP_REACHED: "Your trial's limit is reached. Choose plans to keep adding students.",
  READ_ONLY: "Your workspace is read-only until the overdue bill is paid. You can still switch services off.",
  PAST_DUE: "Pay the overdue bill before moving a course to a higher plan.",
  BILLING_DISABLED: "Billing isn't switched on yet.",
  NOT_FOUND: "That course wasn't found in your workspace.",
  FORBIDDEN: "You don't have permission to change this course's services.",
  CARD_REQUIRED: "Add a card first.",
  PROVIDER_ERROR: "The payment provider didn't respond. Try again in a minute.",
  NOTHING_TO_BILL: "Nothing to pay yet: no students are enrolled in a course.",
};

/** next-safe-action's `serverError` ("CODE: detail") → a sentence for the user. */
export function billingErrorMessage(serverError: string | undefined | null): string {
  if (!serverError) return "Something went wrong. Try again.";
  const code = serverError.split(":")[0]?.trim() ?? "";
  return ERRORS[code] ?? "Something went wrong. Try again.";
}

export interface ServiceRow {
  key: string;
  name: string;
  kind: "basic" | "premium";
  tierKey: TierKey;
  status: "v1" | "later" | "parked";
  enabled: boolean;
  availableNow: boolean;
  reason?: "PARKED" | "LATER" | "PAST_DUE" | "READ_ONLY";
}

/**
 * Included services by name, then the premium ones that exist today, by
 * tier. `later` and `parked` services are not shown (services.md rule 4).
 */
export function groupServices(items: ServiceRow[]): { included: string[]; tiers: { tier: "PLUS" | "PRO"; items: ServiceRow[] }[] } {
  const included = items.filter((s) => s.kind === "basic").map((s) => s.name);
  const premium = items.filter((s) => s.kind === "premium" && s.status === "v1");
  const tiers = (["PLUS", "PRO"] as const)
    .map((tier) => ({ tier, items: premium.filter((s) => s.tierKey === tier) }))
    .filter((g) => g.items.length > 0);
  return { included, tiers };
}

/**
 * Whether a switch can be flipped now. Read-only workspaces may still
 * switch services off (ux/03 §2); PAST_DUE blocks only raising the plan.
 */
export function canToggle(s: ServiceRow): boolean {
  if (s.kind !== "premium" || s.status !== "v1") return false;
  if (s.availableNow) return true;
  return s.enabled && (s.reason === "READ_ONLY" || s.reason === "PAST_DUE");
}

/** A change that moves the plan needs the confirm dialog; others apply at once. */
export function needsConfirm(preview: { fromTier: TierKey; toTier: TierKey }): boolean {
  return preview.fromTier !== preview.toTier;
}

export type CapMeter = "active-students" | "ai-marks" | "storage-gb" | "api-pass-through" | "live-room-minutes";

const METER_LABEL: Record<CapMeter, string> = {
  "active-students": "Students",
  "ai-marks": "AI-marked answers",
  "storage-gb": "Storage",
  "api-pass-through": "Usage above allowances",
  "live-room-minutes": "Live room minutes",
};

/** "12 of 20 students", "3 GB of 5 GB", "R120 of R500"; no limit → "12 students". */
export function capLabel(cap: { meter: CapMeter; used: number; limit: number | null }): { name: string; amount: string } {
  const fmt = (n: number) =>
    cap.meter === "storage-gb" ? `${n} GB` : cap.meter === "api-pass-through" ? formatRand(n) : n.toLocaleString("en-ZA").replace(/ /g, " ");
  const name = METER_LABEL[cap.meter];
  return { name, amount: cap.limit == null ? fmt(cap.used) : `${fmt(cap.used)} of ${fmt(cap.limit)}` };
}

/** Bar tone for a cap: warning from 80%, danger at 100%. */
export function capTone(percent: number | null): Tone {
  if (percent == null) return "neutral";
  return percent >= 100 ? "danger" : percent >= 80 ? "warning" : "neutral";
}
