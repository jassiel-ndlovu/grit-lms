/**
 * Setting up a new workspace (a/ux/01, sections 3 and 4). Pure, so scripts
 * can check it.
 *
 * Steps built so far are the ones with server actions behind them:
 * business (updateWorkspaceProfile), first course (createCourse) and
 * students (createStudentAccount, optional) and payouts
 * (connectPayoutAccount). Subjects join when A adds Workspace.subjects.
 */

export const ONBOARDING_PATH = "/dashboard/onboarding";

export const ONBOARDING_STEPS = [
  { key: "business", label: "Business" },
  { key: "course", label: "First course" },
  { key: "students", label: "Students" },
  { key: "payouts", label: "Payouts" },
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]["key"];

export function parseStep(s: string): OnboardingStep | null {
  return ONBOARDING_STEPS.some((x) => x.key === s) ? (s as OnboardingStep) : null;
}

export function stepHref(step: OnboardingStep): string {
  return `${ONBOARDING_PATH}/${step}`;
}

/** The step after this one, or null after the last. */
export function nextStep(step: OnboardingStep): OnboardingStep | null {
  const i = ONBOARDING_STEPS.findIndex((x) => x.key === step);
  return ONBOARDING_STEPS[i + 1]?.key ?? null;
}

export function previousStep(step: OnboardingStep): OnboardingStep | null {
  const i = ONBOARDING_STEPS.findIndex((x) => x.key === step);
  return i > 0 ? ONBOARDING_STEPS[i - 1].key : null;
}

/** A workspace name: 2 to 80 characters once trimmed (A's rule). */
export function workspaceNameProblem(name: string): string | null {
  const n = name.trim().length;
  if (n < 2) return "Add a name of at least 2 characters.";
  if (n > 80) return "Keep the name to 80 characters.";
  return null;
}

/** Days left in a trial, rounded up; 0 once it has ended. */
export function trialDaysLeft(trialEndsAt: string | null, now: string): number | null {
  if (!trialEndsAt) return null;
  const ms = Date.parse(trialEndsAt) - Date.parse(now);
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000);
}

/** Time zones for the picker: the runtime's list with Johannesburg first, or a short fallback. */
export function timeZoneOptions(current: string): string[] {
  let all: string[];
  try {
    all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    all = [];
  }
  if (all.length === 0) all = ["Africa/Johannesburg", "Africa/Gaborone", "Africa/Harare", "Africa/Maputo", "Africa/Windhoek", "Africa/Nairobi", "Africa/Lagos", "Europe/London", "UTC"];
  const first = ["Africa/Johannesburg", current].filter((z, i, a) => z && a.indexOf(z) === i);
  return [...first, ...all.filter((z) => !first.includes(z))];
}

/** The setup checklist on the home page: what's done, in order. */
export function checklist(state: { named: boolean; hasCourse: boolean; hasStudents: boolean; payouts: "done" | "todo" | "not-mine" }) {
  const items = [
    { key: "business" as const, label: "Name your organisation", done: state.named },
    { key: "course" as const, label: "Create a course", done: state.hasCourse },
    { key: "students" as const, label: "Add students", done: state.hasStudents },
    ...(state.payouts === "not-mine" ? [] : [{ key: "payouts" as const, label: "Connect payouts", done: state.payouts === "done" }]),
  ];
  return { items, done: items.filter((i) => i.done).length, total: items.length };
}
