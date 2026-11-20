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
    /** False for a self sign-up that hasn't chosen tutor, student or parent yet: send them to /dashboard/welcome. */
    roleConfirmed: boolean;
    /** True while a tutor-issued sign-in code is still the password: send them to set their own (setOwnPassword). */
    mustChangePassword: boolean;
    /** Owners and Nexa admins must use two-factor sign-in (design 02, section 7): true until they set it up. */
    twoFactorRequired: boolean;
  };
  workspaces: WorkspaceSummary[];
  workspace: ViewerWorkspace | null;
  persona: Persona;
  /**
   * For an owner or admin of an organisation who also teaches (#192):
   * "organisation" (the whole organisation, full grants) or "tutor" (their
   * own teaching, with a tutor's scoped grants). Null for everyone else.
   */
  mode: ViewerMode | null;
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

/** What staff keep in a read-only workspace: viewing, paying Nexa, collecting fees, and closing or exporting. */
export const READ_ONLY_STAFF_KEEPS: ReadonlySet<Permission> = new Set([
  "content.view", "grades.view", "billing.view", "billing.manage", "fees.manage", "fees.markOffsite", "payouts.connect", "workspace.settings", "workspace.delete",
]);

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
    return (role === "TUTOR" || viewer.mode === "tutor") && SCOPED_FOR_TUTOR.has(permission);
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
      roleConfirmed: true,
      mustChangePassword: false,
      twoFactorRequired: false,
    },
    workspaces,
    workspace,
    persona,
    mode: null,
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

/* ------------------------------------------------------------------------- */
/* Phase 1: from the tenancy tables                                          */
/* ------------------------------------------------------------------------- */

export type TenancyWorkspaceRow = {
  id: string;
  slug: string;
  name: string;
  kind: WorkspaceKind;
  timezone: string;
  logoUrl: string | null;
  accentColor: string | null;
  billingState: BillingState;
  trialEndsAt: Date | null;
};

export type TenancyInput = {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    platformRole: PlatformRole;
    imageUrl: string | null;
    /** False until a self sign-up chooses a role. Defaults to true. */
    roleConfirmed?: boolean;
    mustChangePassword?: boolean;
    twoFactorEnabled?: boolean;
  };
  memberships: Array<{
    id: string;
    role: MembershipRole;
    workspace: TenancyWorkspaceRow;
    teams: Array<{ teamId: string; isLead: boolean }>;
    /** Whether this membership teaches any course (CourseStaff rows). */
    teaches?: boolean;
  }>;
  learners: Array<{
    id: string;
    isMinor: boolean;
    paymentVisible: boolean;
    workspace: TenancyWorkspaceRow;
  }>;
  /** ACTIVE guardianships where this user is the guardian. */
  children: Viewer["children"];
  /** True when someone holds an ACTIVE guardianship over this user. */
  hasActiveGuardian: boolean;
  /** The `nexa_ws` cookie, if any. Ignored unless the user belongs there. */
  activeWorkspaceId: string | null;
  /** The `nexa_mode` cookie, if any. Ignored unless the mode applies. */
  mode?: ViewerMode | null;
};

export type ViewerMode = "organisation" | "tutor";

function toViewerWorkspace(w: TenancyWorkspaceRow): ViewerWorkspace {
  return {
    id: w.id,
    slug: w.slug,
    name: w.name,
    kind: w.kind,
    timezone: w.timezone,
    logoUrl: w.logoUrl,
    accentColor: w.accentColor,
    billingState: w.billingState,
    trialEndsAt: w.trialEndsAt ? w.trialEndsAt.toISOString() : null,
    readOnly: w.billingState === "READ_ONLY" || w.billingState === "CANCELLED",
  };
}

