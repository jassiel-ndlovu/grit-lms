/**
 * The static service catalogue from docs/revamp/contracts/services.md.
 * Client-safe: no database, no env. `scripts/seed-billing.ts` writes these
 * rows into `Service`; prices live in `Tier` rows, never here.
 */

export type TierKey = "CORE" | "PLUS" | "PRO";
export type Tier = TierKey;

export const TIER_RANK: Record<TierKey, number> = { CORE: 1, PLUS: 2, PRO: 3 };
export const TIER_KEYS: readonly TierKey[] = ["CORE", "PLUS", "PRO"];

export type ServiceKey =
  | "courses-lessons" | "templates" | "tests" | "assignments" | "gradebook"
  | "calendar" | "messages" | "notifications" | "portals" | "fee-collection"
  | "storage-allowance" | "bulk-import" | "attendance"
  | "math-input" | "graphing" | "question-bank" | "live-sessions"
  | "advanced-analytics" | "custom-branding" | "calendar-sync"
  | "secure-tests" | "ai-marking" | "leaderboards" | "api-access"
  | "automarker" | "judge-mode" | "code-plagiarism";

export type AddonKey = "day-pass" | "ai-credits" | "extra-storage" | "live-room" | "runner-capacity";

export type CatalogueStatus = "v1" | "later" | "parked" | "retired";
export type CatalogueMeter = "ACTIVE_STUDENTS" | "AI_MARKS" | "LIVE_ROOM_MINUTES" | "STORAGE_MB" | "API_REQUESTS";

export type ServiceInfo = {
  key: ServiceKey;
  name: string;
  /** CORE for basic services. */
  tier: Tier;
  kind: "basic" | "premium";
  status: Exclude<CatalogueStatus, "retired">;
  metered: boolean;
  meter: CatalogueMeter | null;
};

export type AddonInfo = {
  key: AddonKey;
  name: string;
  kind: "addon";
  status: CatalogueStatus;
  meter: CatalogueMeter | null;
};

const basic = (key: ServiceKey, name: string): ServiceInfo => ({
  key, name, tier: "CORE", kind: "basic", status: "v1", metered: false, meter: null,
});
const premium = (
  key: ServiceKey, name: string, tier: Tier, status: ServiceInfo["status"], meter: CatalogueMeter | null = null,
): ServiceInfo => ({ key, name, tier, kind: "premium", status, metered: meter != null, meter });

/** Static catalogue, safe on the client. */
export const SERVICES: Record<ServiceKey, ServiceInfo> = {
  "courses-lessons": basic("courses-lessons", "Courses, lessons and lesson groups"),
  templates: basic("templates", "Course, lesson and group templates"),
  tests: basic("tests", "Tests"),
  assignments: basic("assignments", "Assignments"),
  gradebook: basic("gradebook", "Gradebook and progress reports"),
  calendar: basic("calendar", "Calendar, events and due dates"),
  messages: basic("messages", "Messages"),
  notifications: basic("notifications", "Notifications, search and settings"),
  portals: basic("portals", "Student and parent portals"),
  "fee-collection": basic("fee-collection", "Invoicing parents and collecting fees"),
  "storage-allowance": basic("storage-allowance", "Storage allowance"),
  "bulk-import": basic("bulk-import", "Bulk import"),
  // The register itself is Core (owner, 22 Nov); check-in codes and absence emails stay Plus (live-sessions).
  attendance: basic("attendance", "Attendance register"),

  "math-input": premium("math-input", "Visual maths input", "PLUS", "v1"),
  graphing: premium("graphing", "Graphs in lessons and graph answers", "PLUS", "v1"),
  "question-bank": premium("question-bank", "Question bank and randomised tests", "PLUS", "v1"),
  "live-sessions": premium("live-sessions", "Live-session check-in codes and absence emails", "PLUS", "v1"),
  "advanced-analytics": premium("advanced-analytics", "Item analysis and question difficulty", "PLUS", "later"),
  "custom-branding": premium("custom-branding", "Workspace logo, accent colour and sender name", "PLUS", "v1"),
  "calendar-sync": premium("calendar-sync", "Calendar feed", "PLUS", "v1"),
  "secure-tests": premium("secure-tests", "Secure tests", "PRO", "v1"),
  "ai-marking": premium("ai-marking", "AI-suggested marks", "PRO", "v1", "AI_MARKS"),
  leaderboards: premium("leaderboards", "Course leaderboards", "PRO", "later"),
  "api-access": premium("api-access", "API keys and webhooks", "PRO", "later", "API_REQUESTS"),
  automarker: premium("automarker", "Coding automarker", "PRO", "parked"),
  "judge-mode": premium("judge-mode", "Contests and rankings for code", "PRO", "parked"),
  "code-plagiarism": premium("code-plagiarism", "Code similarity report", "PRO", "parked"),
};

export const ADDONS: Record<AddonKey, AddonInfo> = {
  "day-pass": { key: "day-pass", name: "Day pass", kind: "addon", status: "later", meter: null },
  "ai-credits": { key: "ai-credits", name: "AI credits", kind: "addon", status: "retired", meter: null },
  "extra-storage": { key: "extra-storage", name: "Extra storage", kind: "addon", status: "v1", meter: "STORAGE_MB" },
  "live-room": { key: "live-room", name: "Nexa-hosted video", kind: "addon", status: "later", meter: "LIVE_ROOM_MINUTES" },
  "runner-capacity": { key: "runner-capacity", name: "Extra code runners", kind: "addon", status: "parked", meter: null },
};

export function isServiceKey(key: string): key is ServiceKey {
  return Object.prototype.hasOwnProperty.call(SERVICES, key);
}

/** Database `ServiceStatus` for a catalogue status. */
export function dbStatus(status: CatalogueStatus): "ACTIVE" | "LATER" | "PARKED" | "RETIRED" {
  return ({ v1: "ACTIVE", later: "LATER", parked: "PARKED", retired: "RETIRED" } as const)[status];
}

/** Seeded tiers (owner decision, 16 November 2026). Cents, excl. VAT. */
export const SEED_TIERS: ReadonlyArray<{ key: TierKey; rank: number; name: string; priceCents: number; aiMarksPerStudent: number }> = [
  { key: "CORE", rank: 1, name: "Core", priceCents: 9900, aiMarksPerStudent: 0 },
  { key: "PLUS", rank: 2, name: "Plus", priceCents: 13900, aiMarksPerStudent: 0 },
  { key: "PRO", rank: 3, name: "Pro", priceCents: 17900, aiMarksPerStudent: 30 },
];
