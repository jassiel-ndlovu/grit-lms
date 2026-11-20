# Contract: `getViewer()`

Owner: Agent A. Reader: Agent B. Status: **Draft 1, 2026-11-16.** B asks for changes in `docs/revamp/b/HANDOFF.md` or an issue labelled `needs-a`; A edits this file in its own pull request.

**Answer first.** `getViewer()` is the one server-side call every page, layout and server action uses to learn who is looking and in what context. It returns the user, the active workspace and their role in it (or their learner place), the children they guard, the permission keys they hold there, and whether an admin is impersonating them. It never returns billing amounts or another user's data. There is no `mode` field: the owner removed Simple and Technical modes (plan revision 3).

Model behind it: [a/design/01-tenancy-roles.md](../a/design/01-tenancy-roles.md).

## Where it lives

| Export | File | Runs on |
| --- | --- | --- |
| `getViewer()`, `requireViewer()`, `ViewerError` | `src/lib/viewer.ts` | Server only (`import "server-only"`) |
| `Viewer` and related types, `PERMISSIONS` | `src/lib/viewer-core.ts` (re-exported from `src/lib/viewer.ts`) | Both. Client components import from `@/lib/viewer-core` |
| `can(viewer, permission)` | `src/lib/viewer-core.ts` (re-exported from `src/lib/viewer.ts`) | Both (pure function over the `Viewer` object) |
| `canIn(viewer, permission, scope)` | `src/lib/viewer.ts` | Server only (checks the database) |
| `switchWorkspace(workspaceId)` | `src/features/workspaces/actions.ts` | Server action |
| `createWorkspace({ kind, name?, timezone? })` | `src/features/workspaces/actions.ts` | Server action (onboarding) |
| `updateWorkspaceProfile({ name?, timezone? })` | `src/features/workspaces/actions.ts` | Server action (onboarding step 1, settings) |
| Safe-action clients `viewerActionClient`, `staffActionClient`, `guardianActionClient`, `adminActionClient` | `src/lib/safe-action.ts` | Server; each adds `ctx.viewer` |

## Types

```ts
export type PlatformRole = "USER" | "NEXA_ADMIN";
export type WorkspaceKind = "ORGANISATION" | "SOLO";
export type MembershipRole = "OWNER" | "ADMIN" | "TUTOR";
export type Persona = "staff" | "learner" | "guardian" | "admin" | "none";
export type BillingState =
  | "TRIAL" | "ACTIVE" | "PAST_DUE" | "READ_ONLY" | "COMPED" | "CANCELLED";

export type Permission =
  | "workspace.settings" | "workspace.branding" | "workspace.delete"
  | "members.invite" | "members.role" | "teams.manage"
  | "courses.create" | "courses.edit" | "courses.services"
  | "learners.invite" | "learners.paymentVisibility" | "guardians.link"
  | "messages.announce" | "messages.direct"
  | "content.view" | "grades.view"
  | "billing.view" | "billing.manage"
  | "fees.manage" | "fees.markOffsite" | "fees.pay" | "payouts.connect"
  | "admin.console" | "admin.impersonate" | "admin.override";

export type WorkspaceSummary = {
  id: string;
  slug: string;
  name: string;
  kind: WorkspaceKind;
  logoUrl: string | null;
  as: "staff" | "learner";          // how the user belongs to it
  role: MembershipRole | null;      // null when `as` is "learner"
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

  /** Every workspace the user can switch to, for the switcher. */
  workspaces: WorkspaceSummary[];

  /** The active context. Null for guardian-only users and on /admin. */
  workspace: {
    id: string;
    slug: string;
    name: string;
    kind: WorkspaceKind;
    timezone: string;               // IANA, default "Africa/Johannesburg"
    logoUrl: string | null;
    accentColor: string | null;     // hex; only when `custom-branding` is on
    billingState: BillingState;
    trialEndsAt: string | null;     // ISO 8601
    readOnly: boolean;              // true when staff writes are blocked (READ_ONLY, CANCELLED)
  } | null;

  persona: Persona;

  /** Set when persona is "staff". */
  membership: {
    id: string;
    role: MembershipRole;
    teamIds: string[];
    leadTeamIds: string[];
  } | null;

  /** Set when persona is "learner". */
  learner: {
    id: string;
    isMinor: boolean;
    paymentVisible: boolean;
  } | null;

  /** Children this user guards (ACTIVE guardianships), across workspaces. */
  children: Array<{
    userId: string;
    name: string;
    imageUrl: string | null;
    workspaces: Array<{ id: string; name: string }>;
  }>;

  /** Workspace-level permissions in the active context (see 01, section 3). */
  permissions: Permission[];

  /** Set while a Nexa admin is impersonating this user. */
  impersonatedBy: { userId: string; name: string; endsAt: string } | null;
};
```

