# Nexa revamp: rules for the two agents

Two main agents work on the revamp at the same time. Each one runs its own
sessions and subagents. These rules keep them off each other's branches and
files. Both agents read this file at the start of every session.

| Agent | Name | Owns |
| --- | --- | --- |
| A | Platform and business | Data, accounts, tenancy, money, email, infrastructure, admin |
| B | Product and learning | Every screen, the design system, content, assessments, automarker |

The plan of record is the "Nexa LMS: Platform revamp plan" doc (revision 2,
16 November 2026). Where this file and the doc disagree on ownership, this
file wins. Where they disagree on product decisions, the doc wins.

## 1. Branches and worktrees

- Never commit to `main` directly. Every change lands through a pull request.
- Every session works in its own git worktree, on its own branch, cut from
  the latest `origin/main`.
- Branch names:
  - Agent A: `revamp/a-<topic>`, for example `revamp/a-research`,
    `revamp/a-tenancy-schema`, `revamp/a-paystack-provider`.
  - Agent B: `revamp/b-<topic>`, for example `revamp/b-research`,
    `revamp/b-design-tokens`, `revamp/b-test-designer`.
  - A subagent working for a session gets its own branch,
    `revamp/a-<topic>-<part>`, and opens its pull request into the session's
    branch or into `main`, as the main agent decides.
- Rebase on `origin/main` before opening a pull request and again before
  merging. Never force-push a branch someone else is working on.
- Never use bare `git stash`. The stash is shared across worktrees.
- Keep pull requests small: one concern, ideally under 600 changed lines,
  generated files excluded.

## 2. Who owns which files

An agent edits only the paths it owns. To change a path the other agent owns,
open a GitHub issue labelled `needs-a` or `needs-b`, or write the request in
your HANDOFF.md under "Blocked on the other agent".

| Area | Agent A owns | Agent B owns |
| --- | --- | --- |
| Planning docs | `docs/revamp/a/**` | `docs/revamp/b/**` |
| Contracts | `docs/revamp/contracts/services.md`, `contracts/viewer.md`, `contracts/billing.md` | `docs/revamp/contracts/navigation.md`, `contracts/editor.md` |
| Prisma schema (after the split in Phase 0) | `prisma/schema/core.prisma`, `tenancy.prisma`, `billing.prisma`, `messaging.prisma` | `prisma/schema/learning.prisma`, `assessments.prisma`, `coding.prisma`, `calendar.prisma` |
| Feature folders | `src/features/{auth,users,tutors,students,parents,workspaces,billing,payments,admin,notifications,messaging,email}` | `src/features/{courses,lessons,assessments,submissions→assignments,coding,events→calendar,grades,search,activity}` |
| App routes | `src/app/api/**`, `src/app/auth/**`, `src/app/admin/**`, `src/app/verify-email/**`, `src/app/forgot-password/**` | `src/app/dashboard/**`, `src/app/page.tsx` (landing), every other page and layout |
| UI kit | Uses B's components; never edits them | `src/components/**`, tokens, fonts, illustrations |
| Shared libraries | `src/lib/{auth,db,safe-action,api-guard,email,blob}*`, `src/lib/viewer.ts` | `src/lib/{ui,utils,tex-delimiters,enum-labels,datetime}*` |
| Infrastructure | Vercel, the database, env vars, crons, queues, Judge0 VM, domain, DNS, Blob store | Asks A for anything here |
| Legacy contexts (`src/context/**`) | Supplies the server actions and queries that replace them | Moves the pages off them: calendar, assignments, test session, dashboard shell, header and nav |
| Legacy routes (`src/app/api/**`) | Deletes them after B's pages no longer call them and the owner has tested | Tells A when a page stops calling a route |
| Root config (`package.json`, `next.config.*`, `tsconfig.json`, `.gitignore`) | Owns it | Asks A in a pull request comment; small dependency additions may go in B's PR if A approves |

`src/features/shared/**` and anything not listed: ask in HANDOFF.md before
editing. A's features may need pages under `src/app/dashboard/**` (billing,
admin, organisation settings): B builds those pages against A's server
actions and contracts.

## 3. Contracts between the agents

The agents meet only at written contracts in `docs/revamp/contracts/`. The
owner of a contract writes it first. The other agent reads it and asks for
changes; it never edits the contract.

| Contract | Owner | What it fixes |
| --- | --- | --- |
| `viewer.md` then `src/lib/viewer.ts` | A | `getViewer()`: user, active workspace, role, team, children, mode (simple or technical), enabled services |
| `services.md` | A | Service keys (`automarker`, `graphing`, `math-input`, ...), their tier, and `hasService(viewer, courseId, key)` |
| `billing.md` | A | Server actions B's billing and payments screens call, and their return shapes |
| `navigation.md` | B | Parent header and child ribbon slots, so A's pages (admin, billing) plug in |
| `editor.md` | B | The rich-text and math editor component and its stored format, so A's email templates and messages can render it |

## 4. Things only the owner may approve

Stop and ask the owner (Jassiel) before any of these. Write the question in
HANDOFF.md and in the session's chat. Do not work around a no.

- `prisma db push`, `prisma migrate deploy`, or any write to a shared
  database. Today's database is shared with production.
- Creating or changing paid cloud resources: Vercel plan, a database, VMs,
  domains, mailboxes, Paystack accounts, Bedrock or Wolfram API keys.
- Deleting anything in the Vercel Blob store or any database row. List
  first, then ask with the list.
- Merging to `main`, pushing a tag, or deploying to production.
- Sending email to anyone other than the owner. The Resend dev sender only
  reaches the owner's inbox.
- Spending money or accepting terms of service.
- Deleting a legacy context or route. Replace first; delete only after the
  owner has tested the replacement.

Never put secrets, tokens or personal data in the repo, in pull request text
or in chat.

## 5. Every pull request

- Title: `<type>(<area>): <what>`, for example `feat(billing): usage records`.
- Body: what changed, why, how it was checked, env vars and migrations it
  needs, and which flag hides it (`REVAMP_UI`, `BILLING`, `CODING`,
  `AI_MARKING`).
- Includes a check: a script under `scripts/check-*.ts`, a test, or a
  screenshot for UI.
- `npx tsc --noEmit` and `npm run lint` pass.

## 6. HANDOFF.md

Each agent keeps one file, `docs/revamp/a/HANDOFF.md` or
`docs/revamp/b/HANDOFF.md`. Update it at the end of every session, in the
same pull request as the work:

```
## <date> <session name>
Done:
Next:
Blocked on the other agent:
Questions for the owner:
```

Read the other agent's HANDOFF.md at the start of every session.

## 7. Session order before building

Each main agent runs four planning sessions. Output goes in its docs folder.

1. **Research** (first). Sources, prices, comparisons, with links and the
   date each fact was checked.
2. **System design** and **UI/UX design** (in parallel, once the research
   has a first draft).
3. **Write-up with diagrams** (last). One readable document per agent, with
   the diagrams in Mermaid so GitHub renders them.

After the owner approves both write-ups, building starts with Phase 0 in the
plan doc.
