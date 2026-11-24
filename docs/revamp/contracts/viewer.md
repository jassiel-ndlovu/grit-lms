# Contract: `getViewer()`

Owner: Agent A. Reader: Agent B. Status: **Draft 1.26, 2026-11-24** (first draft 2026-11-16). B asks for changes in `docs/revamp/b/HANDOFF.md` or an issue labelled `needs-a`; A edits this file in its own pull request.

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
| 2026-11-24 | Draft 1.26. Branding (Plus), white-label (Pro; custom domains on hold) and bulk onboarding |
| 2026-11-24 | Draft 1.25. Enquiry pipeline (with a public form), tutor outcomes and staff reviews |
| 2026-11-24 | Draft 1.24. Timesheets, pay rates, payroll export and cover for absent tutors |
| 2026-11-24 | (No change here.) API keys, the REST API and webhooks have their own contract: `contracts/api.md` |
| 2026-11-24 | Draft 1.23. Pro AI drafts: lessons, tests and assignments from documents; feedback; report comments; curriculum gaps |
| 2026-11-23 | Draft 1.22. AI help for tutors (Plus limited, Pro more): question drafts, outlines, tidy text |
| 2026-11-23 | Draft 1.21. Session booking with prepaid lesson packs (Plus): availability, slots, bookings, credits |
| 2026-11-23 | Draft 1.20. At-risk alerts (Pro): `listRiskAlerts`, `shareRiskAlertAction`, `listMySharedRiskAlerts` and the rest |
| 2026-11-23 | Draft 1.19. Landing page: `getPublicPlans`, `submitPlatformEnquiry`, admin enquiries, sitemap, robots and analytics |
| 2026-11-23 | Draft 1.18. Term report PDFs (`renderTermReportPdf`, `pdfResponse`) and offline reading (`public/sw.js`, `@/lib/offline`) |
| 2026-11-23 | Draft 1.17. Roles as permission sets and branches (#216): `membership.roleKey`, `roleName`, `scope`, `branchIds`, `branchTeamIds`; six new permission keys; `staffScope`, `courseScopeOf` and `scopedCourseWhere`; role, branch and team actions in `@/features/workspaces/role-actions` |
| 2026-11-23 | Draft 1.16. Parent and student referrals (`getReferralLink`, `listReferrals`, `/api/referrals/<code>`); the weekly parent summary email; the attendance register is Core (check-in codes and absence emails stay Plus) |
| 2026-11-23 | Draft 1.15. Read-only workspaces keep every permission, so staff see their pages (#223); writes are refused on the server (`READ_ONLY: ...` from actions, 423 from API routes). `listListedCourses` also matches the tutor's name and takes `forUserIds`, returning `enrolledUserIds`; staff inbox rows carry `decidedBy` |
| 2026-11-22 | Draft 1.14. Themes OCEAN, SUNSET and CONTRAST (#217); `user.textSize` and `user.readingFont` (#216); `workspace.meetingProvider` and `setMeetingProvider` (#211); `signUpWithPassword({ callbackUrl })` (#174); `writableViewerActionClient` (refused for staff in a read-only workspace). NextAuth is gone: no `/api/auth/*` route remains |
| 2026-11-21 | Draft 1.13. Staff manage only the accounts their workspace made (`User.managedByWorkspaceId`, migration 23): `resetUserPassword`, `issueSignInCode` and `requestStudentAccountDeletion` refuse a self-made account with a `UserError` saying the person manages it themself. Tutors invoice or set fees only for a student on that course. `changeOwnPassword` works for accounts made since the cutover |
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

- **`viewer.user.theme`** is one of `UI_THEMES` in `@/lib/viewer-core`: `"CALM"` (the default, mostly grey), `"BRIGHT"`, `"OCEAN"`, `"SUNSET"` or `"CONTRAST"` (Draft 1.14).
- **Changing it:** `updateOwnPreferences({ theme })`, the existing settings action.
- **New themes:** ask A to add a value before you ship one. It's a database enum.

### Who manages an account (Draft 1.13)

- **Managed accounts:** a student or parent made by a workspace's staff (`createStudentAccount`, `linkParent` for a new parent, the older admin form) is managed by that workspace. Its staff may reset the password, issue sign-in codes and delete the account on a parent's request, as before.
- **Self-made accounts:** someone who signed up themself, even after a join request, manages their own account. Staff get "This person manages their own account…" from `resetUserPassword`, `issueSignInCode` and `requestStudentAccountDeletion`. Hide or disable those buttons when the account isn't managed by the workspace. Ask A for a field on your student queries if you need one.
- **Another workspace's accounts:** a managed student who also joined another workspace is managed only by the first.
- **On Preview,** the seeded adult student (`seed.adult`) stands in for a self-made account.

### Accessibility and the meeting provider (Draft 1.14)

- **`viewer.user.textSize`** is `"DEFAULT"`, `"LARGE"` or `"LARGER"` (`TEXT_SIZES`), and **`viewer.user.readingFont`** is `"DEFAULT"` or `"DYSLEXIA"` (`READING_FONTS`). Both are saved with `updateOwnPreferences({ textSize, readingFont })` and follow the user across devices.
- **`viewer.workspace.meetingProvider`** is `"GOOGLE_MEET"` (default), `"ZOOM"`, `"TEAMS"` or `"OTHER"` (`MEETING_PROVIDERS`). Owners and admins change it with `setMeetingProvider({ meetingProvider })` in `@/features/workspaces/actions`. It's audited and refused in a read-only workspace.
- **`signUpWithPassword({ name, email, password, callbackUrl? })`:** the verification link returns to `callbackUrl` when it's a same-site path (for example `/auth/invite/<token>`), otherwise to `/dashboard/welcome`.
- **`writableViewerActionClient`** (`@/lib/safe-action`) is `viewerActionClient` plus the read-only guard. The AI marking writes (`setTestAiMarking`, `requestAiMarking`, `recordAiSuggestionAction`) now use it, so in a read-only workspace they return `READ_ONLY: …` instead of "You don't have access".

### Read-only workspaces and Find courses (Draft 1.15)

- **Read-only staff keep every permission** (#223). Show pages and navigation as usual. Lock buttons with `WriteGuard` (`viewer.workspace.readOnly`).
  - The server refuses writes: the tutor, staff and writable action clients return `READ_ONLY: ...`, and the API write routes answer 423.
  - Billing, fees, payouts, workspace settings, privacy requests and the learner side keep working.
- **`listListedCourses({ q, forUserIds })`:**
  - `q` also matches the lead tutor's name.
  - Pass the viewer's id and their children's ids in `forUserIds`. Each course then has `enrolledUserIds`: show "You're on this course" or the child's name instead of "Ask to join". `browseCourses` passes them for you.
- **`listJoinRequestsForStaff` rows** have `decidedBy: { id, name } | null`. Compare `decidedBy.id` with the viewer before labelling a note "Your note".

### Referrals, the weekly parent summary and attendance (Draft 1.16)

**Referrals (Core):**
- **`getReferralLink({ workspaceId? })`** in `@/features/workspaces/join-request-actions`, for a student or parent in the workspace (the active one if omitted). Returns `{ code, url, requested, joined }`. Show the URL with a copy button and a share button, and the two counts.
- **The link** `/api/referrals/<code>` keeps the code for 30 days and opens `/dashboard/courses/browse?workspace=<id>`. **Please make Find courses filter by `workspace`.** A family that then asks to join a course in that workspace is credited to the referrer; approval marks it joined.
- **What doesn't count:** your own link, a parent's link for their own child, or a student already in the workspace. Each student counts for one referrer: the first.
- **`listReferrals({})`** for owners and admins: `{ referrals: [{ referrerName, referredName, status: "REQUESTED" | "JOINED", createdAt, joinedAt }], byReferrer: [{ referrerId, name, requested, joined }] }`.
- **Rewards aren't decided yet** (the owner's call): show who referred whom, nothing about prizes.

**Weekly parent summary (Core):**
- Every Monday morning (South African time), each parent with a verified email gets one email covering each linked child:
  - the past week's new marks;
  - the coming week's tests and assignments, with whether each is done;
  - the week's attendance.
- Weeks with nothing to report send nothing. "Email notifications" off in settings turns it off. Nothing needed from B, apart from saying so on the notifications settings page if you like.

**Attendance:**
- **Core:** the register (`getAttendanceSheet`, `markAttendance`).
- **Plus (`live-sessions`):**
  - `openCheckIn` refuses with "Check-in codes are part of the Plus plan for this course".
  - `markAttendance` emails parents about an absence only on Plus.
- With billing off, every course has every service, as before.

### Roles and branches (Draft 1.17)

Owner decision of 22 Nov. A role is a name, a set of permissions and a **scope**:
- `WORKSPACE`: the whole organisation;
- `BRANCHES`: the courses of chosen branches, reached through their teams;
- `OWN_COURSES`: the courses the person teaches or owns.

The three base roles are presets too, so existing members are unchanged. Presets are in `@/lib/roles` (client-safe):

| Preset | Scope | Holds |
| --- | --- | --- |
| Owner | workspace | everything |
| Admin | workspace | everything except closing the organisation and connecting payouts |
| Tutor | own courses | teaching, marking, fees for their students |
| Executive | workspace | reads reports, content, grades, billing; changes nothing |
| Branch manager | branches | staff, courses, students, fees, enquiries, cover, reports |
| Project manager | branches | courses, enrolments, timetable, reports; no money |
| Finance | workspace | billing, fees, payouts, timesheets, AI credits |
| Support staff | branches | students, parents, sign-in codes, messages, enquiries |
| Assistant tutor | own courses | marks and comments; no setup or fees |

**New permission keys** (gate the coming tools on them): `reports.view`, `timesheets.manage`, `enquiries.manage`, `cover.manage`, `ai.credits.allocate`, `staff.reviews`. Owners and admins hold all six.

**On the viewer:**
- `viewer.membership` gains `roleKey` (a preset key or `custom:<id>`), `roleName`, `scope`, `branchIds` and `branchTeamIds`. Show `roleName` wherever you show someone's role.
- **`needsScope(viewer, p)`** is now true for branch roles as well as tutors.
- **`staffScope(viewer)`** gives the scope.
- **`courseScopeOf(viewer, p)`** returns `{ membershipId, branchIds }`, or null for the whole workspace.
- **`scopedCourseWhere(scope)`** is the Prisma filter for those courses: owned, taught, or in a branch's team.
- **`canIn`** handles branches for `courseId` and `teamId`.
- **Please move B's course scope onto these:** `features/courses/lib/course-access.ts` (`manageableBy`) and `features/courses/fee-courses.ts`. Until then, a branch manager sees only the courses they teach on your pages, which is too narrow but never too wide.

**Actions** in `@/features/workspaces/role-actions`, organisations only, writes refused when read-only:

| Action | Needs | Input | Returns |
| --- | --- | --- | --- |
| `listRoles` | `members.role` | `{}` | `{ presets: [{ key, name, description, scope, permissions, assignable, members }], custom: [{ key, id, name, basedOn, scope, permissions, members }] }` |
| `createRole` | `members.role` | `{ name, basedOn, permissions, scope }` | `{ key, id }`. Never more than an admin, nor more than the creator holds |
| `updateRole`, `deleteRole` | `members.role` | `{ roleId, ... }` / `{ roleId }` | a role in use can't be deleted |
| `setMemberRole` | `members.role` | `{ membershipId, roleKey, branchIds? }` | `{ roleKey, roleName, scope, branchIds }`. Branch roles need at least one branch. Nobody changes their own role or an owner's, or gives more than they hold |
| `listBranches` | `teams.manage` or `members.role` | `{}` | `{ branches: [{ id, name, people, teams: [{ id, name, courses, members }] }], teamsWithoutBranch }` |
| `createBranch`, `renameBranch`, `deleteBranch` | `teams.manage` | `{ name }` / `{ branchId, name }` / `{ branchId }` | Only whole-organisation roles add or remove branches. A branch with teams or people can't be deleted |
| `createTeam`, `updateTeam`, `deleteTeam` | `teams.manage` | `{ name, branchId? }` / `{ teamId, name?, branchId? }` / `{ teamId }` | A branch manager manages teams only in their branches. A team with courses can't be deleted |
| `setTeamMember` | `teams.manage` | `{ teamId, membershipId, member, isLead? }` | |
| `setCourseTeam` | `teams.manage` | `{ courseId, teamId }` | Puts a course in a team, and so in that team's branch |

**Not yet:** invitations aren't bound to a branch, so a branch manager inviting staff invites them to the organisation. Groups of organisations come later.

### Term report PDFs (Draft 1.18)

B's request. **B gathers the report; A turns it into a PDF.** It's rendered on request and nothing is stored, like invoices.

- **Where:** `@/features/reports/term-report-pdf` (server code; pdf-lib).
- **`renderTermReportPdf(data)`** returns `Uint8Array` (A4). `data` is a `TermReportPdfData`:
  - `workspace: { name, logo?: Uint8Array, contact? }` (the logo is a PNG or JPEG's bytes; a broken one is skipped);
  - `term: { title, from, to }`;
  - `student: { name, grade?, username? }`;
  - `courses: [{ name, tutor?, percent: number | null, symbol?, items: [{ title, kind?, score: number | null, outOf, weight? }], attendance?: { present, late, absent, excused }, comment? }]`;
  - `overall?: { comment?, by? }`;
  - `generatedAt` and `timeZone`.
- **What it shows:** a header, a summary (courses, the average across marked courses, and attendance), one block per course with its assessments, attendance and the tutor's comment, a general comment, and signature lines.
- **Long reports** run onto more pages with "continued" headers and page numbers. Characters outside the standard PDF fonts show as "?".
- **How B calls it:** from B's own route handler, for example `src/app/dashboard/reports/[studentId]/[term]/route.ts`. Check permission there: staff with `grades.view` on the student's courses, or the parent or adult student. Then `return pdfResponse(await renderTermReportPdf(data), termReportFileName(name, term))`.
- **Checked by** `scripts/check-term-report-pdf.ts` (in CI). Pass an output path to get sample PDFs.

### Offline reading (Draft 1.18)

Core, with B's data-saver mode.
- **The service worker** (`public/sw.js`) keeps app files as they load, and keeps a lesson page only when the student saves it.
- **Offline:** a saved lesson opens from the phone; any other page shows `/offline.html`, which lists the saved lessons.
- **Never cached:** API calls, sign-in pages and anything but GET.
- **Sign-out:** `appSignOut` clears saved lessons, for shared phones.
- **Limits:** 50 lessons a device, oldest dropped first.

From `@/lib/offline` (client):

| Call | What it does |
| --- | --- |
| `registerOfflineSupport()` | Call once from a client component in the dashboard layout. Production builds only |
| `saveLessonForOffline(path, title)` | For a "Save for offline" button on `/dashboard/courses/lessons/[id]`. Returns `{ ok, error? }` |
| `removeSavedLesson(path)`, `listSavedLessons()` | For a "Saved for offline" list: `{ url, title, savedAt }[]` |
| `clearOfflineData()` | Already called by `appSignOut` |
| `offlineSupported()` | Hide the button where it can't work |

**Note for B:** a saved page is the lesson's HTML as it was when saved. Videos and big images aren't kept, so show "Video needs a connection" in data-saver style.

### Landing page (Draft 1.19)

#216: B owns the page; A owns these parts.

**Plan prices.** `getPublicPlans()` from `@/features/marketing/plans` (server; cached for an hour). It returns `PublicPlans`:
- `live`: false until billing is switched on (January). **Show prices only when `live` is true.** Before that, show "Plans and prices are coming in January" or leave them out.
- `plans`: Core, Plus and Pro, each `{ key, name, priceCents, priceLabel ("R139"), aiCreditsPerSeat, adds, includes }`.
  - `adds` lists the v1 services the plan adds over the one below; `includes` lists everything on it. Show `adds` as "Everything in Core, plus …".
- `unit` ("per active student, per course, per 30 days"), `vatNote` ("Prices exclude VAT.") and `trialDays` (14). Show the unit and VAT note beside the prices.
- Prices are never written in the page: they come from the Tier rows, so a price change is a data change.

**Enquiry form.** It replaces the `mailto:` "Request access" and team links.
- Call `submitPlatformEnquiry` (next-safe-action, public) from `@/features/marketing/enquiry-actions` with:
  - `kind`: `"ACCESS"` (a tutor wanting an account), `"TEAM"` (an organisation) or `"OTHER"`;
  - `name`, `email` and `message` (10 to 4000 characters);
  - optional `phone`, `organisation` and `students` (a number);
  - `source`: the page path, or a utm_source;
  - `startedAt`: `Date.now()` when the form was shown;
  - `website`: a honeypot field. Keep it in the form but hidden from people (off-screen, `tabIndex={-1}`, `autoComplete="off"`, `aria-hidden`), and send what's in it.
- It returns `{ ok: true }`. Show "Thanks, we'll be in touch within one working day." Errors come back as `serverError` strings written for the person (too many enquiries, or "reload the page"); show them as they are. Validation errors come back in `validationErrors`.
- Each enquiry emails the Nexa inbox, with Reply-To set to the enquirer. Nothing is emailed to the enquirer.
- Rate limits: 5 an hour from one address and 3 a day from one email. Bots and link spam get `{ ok: true }` but are saved as SPAM and never emailed.
- Kept 12 months, then deleted. The IP is stored only as a keyed hash.

**Admin enquiries** (B, a page under `/dashboard/admin`, Nexa admin only):
- `adminListEnquiries({ status?, cursor?, limit? })` returns `{ items, nextCursor, newCount }`. Without `status` it shows everything but SPAM.
- `adminUpdateEnquiry({ id, status: "NEW" | "CONTACTED" | "CLOSED" | "SPAM", note? })`.
- Show `newCount` as a badge. The email's button links to `/dashboard/admin` until this page exists; tell A its path and A will point the email there.

**Search setup:**
- `/sitemap.xml` lists the public pages in `PUBLIC_PAGES` (`@/lib/site`). B adds a page there when shipping a new public page.
- `/robots.txt` keeps crawlers out of signed-in areas and APIs. Preview deployments ask every crawler to stay out.
- The root layout sets `metadataBase`, Open Graph and Twitter cards, and `noindex` off production.
- Each public page should export `metadata` with `title`, `description` and `alternates.canonical`. A added it to support, privacy and terms, and a canonical to `/`.
- **Social image:** add `src/app/opengraph-image.png` (1200×630) when the design is ready; Next picks it up.

**Analytics:** Vercel Web Analytics (`<SiteAnalytics />` in the root layout, production only).
- It uses no cookies, so no consent banner is needed.
- It counts public pages only. Signed-in pages, invite links and query strings (except utm tags) are never sent.
- The owner switches it on once in Vercel (Project, Analytics, Enable).
- For a custom event, such as "enquiry sent", B may call `track("enquiry_sent", { kind })` from `@vercel/analytics`. Never include a name, email or id.

### At-risk alerts (Draft 1.20)

#216 phase 2, **Pro** (service `at-risk-alerts`).

**How it works:**
- A daily job (from housekeeping) reads each enrolled student's last 28 days in every Pro course: marks, work whose due date passed without a hand-in, and attendance.
- It applies the rules in `@/features/risk/rules` (`RISK_RULES` holds the thresholds, which are provisional):
  - **Falling marks:** the last 3 marks average 15 or more points below the 5 before them.
  - **Low marks:** the last 3 average below 50%.
  - **Missed work:** 2 or more pieces.
  - **Absences:** 2 or more unexcused absences, or under 75% over at least 4 sessions.
- **Levels:**
  - `WATCH` when one kind of problem fires.
  - `AT_RISK` when two kinds fire, or one is serious: marks below 40%, 3 missed pieces, or 3 absences.
- An alert opens once per course and student, is updated each day, escalates from WATCH to AT_RISK, and closes on its own (`RESOLVED`) when the rules stop firing.
- Course staff get one in-app notification per course when alerts open or escalate. The link is `/dashboard/courses/<courseId>/at-risk`: please build that page, or tell me the path you choose.
- **Nothing goes to students or parents until staff share it.**

**Staff** (from `@/features/risk/actions`). Each needs `grades.view` on the course; branch and own-course scopes apply.

| Action | Input | Returns |
| --- | --- | --- |
| `listRiskAlerts` | `{ courseId?, status?: "open" \| "closed" \| "all", limit? }` | `StaffRiskAlert[]`: `{ id, course, student: { userId, name }, level, status, reasons, summary, firstSeenAt, lastSeenAt, sharedAt, sharedWith, shareNote, closedAt, canShareWith: { guardians, student } }`, AT_RISK first |
| `countRiskAlerts` | `{}` | `{ [courseId]: openCount }`, for badges |
| `shareRiskAlertAction` | `{ alertId, withGuardians, withStudent, note? }` | `{ ok, sentTo, emailed }`. Also needs `messages.direct`. Pro only: otherwise `serverError` is "At-risk alerts are part of the Pro plan for this course." |
| `dismissRiskAlertAction` | `{ alertId }` | "Not a concern": closes it and keeps quiet for 14 days |
| `resolveRiskAlertAction` | `{ alertId }` | "Sorted": closes it; a new alert opens if the rules fire again |

- **`summary`** is plain language, one sentence per reason, written about the student by first name. For example: "Thandi hasn't handed in 2 pieces of Mathematics work due since 3 November: Essay and Test 2." Show it as it is.
- **`reasons`** is structured, for icons or chips: `{ rule: "FALLING_MARKS", from, to }`, `{ rule: "LOW_MARKS", average, count }`, `{ rule: "MISSED_WORK", count, titles, since }` or `{ rule: "ABSENCES", absent, sessions }`.
- **The share dialog:**
  - Show tick boxes for "Parents (n)" and "The student" from `canShareWith`, plus a note field (optional, up to 1000 characters).
  - Show the summary as it will be sent.
  - Disable a tick box when its count is 0 or its value is false.
- **Sharing:**
  - It emails each recipient (template `risk:shared`; a parent version and a student version) and leaves an in-app notice.
  - It sets `status: "SHARED"`.
  - Sharing again sends again.
  - A recipient who switched email off gets the in-app notice only.
- **Read-only workspaces:** the three write actions are refused.

**Students and parents:** `listMySharedRiskAlerts({})` returns what was shared with them in the last 90 days: `{ id, course, student, summary, note, sharedAt, sharedBy, open }`. A student sees alerts shared with the student; a parent sees alerts shared with parents, for each linked child. Show it as "Notes from your tutors" on their home page.

**Privacy:** alerts are part of a student's data export (`riskAlerts`) and are deleted with the account. Deleting a course or workspace deletes its alerts.

**AI summary (Pro, later):** an optional AI rewrite of the summary comes with the AI service (phase 2, Plus AI), and will use AI credits.

### Session booking (Draft 1.21)

#216 phase 2, **Plus** (service `session-booking`, per course). Everything is in `@/features/booking/actions` and uses the workspace's time zone (`timeZone` in the results). Times go in and out as ISO strings or `Date`.

**Tutors' availability** (staff; their own, or anyone's with `cover.manage` by passing `membershipId`):

| Action | Input | Notes |
| --- | --- | --- |
| `getBookingAvailability` | `{ membershipId? }` | Returns `{ membershipId, name, timeZone, rules, timeOff, policy }` |
| `setBookingAvailability` | `{ membershipId?, rules: [{ weekday 0–6 (Sunday 0), startMinute, endMinute, slotMinutes = 60, bufferMinutes = 0, courseId? }] }` | Replaces all rules. Minutes count from local midnight (15:30 = 930). `courseId` limits a rule to one course the tutor teaches. Rules on the same day may not overlap. Errors are written for people |
| `addBookingTimeOff` | `{ membershipId?, startsAt, endsAt, note? }` | Returns `{ id, bookingsInside }`. Existing bookings stay; if `bookingsInside > 0`, offer to cancel them |
| `removeBookingTimeOff` | `{ id }` | |
| `setBookingPolicyAction` | `{ cancelHours, leadHours, horizonDays }` | Needs `workspace.settings`. Defaults are 24 hours, 12 hours and 28 days |

**Booking** (students for themselves; parents pass `learnerId` for a child; staff on the course pass the student's `learnerId`):

| Action | Input | Returns |
| --- | --- | --- |
| `getBookingSlots` | `{ courseId, learnerId?, membershipId?, from, to }` (at most 31 days) | `{ timeZone, tutors: [{ membershipId, name, slots: [{ start, end }] }], credits: { needed, balance }, policy }` |
| `bookSessionAction` | `{ courseId, membershipId, startsAt, learnerId?, note? }` | `{ id, startsAt, endsAt, usedCredit, creditsLeft }` |
| `cancelBookingAction` | `{ bookingId, reason? }` | `{ ok, creditReturned }` |
| `listBookingsAction` | `{ from, to, courseId?, membershipId? }` (at most 93 days) | `BookingRow[]`: `{ id, course, tutor, student, startsAt, endsAt, status, note, meetingLink, usedCredit, cancelledAt, cancelReason, creditReturned, canCancel, cancelReturnsCredit }` |
| `markBookingAction` | `{ bookingId, status: "COMPLETED" \| "NO_SHOW" }` | Tutor or staff, once the lesson has started |
| `setBookingLinkAction` | `{ bookingId, meetingLink }` | Tutor or staff; an https link, or null |

**Slots:**
- Free slots come from the weekly rules, minus time off, existing bookings and the tutor's own classes (every course they teach).
- They start at least `leadHours` from now and at most `horizonDays` ahead.
- A booking must be one of the free slots. If someone took it first, the error is "That time isn't free any more. Pick another."
- A student can't hold two lessons at the same time.

**Who sees bookings:**
- `listBookingsAction` with no filters gives a tutor their own bookings, a student theirs, and a parent their children's.
- With `courseId`, staff who may edit the course see all of its bookings.
- With `membershipId`, `cover.manage` shows another tutor's bookings.

**Cancelling:**
- The family may cancel until the lesson starts. The credit comes back when they cancel at least `cancelHours` before.
- A tutor or staff cancellation always returns the credit.
- Show `cancelReturnsCredit` in the confirm dialog, for example "You'll get the lesson back" or "It's less than 24 hours away, so the lesson won't come back."

**Emails:**
- On booking and cancelling, the tutor, the student (with a real email) and their parents are emailed, except the person who did it.
- A reminder goes about 24 hours before.
- In-app, the tutor is told about new bookings.
- Links point to `/dashboard/bookings`. Please build that page: the student and parent list, and the tutor's week.

**Lesson packs and credits:**
- A pack is a `LESSON_PACK` fee schedule (the existing fees screens set it up, with `lessonsInPack`).
- **If a course sells packs, booking needs a credit**: "There are no lessons left on the pack for this course. Buy a pack to book." If it doesn't, booking is free.
- A paid pack invoice (online or marked paid offsite) gives `lessonsInPack × quantity` credits for that course automatically. A fully refunded one takes them back.
- `getLessonCredits({ learnerId? })` returns `{ learnerId, courses: [{ courseId, courseName, balance, needsCredits, packs: [{ id, description, amountCents, lessons }] }] }`. Students may omit `learnerId`.
- `buyLessonPackAction({ feeScheduleId, learnerId? })` is for parents, or an adult student with `paymentVisible`. It returns `{ invoiceId }`: then use the usual checkout (`startCheckout`) for that invoice. It works once billing is on (January); until then hide "Buy".
- `adjustLessonCreditsAction({ learnerId, courseId, lessons: ±n, note })` is for staff with `fees.manage`. Use it for a cash payment or a goodwill lesson.

**Plus gate:** slots and booking refuse with "Session booking is part of the Plus plan for this course." when the course doesn't have the service.

**Privacy:** bookings and the credit ledger are in the user export. Anonymising an account clears booking notes and reasons; the bookings stay as the tutor's record.

### AI help for tutors (Draft 1.22)

#216 phase 2. Service `ai-assist` (Plus). Owner, 22 Nov: "Plus gets a taste of AI and Pro gets all of it".

All actions are in `@/features/ai-assist/actions` and need staff with `courses.edit` on the course. **Every result is a draft:** nothing is saved. B shows it, the tutor edits and picks, and B saves what they keep through B's own actions.

| Action | Input | Returns |
| --- | --- | --- |
| `getAiAssistStatus` | `{ courseId }` | `{ available, tier, model, features: { QUESTIONS, OUTLINE, TIDY: { tier, limit, used, left } }, resetsOn }`. Hide the buttons when `available` is false; show "n left this month" |
| `generateQuestionsAction` | `{ courseId, lessonId?, topic?, count 1–10, types: ("MULTIPLE_CHOICE" \| "MULTI_SELECT" \| "TRUE_FALSE" \| "SHORT_ANSWER" \| "NUMERIC" \| "ESSAY")[], difficulty: "easy" \| "medium" \| "hard" }` | `{ runId, questions: DraftQuestion[], note, allowance }` |
| `outlineFromDocumentAction` | `{ courseId, text?, fileUrl? }`. `fileUrl` is a PDF or text file uploaded to Vercel Blob (your uploader), at most 15 MB; or pasted text, at most 120,000 characters | `{ runId, outline: { title, summary, sections: [{ title, objectives, lessons: [{ title, summary, topicCodes }] }], note }, allowance }` |
| `tidyTextAction` | `{ courseId, text (20–12,000 characters), mode: "tidy" \| "simplify", readingLevel? }` | `{ runId, text, changes: string[], allowance }`. Show it as a before-and-after for the tutor to accept |

**`DraftQuestion`** has: `type`, `question`, `points` (1–20), `options`, `correctOptions` (zero-based), `trueFalse`, `numericAnswer`, `numericTolerance`, `modelAnswer`, `explanation`, `topicCodes` and `difficulty`.
- Maths is TeX between `\\( … \\)`.
- Map it onto your `TestQuestion` or `BankQuestion` shapes: the options and answer JSON for each type, and `modelAnswer` plus `explanation` for the memo.
- `topicCodes` only ever contains codes from the course's curriculum list (empty when the course has none).
- Show `note` above the drafts when it isn't empty.

**Limits:**
- Runs a month per workspace (`AI_ASSIST_LIMITS`, provisional):
  - **Plus:** 10 question batches, 3 outlines and 50 tidy-ups.
  - **Pro:** 200, 50 and 500.
  - **Core:** none.
- The plan is the course's, from its switched-on services. Before billing is on, a Core course counts as Plus.
- Refusals come back as `serverError`, written for people:
  - Plus at its cap points to Pro;
  - when AI credits run out, the message is the credits message.
- With billing on, every run spends AI credits for what it cost, including failed runs.

**Outline scope:** on Plus this is the outline only. Lessons, tests and assignments from documents are Pro, in phase 3.

**Model:** Claude Opus 5.5 by default (`AI_ASSIST_MODEL` overrides), with Anthropic's refusal fallback. On Preview, a run of 2 questions cost about 63 credits, an outline about 107 and a tidy-up about 16 (1 credit = R0.01).

**Privacy:** only the course's name and level, the lesson or document text, and up to 30 existing question stems (to avoid repeats) are sent. No names, emails or ids are sent. Run rows (`AiAssistRun`) keep counts and cost, never the text.

#### Pro AI drafts (Draft 1.23)

#216 phase 3. **Pro only.** Plus and Core get "This AI help is part of the Pro plan for this course."

These use the same service, gate, credits and run records as above. They're in `@/features/ai-assist/actions`, need staff with `courses.edit` on the course, and return drafts only. `getAiAssistStatus` now lists all seven features.

| Action | Input | Returns | Monthly runs on Pro |
| --- | --- | --- | --- |
| `lessonsFromDocumentAction` | `{ courseId, text? \| fileUrl?, lessons 1–8 = 4, tests 0–2 = 1, questionsPerTest 1–10 = 8, assignments 0–2 = 0, focus? }` | `{ runId, drafts: { lessons: [{ title, summary, body, topicCodes }], tests: [{ title, instructions, questions: DraftQuestion[] }], assignments: [{ title, brief, rubric: [{ criterion, points }], modelAnswer }], note }, allowance }` | 40 |
| `feedbackDraftAction` | `{ courseId, question, answer, memo?, maxPoints?, tone?: "warm" \| "direct", studentUserId? }` | `{ runId, feedback, strengths, nextSteps, suggestedMark, allowance }` | 2000 |
| `reportCommentsAction` | `{ courseId, from, to, term, learnerIds? (up to 40), notes?: { [learnerId]: string }, tone?: "warm" \| "formal" }` | `{ runId, comments: [{ learnerId, studentUserId, name, comment }], allowance }` | 100 batches |
| `curriculumGapsAction` | `{ courseId }` | `{ runId, covered, total, missing: [{ code, title, suggestion, lessonId, lessonTitle, newLessonTitle }], restructure: [{ suggestion, why }], note, allowance }` | 30 |

- **Lessons:** `body` is plain text. Lines starting `## ` are headings, `- ` are list items, and maths is TeX. Convert it to your lesson document format. The review screen should let the tutor pick which lessons, tests and assignments to create.
- **Feedback:** it goes in the grading screen beside the answer. Pass the student's `studentUserId` so their name is scrubbed; emails, phone and ID numbers are always scrubbed. `suggestedMark` is a suggestion only; the tutor marks.
- **Report comments:**
  - A gathers each student's marks, attendance and missed work for the course between `from` and `to`.
  - Students go to the model as S1, S2…, and names are filled in afterwards.
  - Use it in your term-report screen. `notes` are the tutor's own short notes per learner, used as a hint.
- **Curriculum gaps:** the course needs its curriculum, subject and grade set; otherwise the error says so. `missing` lists every topic no lesson or question tags yet, in curriculum order:
  - with `lessonId` when the AI suggests extending that lesson;
  - with `newLessonTitle` when it suggests a new one;
  - with an empty suggestion when the model skipped it.
- **Cost on Preview** (1 credit = R0.01): lessons from a short document about 145 credits, feedback about 31, six report comments about 42, gaps about 113. Long drafts are streamed, so a big document won't time out.

### Timesheets and cover (Draft 1.24)

#216 phase 3, organisations. Actions are in `@/features/staff/actions`.
- **Who:** a tutor works on their own timesheet. A manager with `timesheets.manage` (Finance, Branch manager, Admin, Owner) works on the staff in their scope: the whole organisation, or members of teams in their branches.
- **Cover** needs `cover.manage`, with the same scoping.

**Timesheets** run by month (`YYYY-MM` in the workspace's time zone):

| Action | Input | Notes |
| --- | --- | --- |
| `getTimesheetAction` | `{ month, membershipId? }` | Returns `{ month, membershipId, name, as: "self" \| "manager", sheet: { id, status, submittedAt, decidedAt, decisionNote, hourlyCents, totalMinutes, amountCents }, entries, suggestions, totals: { minutes, hours, hourlyCents, amountCents }, editable }`. Opening a month creates its DRAFT |
| `addTimesheetSuggestionsAction` | `{ timesheetId, keys? }` | Adds the suggested entries; without `keys`, all of them. Each suggestion is added once |
| `addTimesheetEntryAction` | `{ timesheetId, startsAt, minutes, label, courseId?, note? }` | Other work, such as marking or preparation. 1 minute to 12 hours, dated inside the month |
| `updateTimesheetEntryAction` / `removeTimesheetEntryAction` | `{ entryId, minutes?, note?, label? }` / `{ entryId }` | Only while DRAFT or REJECTED |
| `submitTimesheetAction` | `{ timesheetId }` | DRAFT or REJECTED → SUBMITTED. Needs at least one entry |
| `decideTimesheetAction` | `{ timesheetId, decision: "APPROVED" \| "REJECTED" \| "DRAFT", note? }` | Managers only, never on their own sheet. Rejecting needs a note. Approving records the rate and pay at that moment. `DRAFT` reopens an approved sheet |
| `setPayRateAction` | `{ membershipId, hourlyCents }` | Managers. R0 to R10,000 an hour. Applies to sheets approved from then on |
| `listTimesheetsAction` | `{ month, status? }` | Managers: one row per tutor in scope, even before they open the month: `{ membershipId, name, email, hourlyCents, timesheetId, status, totalMinutes, amountCents, submittedAt }` |

- **Suggestions** come from:
  - class occurrences of the tutor's courses: LECTURE, LIVE and EXAM, not cancelled, minus classes someone covered for them;
  - classes they covered;
  - their booked lessons marked COMPLETED or NO_SHOW.
  - Each has a `kind` (SESSION, COVER or BOOKING), `minutes`, `label` and `startsAt`.
- **Payroll download:** `GET /api/exports/payroll?month=YYYY-MM` gives one row per tutor with an APPROVED sheet: hours, rate and amount. Add `&detail=1` for one row per entry. It's audited.

**Cover:**

| Action | Input | Notes |
| --- | --- | --- |
| `requestCoverAction` | `{ eventId, occurrenceStart, absentMembershipId?, reason? }` | A tutor for their own class, or a manager for someone in scope. One live request per occurrence |
| `coverCandidatesAction` | `{ coverId }` | Free tutors in scope: no class, booking or other cover at that time. Those who teach the course come first, then the same subject: `[{ membershipId, name, teachesCourse, sameSubject }]` |
| `assignCoverAction` | `{ coverId, coverMembershipId }` | See below. Returns `{ ok, addedToCourse }` |
| `cancelCoverAction` | `{ coverId }` | The absent tutor (while OPEN) or a manager. Removes access added only for this cover |
| `listCoverAction` | `{ from, to, status? }` | A manager sees cover for the staff they manage; a tutor sees their own requests and their covers |

**Assigning cover:**
- If the cover tutor doesn't teach the course, they join it as ASSISTANT until a day after the class. Housekeeping then removes that access.
- The cover tutor gets an email (`staff:cover-assigned`) and an in-app note; the absent tutor gets an in-app note.
- The class moves to the cover tutor's timesheet suggestions as COVER.

**For B:**
- **"My timesheet":** month picker, suggestions with "Add all", entries, totals, Submit.
- **"Timesheets" for managers:** month list with status badges, approve or reject with a note, pay rates, the payroll download.
- **Calendar:** on an occurrence, "I need cover" for the tutor and "Arrange cover" for managers, with the candidate list.

### Enquiry pipeline (Draft 1.25)

#216 phase 3, organisations. This is a workspace's own enquiries from families, not `PlatformEnquiry` (enquiries to Nexa). Actions are in `@/features/crm/actions`.

**Public form** at `/enquire/<slug>` (B builds the page; it's off until the owner switches it on):
- `getEnquiryForm({ slug })` returns `{ name, logoUrl, accentColor, branches }`, or null when the form is off.
- `submitWorkspaceEnquiryAction` takes:
  - `slug`, `name`, and an `email` or `phone` (one is required);
  - optional `studentName`, `gradeLevel`, `subjects`, `message` and `branchId`;
  - the same `startedAt` and hidden `website` honeypot as the landing form.
- It returns `{ ok: true }`. It's rate-limited, bots are dropped silently, and managers get an in-app note (plus email, by their settings).
- `setEnquiryFormAction({ on })` (`workspace.settings`) returns `{ on, path }`. Show the link to share.

**Staff** need `enquiries.manage`. A branch role sees enquiries for their branches plus those with no branch. An own-courses role sees those assigned to them.

| Action | Input | Notes |
| --- | --- | --- |
| `listEnquiriesAction` | `{ stage?, assigned?: "me" \| "none", branchId?, q?, dueOnly?, limit? }` | `{ items, counts: { NEW, CONTACTED, TRIAL, ENROLLED, LOST } }` for a board or list |
| `getEnquiryAction` | `{ id }` | The enquiry plus its `notes` (`NOTE`, `STAGE`, `EMAIL`, with author) |
| `createEnquiryAction` | `{ name, email?, phone?, studentName?, gradeLevel?, subjects?, message?, source?, branchId?, assignedMembershipId?, nextFollowUpAt? }` | Sources: MANUAL, PHONE, WALK_IN, SOCIAL, REFERRAL, IMPORT, OTHER. Assigned to the creator by default |
| `updateEnquiryAction` | `{ id, …same fields }` | A new follow-up date resets the reminder |
| `moveEnquiryAction` | `{ id, stage, lostReason?, learnerId? }` | LOST needs a reason. ENROLLED can link the learner. Logged as a STAGE note |
| `addEnquiryNoteAction` | `{ id, body }` | |
| `emailEnquirerAction` | `{ id, subject, body }` | Staff write every word. Reply-To is them. Logged as an EMAIL note. A NEW enquiry moves to CONTACTED |
| `enquiryFunnelAction` | `{ from, to }` | `{ total, byStage, bySource, conversionRate, medianDaysToEnrol, lostReasons }`, for the business dashboard |

- **Follow-ups:** when `nextFollowUpAt` passes, the assigned person gets one reminder, from housekeeping.
- **Retention:** enquiries untouched for 24 months are deleted.

### Tutor outcomes and reviews (Draft 1.25)

**Outcomes:** `listTutorOutcomesAction({ from, to, membershipIds? })` returns `[{ membershipId, name, outcomes }]`.
- **Who sees what:** managers with `staff.reviews` or `reports.view` see the tutors in their scope; anyone else sees only their own.
- **`outcomes`** comes from the courses the tutor teaches or owns:

  | Field | Meaning |
  | --- | --- |
  | `courses`, `activeStudents` | Counts |
  | `marks` | Number of marks in the period |
  | `averagePercent` | Average mark |
  | `averageChange` | Last mark minus first, per student, averaged |
  | `studentsImproving`, `studentsDeclining` | Change of ±5 points or more |
  | `completionRate` | Hand-ins against work due |
  | `attendanceRate` | Present or late, out of all non-excused |
  | `riskOpened`, `riskResolved` | At-risk alerts |
  | `hours` | From approved timesheets |
  | `bookingsCompleted`, `bookingsNoShow` | Booked lessons |

  Where there's no data, the value is null, not 0.

**Reviews** (`staff.reviews`, never your own):

| Action | Input | Notes |
| --- | --- | --- |
| `createReviewAction` | `{ membershipId, from, to }` | Saves the outcomes with the review (DRAFT) |
| `updateReviewAction` | `{ id, strengths?, improvements?, goals?, rating? (1–5), refreshOutcomes? }` | Not once acknowledged |
| `shareReviewAction` | `{ id }` | Needs some text. The tutor gets a note (`/dashboard/reviews/<id>`) |
| `acknowledgeReviewAction` | `{ id, response? }` | The tutor only, once it's shared |
| `listReviewsAction` | `{ membershipId? }` | A manager sees reviews for staff in scope (drafts too) and their own shared ones; a tutor sees their shared ones |

**Privacy:** shared reviews are in the tutor's data export.

### Branding and white-label (Draft 1.26)

#216 phase 3. **Owner, 24 Nov: custom domains are on hold.** Everything stays on www.nexa-lms.co.za. Actions are in `@/features/workspaces/brand-actions` and need `workspace.branding`.

- **Plus (`custom-branding`):** a logo, an accent colour, a sender name and welcome text.
  - Families' emails come from "<sender> via Nexa" (Nexa's address).
  - Those emails carry the workspace's name and logo in the header, and its colour.
- **Pro (white-label):** the same, plus:
  - emails come from "<sender>";
  - every "Nexa" and "Nexa LMS" in families' emails becomes the workspace's name; links stay;
  - the branded pages show the workspace's support email instead of Nexa's.
- **Not branded:** Nexa's own emails (billing, accounts, payouts, sign-in) keep Nexa's name.

| Action | Input | Notes |
| --- | --- | --- |
| `getBrandingAction` | `{}` | `{ name, slug, logoUrl, accentColor, senderName, welcomeText, hideNexaBranding, supportEmail, plan, canBrand, canWhiteLabel, signInPath }` |
| `setBrandingAction` | `{ logoUrl?, accentColor?, senderName?, welcomeText? }` | The logo must be uploaded through your Blob uploader. Colours look like `#1F6FEB`. Plus or Pro; otherwise "Your logo, colour and sender name are part of the Plus plan." |
| `setWhiteLabelAction` | `{ hideNexaBranding, supportEmail? }` | Pro. Switching it on needs a support email |
| `getBrandForSlug` | `{ slug }` (public) | For the branded sign-in page **`/w/<slug>`** (please build it): `{ slug, name, logoUrl, accentColor, welcomeText, whiteLabel, supportEmail }`, or null without branding |

**For B:**
- Use the brand in the dashboard shell for that workspace's members: the logo in the header, and the accent as the primary colour (`viewer.workspace.logoUrl` and `accentColor` are already on the viewer).
- When `whiteLabel` is true, hide "Nexa" in the shell and footer for families, and show `supportEmail`.
- Emails are handled by A.

### Bulk onboarding (Draft 1.26)

Bringing a whole organisation on, branch by branch. **The order:**
1. Import "Branches and teams" (`branches`).
2. Import "Tutors and admins" with the Teams column; people join their teams when they accept.
3. Courses (your screens; put each course in a team).
4. Import students.
5. Import the timetable (`calendar`).

| Action | Input | Notes |
| --- | --- | --- |
| `getOnboardingAction` | `{}` | `teams.manage`. Returns `{ name, plan, checklist: [{ key, label, done, optional }], branches: [{ id, name, rollout, rolloutAt, counts: { teams, staff, invited, courses, students, events }, progress: { steps, percent, waitingOnInvites } }], live }` |
| `setBranchRolloutAction` | `{ branchId, rollout: "PLANNED" \| "PILOT" \| "LIVE" }` | Owners and admins. LIVE needs staff and at least one course |
| `adminOnboardingOverviewAction` | `{ limit? }` | Nexa admins: each organisation's plan, branches (live and pilot) and checklist progress |

**For B:**
- An "Onboarding" page for organisation owners: the checklist with links to each import, and a row per branch with a progress bar, the rollout stage and "Start pilot" / "Go live".
- On the admin console, a table of organisations.