## Functions

```ts
/** Cached per request (React `cache`). Null when signed out. */
export function getViewer(): Promise<Viewer | null>;

/**
 * Throws ViewerError("UNAUTHENTICATED") when signed out, and
 * ViewerError("FORBIDDEN") when a condition fails.
 */
export function requireViewer(opts?: {
  persona?: Persona | Persona[];
  permission?: Permission;
  workspace?: true;                 // require an active workspace
}): Promise<Viewer>;

/**
 * Workspace-level check, plus resource scope for the "◐" cells in 01:
 * scope.courseId → the viewer is course staff (or owner/admin);
 * scope.teamId   → the viewer leads the team (or owner/admin);
 * scope.childUserId → the viewer guards that child.
 * Resource checks call the database, so the scoped form is async.
 */
export function can(viewer: Viewer, permission: Permission): boolean;
export function canIn(
  viewer: Viewer,
  permission: Permission,
  scope: { courseId?: string; teamId?: string; childUserId?: string },
): Promise<boolean>;
```

`switchWorkspace(workspaceId)` sets the `nexa_ws` cookie after checking membership or learner rows, then revalidates the layout. Pages read the new context on the next render.

`createWorkspace({ kind: "SOLO" | "ORGANISATION", name?, timezone?, trial? })` (ux/01, section 3) makes the caller the OWNER of a new workspace. The trial is optional (owner decision 2026-11-20): `trial: false` skips it, and the workspace is read-only for staff until the first payment (`trialEndsAt` comes back null). By default it starts the 14-day trial (Subscription billed to the caller's email; trial caps 20 active students and 100 AI marks), switches to it, and returns `{ workspaceId, slug, name, kind, trialEndsAt }`. The name defaults to "Thandi's practice" or "Thandi's organisation" from the caller's first name; the time zone to `Africa/Johannesburg`. Refused when the email is not verified, or when the caller already owns 3 workspaces. Behind `BILLING=1`.

`updateWorkspaceProfile({ name?, timezone? })` needs `workspace.settings`; names are 2 to 80 characters and the time zone must be an IANA name. Returns `{ id, name, timezone }`.

## Rules for B

1. Pages and layouts call `getViewer()` (or `requireViewer()`) once at the top. Components below receive the parts they need as props; they do not call it again (it is cached, but props keep client components serialisable).
2. Pass the `Viewer` to client components only as needed. It contains no secrets, but keep `children` and `workspaces` out of components that do not use them.
3. Hide or disable UI with `can(viewer, ...)`. The server action checks again; UI checks are never the guard.
4. When `workspace.readOnly` is true, staff screens show a banner from A's billing contract and disable writes. Learners and guardians are never blocked.
5. When `impersonatedBy` is set, the app shell shows a fixed banner with the admin's name and an "End impersonation" button (action supplied by A in `src/features/admin/actions.ts`).
6. Per-course services are **not** on the viewer. Use `hasService()` from [services.md](services.md).
7. Do not read `session.user.role` or call `auth()` directly in new code. `src/lib/auth.ts` stays as the session layer under `getViewer()`.

## Examples

```ts
// A staff page
const viewer = await requireViewer({ persona: "staff", workspace: true });
if (!can(viewer, "courses.create")) notFound();

// A server action
export const createCourse = staffActionClient
  .schema(CreateCourseSchema)
  .action(async ({ parsedInput, ctx: { viewer } }) => {
    if (!can(viewer, "courses.create")) throw new ViewerError("FORBIDDEN");
    // tenant-scoped data access via withWorkspace(viewer) (01, section 4)
  });

// The parent portal
const viewer = await requireViewer({ persona: "guardian" });
// viewer.children → child switcher
```

## Not in this contract

- Billing amounts, invoices and payment state for a course: [billing.md](billing.md).
- Services and tiers per course: [services.md](services.md).
- UI mode: removed.

## Change log

| Date | Change |
| --- | --- |
| 2026-11-20 | Draft 1.6. `user.mustChangePassword` (send to a set-password step; `setOwnPassword`). Tutor-created accounts, parent linking and staff invites: see "Accounts and invites" below |
| 2026-11-20 | Draft 1.5. `user.roleConfirmed`; `chooseAccountRole({ role: "TUTOR" \| "STUDENT" \| "PARENT" })` → `{ role, next }` (once, for self sign-ups; `src/features/users/choose-role.ts`). When `roleConfirmed` is false, send the user to `/dashboard/welcome`. Only confirmed tutors can `createWorkspace` |
| 2026-11-20 | Draft 1.4. `createWorkspace` takes `trial` (optional trial) |
| 2026-11-20 | Draft 1.3. `createWorkspace` and `updateWorkspaceProfile` (onboarding) |
| 2026-11-16 | Draft 1. No `mode` field (owner decision, plan revision 3) |
| 2026-11-16 | Draft 1.2. Client components import types and `can()` from `@/lib/viewer-core`, because `viewer.ts` is server-only. Phase 0 bridge: one comped organisation until Phase 1 (PR #63) |
| 2026-11-16 | Draft 1.1. Added `messages.announce` and `messages.direct` (A2 messaging design) |

## Accounts and invites (Draft 1.6)

Design 02, section 5 and 5.1; ux/01, sections 5 to 7. Server code: `src/features/users/accounts.ts` and `src/features/auth/invites.ts`.

| Name | Where | Who | Input | Returns |
| --- | --- | --- | --- | --- |
| `createStudentAccount` | `@/features/users/account-actions` | `learners.invite` (tutors: on each chosen course; at least one) | `{ fullName, email?, username?, isMinor = true, courseIds, consentAttested }` | `{ userId, learnerId, username, email, code, codeExpiresAt }`. Show `code` once (sign-in card) |
| `issueSignInCode` | same | manages the student, or a parent of one; never staff | `{ userId }` | `{ username, email, code, expiresAt }`. Signs them out everywhere. 10 an hour per tutor |
| `linkParent` | same | `guardians.link` on the student | `{ learnerId, name, email?, relationship }` | `{ guardianshipId, newAccount, username?, code?, codeExpiresAt? }`. An existing account by email is linked and emailed; otherwise a parent account is made with a code |
| `listParents` | same | `guardians.link` | `{ learnerId }` | `Array<{ guardianshipId, name, email, username, relationship, linkedAt }>` |
| `revokeGuardianship` | same | `guardians.link` | `{ guardianshipId }` | `{ status: "REVOKED" }` |
| `setOwnPassword` | same | the signed-in user while `mustChangePassword` | `{ newPassword }` | `{ ok }` |
| `inviteStaff` | `@/features/auth/invite-actions` | `members.invite` (only the owner invites admins) | `{ emails, role: "ADMIN" \| "TUTOR", courseIds? }` | per email `INVITED`, `RESENT` or `ALREADY_MEMBER` |
| `listInvites`, `revokeInvite` | same | `members.invite` | `{}` / `{ inviteId }` | invites with `state` (PENDING, EXPIRED, ACCEPTED, REVOKED) |
| `getInvite` | same | anyone (signed out too) | `{ token }` | `{ state, workspaceName, workspaceLogoUrl, role, invitedBy, expiresAt, emailMasked }` or null |
| `acceptInvite` | same | the signed-in user with the invited email | `{ token }` | `{ ok: true, workspaceId }` or `{ ok: false, reason: INVALID \| EXPIRED \| ACCEPTED \| REVOKED \| WRONG_ACCOUNT }` |

- **Sign-in codes** look like `KQ4M-2XD7-PA`. They are the first password, work typed in lower case or without dashes, and stop working after 14 days, or once the user sets their own password.
- **Signing in:** students and parents sign in with their **username** or email, plus the code (`signInWithPassword` in `auth-client.ts` uses the username when there is no `@`). They must then set a password: `viewer.user.mustChangePassword`.
- **No email:** a student or parent without one gets a placeholder address that is never mailed.
- **Invite emails** link to `/auth/invite/[token]` (B's page). It's valid for 7 days. Accepting needs that email signed in: a new person signs up with it first. An invited user's role is settled to tutor, so they skip the role choice.
