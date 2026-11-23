/**
 * Roles as named permission sets (owner decision 22 Nov; #216 phase 1).
 * Client-safe: B's role screens list these. Contract: viewer.md, "Roles and
 * branches".
 *
 * A role is a name, a set of permission keys and a scope:
 *   WORKSPACE    the whole organisation
 *   BRANCHES     the courses of chosen branches (through their teams)
 *   OWN_COURSES  the courses the person teaches or owns (a tutor)
 * The three base roles are presets too. An organisation copies a preset
 * into its own role and ticks or unticks permissions; a role never holds
 * more than an admin.
 */

import type { MembershipRole, Permission } from "./viewer-core";

export type RoleScope = "WORKSPACE" | "BRANCHES" | "OWN_COURSES";

export type PresetKey =
  | "OWNER" | "ADMIN" | "TUTOR"
  | "EXECUTIVE" | "BRANCH_MANAGER" | "PROJECT_MANAGER" | "FINANCE" | "SUPPORT" | "ASSISTANT_TUTOR";

export type RolePreset = {
  key: PresetKey;
  name: string;
  description: string;
  /** Used where code still checks the base role. */
  baseRole: MembershipRole;
  scope: RoleScope;
  permissions: readonly Permission[];
};

const ADMIN_PERMISSIONS: readonly Permission[] = [
  "workspace.settings", "workspace.branding",
  "members.invite", "members.role", "teams.manage",
  "courses.create", "courses.edit", "courses.services",
  "learners.invite", "learners.paymentVisibility", "guardians.link",
  "messages.announce", "messages.direct", "content.view", "grades.view",
  "billing.view", "billing.manage", "fees.manage", "fees.markOffsite",
  "reports.view", "timesheets.manage", "enquiries.manage", "cover.manage", "ai.credits.allocate", "staff.reviews",
];

const TUTOR_PERMISSIONS: readonly Permission[] = [
  "courses.create", "courses.edit", "courses.services",
  "learners.invite", "learners.paymentVisibility", "guardians.link",
  "messages.announce", "messages.direct", "content.view", "grades.view",
  "fees.manage", "fees.markOffsite",
];

export const ROLE_PRESETS: Record<PresetKey, RolePreset> = {
  OWNER: {
    key: "OWNER", name: "Owner", description: "Everything, including billing and closing the organisation.", baseRole: "OWNER", scope: "WORKSPACE",
    permissions: [...ADMIN_PERMISSIONS, "workspace.delete", "payouts.connect"],
  },
  ADMIN: { key: "ADMIN", name: "Admin", description: "Runs the whole organisation, except closing it and connecting payouts.", baseRole: "ADMIN", scope: "WORKSPACE", permissions: ADMIN_PERMISSIONS },
  TUTOR: { key: "TUTOR", name: "Tutor", description: "Teaches and marks their own courses.", baseRole: "TUTOR", scope: "OWN_COURSES", permissions: TUTOR_PERMISSIONS },
  EXECUTIVE: {
    key: "EXECUTIVE", name: "Executive", description: "Reads every dashboard and report; changes nothing.", baseRole: "ADMIN", scope: "WORKSPACE",
    permissions: ["content.view", "grades.view", "billing.view", "reports.view", "staff.reviews"],
  },
  BRANCH_MANAGER: {
    key: "BRANCH_MANAGER", name: "Branch manager", description: "Runs a branch: staff, timetable, cover, enquiries, fees and reports.", baseRole: "ADMIN", scope: "BRANCHES",
    permissions: [
      "members.invite", "teams.manage", "courses.create", "courses.edit", "courses.services",
      "learners.invite", "learners.paymentVisibility", "guardians.link", "messages.announce", "messages.direct",
      "content.view", "grades.view", "fees.manage", "fees.markOffsite",
      "reports.view", "timesheets.manage", "enquiries.manage", "cover.manage", "staff.reviews",
    ],
  },
  PROJECT_MANAGER: {
    key: "PROJECT_MANAGER", name: "Project manager", description: "Runs a programme or intake: courses, enrolments, timetable and reports. No money.", baseRole: "ADMIN", scope: "BRANCHES",
    permissions: ["courses.create", "courses.edit", "learners.invite", "guardians.link", "messages.announce", "messages.direct", "content.view", "grades.view", "reports.view", "cover.manage"],
  },
  FINANCE: {
    key: "FINANCE", name: "Finance", description: "Billing, fees, payouts, timesheets and the business dashboard.", baseRole: "ADMIN", scope: "WORKSPACE",
    permissions: ["billing.view", "billing.manage", "fees.manage", "fees.markOffsite", "reports.view", "timesheets.manage", "ai.credits.allocate"],
  },
  SUPPORT: {
    key: "SUPPORT", name: "Support staff", description: "Students, parents, sign-in codes, messages and enquiries. Sees content; doesn't mark.", baseRole: "ADMIN", scope: "BRANCHES",
    permissions: ["learners.invite", "guardians.link", "messages.direct", "content.view", "enquiries.manage"],
  },
  ASSISTANT_TUTOR: {
    key: "ASSISTANT_TUTOR", name: "Assistant tutor", description: "Marks and comments on their courses; doesn't set them up or handle fees.", baseRole: "TUTOR", scope: "OWN_COURSES",
    permissions: ["courses.edit", "messages.direct", "content.view", "grades.view"],
  },
};

/** Presets an organisation may give someone (ownership moves another way). */
export const ASSIGNABLE_PRESETS: readonly PresetKey[] = ["ADMIN", "TUTOR", "EXECUTIVE", "BRANCH_MANAGER", "PROJECT_MANAGER", "FINANCE", "SUPPORT", "ASSISTANT_TUTOR"];

/** The most any custom role may hold: an admin's permissions. */
export const CUSTOM_ROLE_CEILING: ReadonlySet<Permission> = new Set(ADMIN_PERMISSIONS);

export function isPresetKey(k: string): k is PresetKey {
  return k in ROLE_PRESETS;
}

/** The effective role of a membership: its custom role, else its preset, else its base role's preset. */
export function effectiveRole(m: {
  role: MembershipRole;
  presetRole?: string | null;
  customRole?: { id: string; name: string; permissions: string[]; scope: RoleScope } | null;
}): { key: string; name: string; scope: RoleScope; permissions: Permission[] } {
  if (m.customRole) {
    return { key: `custom:${m.customRole.id}`, name: m.customRole.name, scope: m.customRole.scope, permissions: m.customRole.permissions.filter((p): p is Permission => CUSTOM_ROLE_CEILING.has(p as Permission)) };
  }
  const preset = m.presetRole && isPresetKey(m.presetRole) && m.presetRole !== "OWNER" ? ROLE_PRESETS[m.presetRole] : ROLE_PRESETS[m.role];
  return { key: preset.key, name: preset.name, scope: preset.scope, permissions: [...preset.permissions] };
}
