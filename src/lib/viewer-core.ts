/**
 * Viewer types and pure helpers — the client-safe half of `src/lib/viewer.ts`.
 *
 * Contract: docs/revamp/contracts/viewer.md. Model and permission matrix:
 * docs/revamp/a/design/01-tenancy-roles.md, sections 2 and 3.
 *
 * Nothing here touches the database or the session, so client components
 * and check scripts can import it.
 */

export type PlatformRole = "USER" | "NEXA_ADMIN";
export type WorkspaceKind = "ORGANISATION" | "SOLO";
export type MembershipRole = "OWNER" | "ADMIN" | "TUTOR";
export type Persona = "staff" | "learner" | "guardian" | "admin" | "none";
export type BillingState =
  | "TRIAL"
  | "ACTIVE"
  | "PAST_DUE"
  | "READ_ONLY"
  | "COMPED"
  | "CANCELLED";

export const PERMISSIONS = [
  "workspace.settings",
  "workspace.branding",
  "workspace.delete",
  "members.invite",
  "members.role",
  "teams.manage",
  "courses.create",
  "courses.edit",
  "courses.services",
  "learners.invite",
  "learners.paymentVisibility",
  "guardians.link",
  "messages.announce",
  "messages.direct",
  "content.view",
  "grades.view",
  "billing.view",
  "billing.manage",
  "fees.manage",
  "fees.markOffsite",
  "fees.pay",
  "payouts.connect",
  "admin.console",
  "admin.impersonate",
  "admin.override",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type WorkspaceSummary = {
  id: string;
  slug: string;
  name: string;
  kind: WorkspaceKind;
  logoUrl: string | null;
  as: "staff" | "learner";
  role: MembershipRole | null;
};

export type ViewerWorkspace = {
  id: string;
  slug: string;
  name: string;
  kind: WorkspaceKind;
  timezone: string;
  logoUrl: string | null;
  accentColor: string | null;
  billingState: BillingState;
  trialEndsAt: string | null;
  readOnly: boolean;
};

export type Viewer = {
  user: {
    id: string;
    name: string;
    email: string;
    imageUrl: string | null;
    platformRole: PlatformRole;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
  };
  workspaces: WorkspaceSummary[];
  workspace: ViewerWorkspace | null;
  persona: Persona;
  membership: {
    id: string;
    role: MembershipRole;
    teamIds: string[];
    leadTeamIds: string[];
  } | null;
  learner: { id: string; isMinor: boolean; paymentVisible: boolean } | null;
  children: Array<{
    userId: string;
    name: string;
    imageUrl: string | null;
    workspaces: Array<{ id: string; name: string }>;
  }>;
  permissions: Permission[];
  impersonatedBy: { userId: string; name: string; endsAt: string } | null;
};

/* ------------------------------------------------------------------------- */
/* Permission matrix (design 01, section 3)                                  */
/* ------------------------------------------------------------------------- */

/**
 * Workspace-level grants. A "◐" cell in the design (own team, course or
 * child only) is granted here and narrowed by `canIn()` with a scope.
 */
const STAFF: Record<MembershipRole, readonly Permission[]> = {
  OWNER: [
    "workspace.settings", "workspace.branding", "workspace.delete",
    "members.invite", "members.role", "teams.manage",
    "courses.create", "courses.edit", "courses.services",
    "learners.invite", "learners.paymentVisibility", "guardians.link",
    "messages.announce", "messages.direct", "content.view", "grades.view",
    "billing.view", "billing.manage", "fees.manage", "fees.markOffsite",
    "payouts.connect",
  ],
  ADMIN: [
    "workspace.settings", "workspace.branding",
    "members.invite", "members.role", "teams.manage",
    "courses.create", "courses.edit", "courses.services",
    "learners.invite", "learners.paymentVisibility", "guardians.link",
    "messages.announce", "messages.direct", "content.view", "grades.view",
    "billing.view", "billing.manage", "fees.manage", "fees.markOffsite",
  ],
  TUTOR: [
    "courses.create", "courses.edit", "courses.services",
    "learners.invite", "learners.paymentVisibility", "guardians.link",
    "messages.announce", "messages.direct", "content.view", "grades.view",
    "fees.manage", "fees.markOffsite",
  ],
};

const LEARNER: readonly Permission[] = ["content.view", "grades.view", "messages.direct"];
const GUARDIAN: readonly Permission[] = [
  "guardians.link", "content.view", "grades.view", "messages.direct", "fees.pay",
];
const NEXA_ADMIN: readonly Permission[] = [
  "workspace.settings", "workspace.branding", "workspace.delete",
  "members.invite", "members.role", "teams.manage", "courses.services",
  "guardians.link", "content.view", "grades.view",
  "billing.view", "billing.manage", "fees.manage", "fees.markOffsite",
  "admin.console", "admin.impersonate", "admin.override",
];

/** Permissions that are only ever "own" (◐) for this role and need a scope. */
export const SCOPED_FOR_TUTOR: ReadonlySet<Permission> = new Set([
  "courses.edit", "courses.services", "learners.invite",
  "learners.paymentVisibility", "guardians.link", "messages.announce",
  "messages.direct", "content.view", "grades.view", "fees.manage",
  "fees.markOffsite",
]);

export function permissionsFor(input: {
  persona: Persona;
  membershipRole: MembershipRole | null;
  workspaceKind: WorkspaceKind | null;
  learnerPaymentVisible: boolean;
  hasActiveGuardian: boolean;
}): Permission[] {
  const out = new Set<Permission>();
  switch (input.persona) {
    case "staff": {
      const role = input.membershipRole ?? "TUTOR";
      STAFF[role].forEach((p) => out.add(p));
      // A solo owner connects their own payouts; in an organisation only the
      // owner does (or each tutor, in PER_TUTOR payout mode — design 04).
      if (role === "TUTOR" && input.workspaceKind === "SOLO") out.add("payouts.connect");
      break;
    }
    case "learner":
      LEARNER.forEach((p) => out.add(p));
      if (input.learnerPaymentVisible && !input.hasActiveGuardian) out.add("fees.pay");
      break;
    case "guardian":
      GUARDIAN.forEach((p) => out.add(p));
      break;
    case "admin":
      NEXA_ADMIN.forEach((p) => out.add(p));
      break;
    case "none":
      break;
  }
  return PERMISSIONS.filter((p) => out.has(p));
}

/** Workspace-level check. UI hint only; server actions check again. */
export function can(viewer: Viewer, permission: Permission): boolean {
  return viewer.permissions.includes(permission);
}

/** True when a workspace-level grant still needs a resource scope check. */
export function needsScope(viewer: Viewer, permission: Permission): boolean {
  if (viewer.persona === "admin") return false;
  if (viewer.persona === "staff") {
    const role = viewer.membership?.role;
    return role === "TUTOR" && SCOPED_FOR_TUTOR.has(permission);
  }
  // Learners and guardians only ever act on their own courses or children.
  return viewer.persona === "learner" || viewer.persona === "guardian";
}

/* ------------------------------------------------------------------------- */
/* Phase 0 bridge                                                            */
/* ------------------------------------------------------------------------- */

/**
 * Until Phase 1 creates real workspaces, everyone belongs to the one
 * organisation that the Phase 1 migration will create (design 01, section 8),
 * with billing comped. The id is fixed so cookies and links stay valid; the
 * migration creates the real row with this id.
 */
export const LEGACY_WORKSPACE: ViewerWorkspace = {
  id: "ws_nexa_legacy",
  slug: "nexa",
  name: "Nexa",
  kind: "ORGANISATION",
  timezone: "Africa/Johannesburg",
  logoUrl: null,
  accentColor: null,
  billingState: "COMPED",
  trialEndsAt: null,
  readOnly: false,
};

export type LegacyRole = "STUDENT" | "TUTOR" | "ADMIN" | "PARENT";

/** Builds a Viewer from today's single-role model. Pure, so it can be tested. */
export function buildLegacyViewer(input: {
  user: {
    id: string;
    name: string;
    email: string;
    role: LegacyRole;
    emailVerified: boolean;
    imageUrl: string | null;
  };
  /** Tutor.id when role is TUTOR, Student.id when STUDENT. */
  profileId: string | null;
}): Viewer {
  const { user, profileId } = input;
  const ws = LEGACY_WORKSPACE;
  const summary = (as: "staff" | "learner", role: MembershipRole | null): WorkspaceSummary => ({
    id: ws.id, slug: ws.slug, name: ws.name, kind: ws.kind, logoUrl: ws.logoUrl, as, role,
  });

  let persona: Persona = "none";
  let workspace: ViewerWorkspace | null = null;
  let workspaces: WorkspaceSummary[] = [];
  let membership: Viewer["membership"] = null;
  let learner: Viewer["learner"] = null;

  if (user.role === "TUTOR") {
    persona = "staff";
    workspace = ws;
    workspaces = [summary("staff", "TUTOR")];
    membership = { id: `legacy_${profileId ?? user.id}`, role: "TUTOR", teamIds: [], leadTeamIds: [] };
  } else if (user.role === "STUDENT") {
    persona = "learner";
    workspace = ws;
    workspaces = [summary("learner", null)];
    // Today's learners are school pupils; tutors change this in Phase 1.
    learner = { id: profileId ?? user.id, isMinor: true, paymentVisible: false };
  } else if (user.role === "PARENT") {
    persona = "guardian"; // no guardianship links exist before Phase 1
  } else if (user.role === "ADMIN") {
    persona = "admin";
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      imageUrl: user.imageUrl,
      platformRole: user.role === "ADMIN" ? "NEXA_ADMIN" : "USER",
      emailVerified: user.emailVerified,
      twoFactorEnabled: false,
    },
    workspaces,
    workspace,
    persona,
    membership,
    learner,
    children: [],
    permissions: permissionsFor({
      persona,
      membershipRole: membership?.role ?? null,
      workspaceKind: workspace?.kind ?? null,
      learnerPaymentVisible: learner?.paymentVisible ?? false,
      hasActiveGuardian: false,
    }),
    impersonatedBy: null,
  };
}
