# Contract: `getViewer()`

Owner: Agent A. Reader: Agent B. Status: **Draft 1.12, 2026-11-21** (first draft 2026-11-16). B asks for changes in `docs/revamp/b/HANDOFF.md` or an issue labelled `needs-a`; A edits this file in its own pull request.

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
| 2026-11-21 | Draft 1.12. Owner decisions of 21 Nov (#206): `workspace.teaches`, `switchTeachingOff` and `adminSwitchTeachingOn`; course listings and join requests; `user.theme` and `updateOwnPreferences({ theme })`. Action errors written for the user (`UserError`) now reach `serverError` as written, instead of "Something went wrong" |
| 2026-11-21 | Draft 1.11. `viewer.mode` ("organisation" \| "tutor" \| null) and `switchViewerMode({ mode })` for owners and admins of an organisation who also teach (#192, owner decision). Tutor mode uses a tutor's grants, scoped to their courses. Two-factor setup works for Google-only accounts (`allowPasswordless`); email change with two-factor on needs a sign-in in the last 15 minutes |
| 2026-11-21 | Draft 1.10. Read-only workspaces (#189): staff lose every write permission except billing, fees, payouts and workspace settings (`READ_ONLY_STAFF_KEEPS`); `tutorActionClient` and `staffActionClient` refuse with `READ_ONLY: …`; `tutorReadActionClient` for exports that stay allowed. Enrolment outside the legacy workspace takes only the workspace's own students |
| 2026-11-20 | Draft 1.9. Email change: `requestEmailChange({ password, newEmail })`, `confirmEmailChange({ token })`, `revertEmailChange({ token })` in `@/features/auth/email-change-actions` (see "Privacy") |
| 2026-11-20 | Draft 1.8. POPIA rights: data export and account deletion (see "Privacy" below) |
| 2026-11-20 | Draft 1.7. `user.twoFactorEnabled` now read from the account; `user.twoFactorRequired` is true for workspace owners and Nexa admins without two-factor sign-in (design 02, section 7). After the Better Auth cutover, send them to set it up (`authClient.twoFactor.enable`) |
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

## Privacy (Draft 1.8)

Design 02, section 8. Server code: `src/features/users/export.ts` and `deletion.ts`; actions in `@/features/users/privacy-actions`.

| Name | Kind | Who | Input | Returns |
| --- | --- | --- | --- | --- |
| `GET /api/account/export` | route | signed in | `?userId=` (optional: a tutor, for a student they teach) | a JSON download of everything held about that person. 429 if one was made in the last 24 hours |
| `getAccountDeletionStatus` | action | signed in | `{}` | `{ soleOwnerOf: string[] }`: workspaces to hand over before deleting |
| `requestAccountDeletion` | action | signed in | `{ confirm: "DELETE" }` | `{ deleteOn, alreadyRequested }`. Signs them out everywhere and emails a cancel link |
| `cancelAccountDeletion` | action | anyone with the link | `{ token }` | `{ cancelled }`. The link goes to `/account/cancel-deletion?token=…` (B's page) |
| `requestStudentAccountDeletion` | action | `learners.invite` on the student (or the parent of one) | `{ userId, confirm: "DELETE" }` | same as above; for a parent's request |
| `cancelStudentAccountDeletion` | action | same | `{ userId }` | `{ cancelled }` |

**Notes:**
- **During the 14 days**, sign-in is refused with "This account is being deleted…".
- **After the grace**, the daily housekeeping job anonymises the account:
  - name "Former user", an `.invalid` email, no username;
  - sign-in data, preferences and notifications deleted;
  - tests, assignments and grades deleted;
  - memberships suspended and guardianships revoked;
  - invoices and payments kept with the name only.
- **Production** anonymises only with `ACCOUNT_DELETIONS=1`. Until then the job only reports what is due.
- **The sole owner** of a workspace must hand it over first.

**Email change (Draft 1.9):**
- **Request:** settings call `requestEmailChange({ password, newEmail })`. It returns `{ sentTo }`; the confirm link goes to the new address, lasts 1 hour, and can be requested once every 2 minutes.
- **Confirm:** `/account/confirm-email?token=…` is a button that calls `confirmEmailChange`. It returns `{ status: changed | invalid | expired | taken }`, and when it works it signs the user out everywhere, so send them to sign-in with the new address.
- **Undo:** the old address gets `/account/revert-email?token=…`, a button that calls `revertEmailChange`. It returns `{ status: reverted | invalid | expired | taken }` and works for 7 days.
- **Placeholder addresses:** a student replacing a placeholder with a first real address follows the same steps, and no notice goes to the placeholder.
- **Google-only accounts** have no password, so they can't change their email here yet.

## Organisation and tutor mode (Draft 1.11)

Owner decision, 2026-11-20 (#192).

- **Who gets a mode:** `viewer.mode` is set only for an OWNER or ADMIN of an **organisation** who also teaches at least one course (a CourseStaff row). It is null for everyone else, including solo workspaces and plain tutors.
- **Organisation mode** (the default) gives the full owner or admin grants.
- **Tutor mode** gives exactly a tutor's grants, with `needsScope` true for the scoped ones. They see and edit only their own courses, collect fees for their own students (fees.manage, scoped), and lose billing, members, teams and workspace settings.
- **Switching:** `switchViewerMode({ mode })` in `@/features/workspaces/actions` sets the `nexa_mode` cookie. It is FORBIDDEN when `viewer.mode` is null.

## Teaching, join requests and themes (Draft 1.12)

Owner decisions of 2026-11-21 (#206). Server code: `src/features/workspaces/teaching.ts` and `join-requests.ts`.

### Whether an organisation teaches

- **`viewer.workspace.teaches`** is false once an organisation has switched teaching off. It's always true for a solo workspace.
- **While it's off:**
  - `viewer.mode` is null, so there's no organisation/tutor switch;
  - owners and admins never become course staff. A course an owner creates has them as its owner but no lead, so they assign a tutor;
  - an admin invited with courses joins without teaching them.
  Plain tutors keep teaching.
- **Tutor lists:** list people who teach a course (CourseStaff), as now. An organisation that doesn't teach has no owner or admin among them, so it isn't listed as a tutor.

| Name | Where | Who | Input | Returns |
| --- | --- | --- | --- | --- |
| `switchTeachingOff` | `@/features/workspaces/actions` | the OWNER of an organisation | `{ confirmName }`: the organisation's name, typed | `{ teaches: false, since }`. Audited. Refused, with a message naming the courses, while an owner or admin still teaches one: hand them to a tutor first |
| `adminSwitchTeachingOn` | `@/features/admin/workspace-actions` | Nexa admin (`admin.override`) | `{ workspaceId, note }` | `{ teaches: true }`. Audited. `adminListWorkspaceBilling` rows carry `teachingOffAt` |

Show a strong warning before `switchTeachingOff`: only Nexa support can undo it.

### Course listings and join requests

Students and parents find listed courses and ask to join; staff approve or decline. Tutors can't search for self-registered students. When a tutor tries to add a student whose email already has an account, the error now tells them to ask the student to find the course and request to join.

| Name | Where | Who | Input | Returns |
| --- | --- | --- | --- | --- |
| `setCourseListed` | `@/features/workspaces/join-request-actions` | `courses.edit` (tutors: their courses); not in a read-only workspace | `{ courseId, listed }` | `{ listed }` |
| `browseCourses` | same | signed in | `{ q?, workspaceId?, cursor? }` | `{ courses: ListedCourse[], nextCursor }`, 24 a page. `ListedCourse` is `{ courseId, name, description, imageUrl, workspace: { id, name, kind, logoUrl }, tutors: string[], listedAt }`. Read-only and cancelled workspaces are hidden |
| `requestToJoin` | same | a student (for themself) or a parent (`studentUserId` = a linked child) | `{ courseId, studentUserId?, message? }` | `{ id, status: "PENDING" }`. Emails the course's lead staff |
| `cancelJoinRequest` | same | whoever asked | `{ requestId }` | `{ status: "CANCELLED" }` |
| `listMyJoinRequests` | same | signed in | `{}` | requests they made or that were made for them: `{ id, status, message, declineReason, createdAt, decidedAt, course: { id, name, imageUrl }, workspaceName, student: { id, name }, madeByMe }` |
| `listJoinRequests` | same | `learners.invite` (tutors, and owners in tutor mode: their courses) | `{ status? = "PENDING" }` | `{ id, status, message, declineReason, createdAt, decidedAt, course: { id, name }, studentName, parentName }`. `parentName` is set when a parent asked |
| `approveJoinRequest` | same | `learners.invite` on that course; not read-only | `{ requestId, isMinor, consentAttested? }` | `{ status: "APPROVED", learnerId }`. Adds the student to the workspace and enrols them; the student limit applies (`TRIAL_CAP_REACHED`). Emails whoever asked |
| `declineJoinRequest` | same | the same | `{ requestId, reason? }` | `{ status: "DECLINED" }`. The note (300 characters) goes into the email |

- **Consent:** a parent's request counts as consent for a minor. When a minor asked for themself, staff must tick that they hold a parent's consent (`consentAttested`), as in `createStudentAccount`.
- **Limits:** 5 open requests a person, 10 a day. One open request per course and student. The errors are written for the user.
- **Pages the emails link to (B's):** `/dashboard/join-requests` (staff inbox) and `/dashboard/courses/browse` (browse). Tell A if you choose other paths.
- **Server components** can call `listListedCourses`, `listMyJoinRequests` and `listJoinRequestsForStaff` from `@/features/workspaces/join-requests` directly.

### Colour theme

- **`viewer.user.theme`** is `"CALM"` (the default, mostly grey) or `"BRIGHT"`. The list is `UI_THEMES` in `@/lib/viewer-core`.
- **Changing it:** `updateOwnPreferences({ theme })`, the existing settings action.
- **New themes:** ask A to add a value before you ship one. It's a database enum.