/** Builds a Viewer from the tenancy rows (design 01, section 5). Pure. */
export function buildTenancyViewer(input: TenancyInput): Viewer {
  const { user, memberships, learners } = input;

  // The switcher lists each workspace once; staff wins over learner.
  const summaries = new Map<string, WorkspaceSummary>();
  for (const m of memberships) {
    const w = m.workspace;
    summaries.set(w.id, { id: w.id, slug: w.slug, name: w.name, kind: w.kind, logoUrl: w.logoUrl, as: "staff", role: m.role });
  }
  for (const l of learners) {
    const w = l.workspace;
    if (!summaries.has(w.id)) {
      summaries.set(w.id, { id: w.id, slug: w.slug, name: w.name, kind: w.kind, logoUrl: w.logoUrl, as: "learner", role: null });
    }
  }
  const workspaces = [...summaries.values()];

  const activeId =
    (input.activeWorkspaceId && summaries.has(input.activeWorkspaceId) ? input.activeWorkspaceId : null) ??
    memberships[0]?.workspace.id ??
    learners[0]?.workspace.id ??
    null;

  const m = activeId ? memberships.find((x) => x.workspace.id === activeId) : undefined;
  const l = activeId && !m ? learners.find((x) => x.workspace.id === activeId) : undefined;

  let persona: Persona = "none";
  if (m) persona = "staff";
  else if (l) persona = "learner";
  else if (input.children.length > 0) persona = "guardian";
  else if (user.platformRole === "NEXA_ADMIN") persona = "admin";

  const workspaceRow = m?.workspace ?? l?.workspace ?? null;
  const workspace = workspaceRow ? toViewerWorkspace(workspaceRow) : null;

  // Organisation or tutor mode (#192): only for an owner or admin of an
  // organisation who also teaches. Tutor mode uses a tutor's grants.
  const mode: ViewerMode | null =
    persona === "staff" && m && (m.role === "OWNER" || m.role === "ADMIN") && m.workspace.kind === "ORGANISATION" && m.teaches
      ? (input.mode === "tutor" ? "tutor" : "organisation")
      : null;

  const perms = new Set(
    permissionsFor({
      persona,
      membershipRole: mode === "tutor" ? "TUTOR" : (m?.role ?? null),
      workspaceKind: workspace?.kind ?? null,
      learnerPaymentVisible: l ? l.paymentVisible && !l.isMinor : false,
      hasActiveGuardian: input.hasActiveGuardian,
    }),
  );
  // A read-only workspace (trial ended unpaid, renewal unpaid 14 days, or
  // cancelled): staff keep viewing, billing, fees and payouts only (design
  // 03, section 5; #189). Learners and guardians are never blocked.
  if (persona === "staff" && workspace?.readOnly) {
    for (const p of [...perms]) if (!READ_ONLY_STAFF_KEEPS.has(p)) perms.delete(p);
  }
  // A Nexa admin who also teaches keeps the console in every context.
  if (user.platformRole === "NEXA_ADMIN" && persona !== "admin") {
    permissionsFor({ persona: "admin", membershipRole: null, workspaceKind: null, learnerPaymentVisible: false, hasActiveGuardian: false })
      .forEach((p) => perms.add(p));
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      imageUrl: user.imageUrl,
      platformRole: user.platformRole,
      emailVerified: user.emailVerified,
      twoFactorEnabled: user.twoFactorEnabled ?? false,
      roleConfirmed: user.roleConfirmed ?? true,
      mustChangePassword: user.mustChangePassword ?? false,
      twoFactorRequired: !(user.twoFactorEnabled ?? false) && (user.platformRole === "NEXA_ADMIN" || input.memberships.some((x) => x.role === "OWNER")),
    },
    workspaces,
    workspace,
    persona,
    mode,
    membership: m
      ? {
          id: m.id,
          role: m.role,
          teamIds: m.teams.map((t) => t.teamId),
          leadTeamIds: m.teams.filter((t) => t.isLead).map((t) => t.teamId),
        }
      : null,
    learner: l ? { id: l.id, isMinor: l.isMinor, paymentVisible: l.paymentVisible && !l.isMinor } : null,
    children: input.children,
    permissions: PERMISSIONS.filter((p) => perms.has(p)),
    impersonatedBy: null,
  };
}

/** True when the user has any tenancy row, so the Phase 0 bridge is not needed. */
export function hasTenancy(input: Pick<TenancyInput, "memberships" | "learners" | "children" | "user">): boolean {
  return (
    input.memberships.length > 0 ||
    input.learners.length > 0 ||
    input.children.length > 0 ||
    input.user.platformRole === "NEXA_ADMIN"
  );
}
