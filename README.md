# Nexa LMS

Nexa is an invite-only LMS built for individual tutors and tutoring practices.
Tutors author courses, publish lessons with LaTeX (MathJax) + markdown, run
timed tests with 12 question types and sub-questions, grade per-answer with
feedback, and share a schedule with their students. Students take tests, submit
assignments, and see per-question grades in one place.

Built on **Next.js 15 (App Router, RSC)**, **Prisma + PostgreSQL**,
**NextAuth**, **Tailwind v4** with **shadcn/ui**, and **Vercel Blob** for
uploads.

---

## Contents

- [Feature overview](#feature-overview)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Running locally](#running-locally)
- [Project structure](#project-structure)
- [Feature-module pattern](#feature-module-pattern)
- [Authentication + roles](#authentication--roles)
- [Test authoring & JSON import/export](#test-authoring--json-importexport)
- [Blob storage](#blob-storage)
- [Rendering: markdown + MathJax](#rendering-markdown--mathjax)
- [Scripts](#scripts)
- [Deployment notes](#deployment-notes)
- [Troubleshooting](#troubleshooting)

---

## Feature overview

**Students**
- Personal dashboard: progress across courses, up-next deadlines, recent grades.
- Enrol-based course browser and per-course view (lessons, active tests,
  assignments, schedule, grades).
- Lesson reader with markdown + LaTeX, embedded video, downloadable resources,
  mark-complete tracking.
- Test runner with a countdown timer, per-question autosave (~3s debounced,
  flushed on nav), auto-submit on expiry, 12 question types including nested
  sub-questions, online/offline indicator.
- Assignment submissions with file uploads, attempt tracking, and re-submit.
- Canonical per-grade page showing score, tutor feedback, and — for tests —
  each question with the student's answer, per-question score, and per-question
  feedback.
- Calendar (month grid or list toggle) that unifies course events, test due
  dates, and assignment due dates. Click any item for a detail dialog.

**Tutors**
- Manage-courses hub: create/edit courses, manage enrolment, publish lessons.
- Test authoring: create/edit tests, drag/reorder questions, nested
  sub-questions, per-type answer editors (matching pairs, reorder items, blank
  count with per-blank answers, MC/MS with correct-answer chips), NONE-typed
  parent questions as context blocks, save as draft or publish.
- **JSON import/export** for tests: bulk-create via LLM (a copy-paste guide
  documents the exact schema), or export a test as JSON to share.
- Per-question grading: score + markdown feedback per question, auto-summed
  overall with manual override, sticky footer save bar.
- Calendar creator: publish course events (lectures, exams, live sessions,
  reminders) alongside the auto-populated test/assignment due dates.

**Cross-cutting**
- MathJax v3 rendering for lesson content, question prompts, and tutor
  feedback. Markdown via react-markdown + remark-gfm.
- Notifications feed with an unread badge in the header bell.
- Full role gating (STUDENT / TUTOR) at every server-side entry point.

---

## Tech stack

| Layer               | Choice                                                      |
| ------------------- | ----------------------------------------------------------- |
| Framework           | Next.js 15 App Router (React 19)                            |
| Language            | TypeScript                                                  |
| Styling             | Tailwind v4 (`@theme inline` in `globals.css`)              |
| UI primitives       | shadcn/ui on top of Radix                                   |
| Icons               | lucide-react                                                |
| Auth                | NextAuth (credentials provider) + Prisma adapter            |
| ORM / DB            | Prisma + PostgreSQL                                         |
| Server Actions      | `next-safe-action` (typed, Zod-validated)                   |
| Validation          | Zod                                                         |
| Forms               | react-hook-form + `@hookform/resolvers/zod`                 |
| Math rendering      | MathJax v3 via `better-react-mathjax`                       |
| Markdown            | `react-markdown` + `remark-gfm`                             |
| File uploads        | Vercel Blob (client uploads via signed tokens)              |
| Notifications       | Sonner (toasts) + a bespoke bell/notification feature       |
| Drag & drop (edit)  | `@dnd-kit/*`                                                |

---

## Prerequisites

- **Node.js 20+** (Next 15 requires Node 18.18+ but the deps are happier on 20).
- **PostgreSQL 14+** — either local, Docker, or a hosted DB (Neon, Supabase,
  Vercel Postgres, Railway, etc.).
- **npm** (or your package manager of choice). Scripts assume `npm`.
- **A Vercel Blob store** if you want file uploads (course covers, lesson
  attachments, submission files, test question images).

---

## Setup

```bash
# 1. Clone and install
git clone <your fork>
cd grit-lms
npm install     # runs `prisma generate` in postinstall

# 2. Create .env.local (see next section)
cp .env.example .env.local   # if you have one, otherwise create from scratch

# 3. Push the schema to your database
npx prisma migrate dev --name init
# (or `npx prisma db push` if you're not versioning migrations yet)

# 4. Seed at least one tutor account so you can log in
# There's a seed route at src/app/api/seed-users/route.ts that provisions
# demo tutor + student accounts. Hit it once from the browser after `npm run dev`.
```

---

## Environment variables

Create `.env.local` in the repo root with:

```dotenv
# Postgres — full connection URL used by Prisma
DATABASE_URL="postgresql://user:password@host:5432/nexa_lms"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"

# Vercel Blob (used by client uploads via /api/blob/upload-token)
# Get this from the Vercel dashboard → Storage → your Blob store → .env.local
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

If you skip `BLOB_READ_WRITE_TOKEN`, the UI still renders but any file upload
(course cover, lesson attachment, submission file) will fail with a helpful
error toast at upload time.

---

## Running locally

```bash
npm run dev      # dev server on http://localhost:3000
npm run build    # runs prisma generate + next build
npm run start    # serves the production build
npm run lint     # next lint
```

TypeScript checks piggyback on `next build`, but for a faster loop:

```bash
npx tsc --noEmit
```

Once the dev server is up:

1. Visit `http://localhost:3000` — you'll land on the marketing landing page.
2. Click **Sign in** to reach `/auth`.
3. Sign in with a seeded tutor account; a tutor lands on the tutor dashboard.
4. Sign in as a student to see the student experience.

---

## Project structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Public landing (RSC, marketing)
│   ├── layout.tsx                # Root layout
│   ├── auth/                     # Sign-in page (client component)
│   ├── api/                      # Route handlers (auth, blob tokens, seed, etc.)
│   ├── components/               # App-scoped shared components (markdown, math)
│   └── dashboard/                # Authenticated app
│       ├── page.tsx              # /dashboard (student home / tutor tiles, RSC)
│       ├── layout.tsx            # Shell: header, nav, providers
│       ├── models/               # Header, nav, footer components
│       ├── courses/              # Student course browser + detail + lessons
│       ├── manage-courses/       # Tutor course editor + lesson editor
│       ├── tests/                # Student test taking (list, pre-test, runner, review)
│       ├── tutor-tests/          # Tutor test list, new, edit, submissions, grading
│       ├── submissions/          # Assignments (role-branched RSC)
│       ├── grades/               # Gradebook + canonical grade detail
│       ├── calendar/             # Schedule (month grid + list toggle)
│       └── notifications/        # Notifications feed
├── features/                     # Feature modules (see below)
│   ├── shared/                   # Zod enums + primitives shared across features
│   ├── courses/
│   ├── lessons/
│   ├── assessments/              # Tests, TestQuestion tree, TestSubmission
│   ├── submissions/              # Assignments + SubmissionEntries
│   ├── grades/                   # Grade + QuestionGrade queries
│   ├── events/                   # CourseEvent (schedule)
│   ├── notifications/
│   ├── students/
│   └── tutors/
├── lib/                          # auth, db, blob (paths + server + client), safe-action, utils
├── generated/prisma/             # Prisma client (regenerated by `prisma generate`)
├── context/                      # Legacy client contexts (being phased out)
└── components/ui/                # shadcn primitives
prisma/
└── schema.prisma                 # Data model — source of truth
```

---

## Feature-module pattern

Every non-trivial domain lives under `src/features/<name>/` with the same
shape:

| File                                | Purpose                                                     |
| ----------------------------------- | ----------------------------------------------------------- |
| `schemas.ts`                        | Zod schemas for row shape + inputs (create / update / etc.) |
| `queries.ts`                        | Server-only read helpers, each wrapped in React `cache()`   |
| `actions.ts`                        | `"use server"` Server Actions via `tutorActionClient` /
`studentActionClient`                                                              |
| `components/`                       | UI components specific to this feature                      |
| `lib/`                              | Pure helpers (e.g. test JSON serialisation)                 |

Server Actions gate on role and ownership before mutating, then
`revalidatePath()` the relevant routes so RSC pages re-fetch.

---

## Authentication + roles

- NextAuth credentials provider — email + password verified against a `bcrypt`
  hash on the `User` row.
- Two roles: **STUDENT** and **TUTOR** (a `Role` enum in Prisma).
- Every dashboard route checks `auth()` server-side and calls `redirect("/")`
  if unauthenticated, or `redirect("/dashboard")` if the role doesn't match.
- Ownership checks live in `features/*/queries.ts` (`testBelongsToTutor`,
  `courseBelongsToTutor`, `studentCanAccessTest`, etc.) and are consumed by
  both pages and actions so a request never mutates rows the caller doesn't
  own.

Sign-up is deliberately not self-serve. The landing page's "Request access"
button opens the user's email client with a pre-filled message asking the
admin to create an account.

---

## Test authoring & JSON import/export

### Authoring

`/dashboard/tutor-tests/new` (create) and `/dashboard/tutor-tests/[id]/edit`
render a full editor:

- Metadata: title, description, course, due date + time, time limit,
  pre-test instructions.
- Recursive question editor with per-type field renderers for all 12 types:
  `MULTIPLE_CHOICE`, `MULTI_SELECT`, `TRUE_FALSE`, `SHORT_ANSWER`, `NUMERIC`,
  `ESSAY`, `CODE`, `FILE_UPLOAD`, `MATCHING`, `REORDER`,
  `FILL_IN_THE_BLANK`, and `NONE` (context-only parent).
- Sub-questions nest arbitrarily. `NONE` parents skip the input for the
  parent and only render children.
- Save as draft (isActive = false) or Publish (isActive = true, sends a
  `TEST_CREATED` / `TEST_UPDATED` notification to enrolled students).

### JSON import/export

- **Export**: card menu → "Export JSON" downloads the test as a
  `TestImportSchema`-shaped JSON file, sanitized filename.
- **Import**: `/dashboard/tutor-tests` → "Import JSON" dialog. Upload a `.json`
  file or paste the payload. A **"Copy LLM prompt"** button copies the full
  schema spec (with a worked example) to the clipboard so tutors can hand it
  to ChatGPT / Claude / etc. to generate an importable test.

The schema, serializer, parser, and LLM prompt all live in
`src/features/assessments/lib/test-io.ts`. If you change the accepted shape,
update the guide in that file so imports stay round-trippable.

Round-trip: export → save → re-import produces an identical test.

---

## Blob storage

Client uploads go directly to Vercel Blob via signed tokens issued by
`/api/blob/upload-token`. This sidesteps the 4.5 MB Vercel function body
limit.

Path schemes and content-type rules live in `src/lib/blob/paths.ts`:

| Kind                | Path                                                       |
| ------------------- | ---------------------------------------------------------- |
| `CourseCover`       | `courses/{courseId}/cover/{file}`                          |
| `LessonAttachment`  | `courses/{courseId}/lessons/{lessonId}/attachments/{file}` |
| `LessonUpload`      | `courses/{courseId}/lessons/{lessonId}/uploaded/{file}`    |
| `Submission`        | `submissions/{submissionId}/{file}`                        |
| `TestQuestionImage` | `tests/{testId}/questions/{questionId}/{file}`             |
| `UserAvatar`        | `users/{userId}/avatar/{file}`                             |

Content-type restrictions per kind live in the same file. Use `undefined` in
`ALLOWED_CONTENT_TYPES` to accept any type — the token issuer omits the
constraint entirely when the kind is unrestricted.

---

## Rendering: markdown + MathJax

- Markdown via `react-markdown` + `remark-gfm` (tables, task lists,
  strikethrough, autolinks).
- LaTeX via **MathJax v3** (`better-react-mathjax`). Delimiters supported:
  - Inline: `$…$` or `\(…\)`
  - Display: `$$…$$` or `\[…\]`
- MathJax is mounted once at `src/app/dashboard/layout.tsx` via
  `<MathProvider>`. Skips `code`, `pre`, `script`, `style`, `textarea` so
  literal `$` in code blocks isn't typeset.
- Lesson content, question prompts, student answers, tutor feedback, and
  grade comments all render through `src/app/components/markdown.tsx`.

---

## Scripts

```bash
npm run dev      # next dev
npm run build    # prisma generate + next build
npm run start    # next start (serves the build)
npm run lint     # next lint (eslint)
```

Prisma workflow:

```bash
npx prisma generate              # regenerate the client after schema edits
npx prisma migrate dev --name x  # create + apply a migration in dev
npx prisma migrate deploy        # apply pending migrations in CI/prod
npx prisma studio                # inspect the DB in a browser UI
```

---

## Deployment notes

The app targets Vercel out of the box:

- `postinstall: prisma generate` ensures the client is generated on build.
- Set `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, and
  `BLOB_READ_WRITE_TOKEN` in the Vercel project's env settings.
- Run `npx prisma migrate deploy` as part of your release workflow (a GitHub
  Action or Vercel build step) so schema changes reach production.
- MathJax loads its script client-side from the CDN at runtime — no build-time
  configuration needed.

For other hosts (Fly, Railway, etc.): the app is a standard Next 15 App
Router build. Any Node 20 host with Postgres connectivity works.

---

## Troubleshooting

**"You cannot use different slug names for the same dynamic path"**
Next.js detected two dynamic segments with different names at the same tree
level. Check for leftover legacy folders (`[id]` alongside `[testId]`, etc.)
and remove one.

**"Content type mismatch" on upload**
`ALLOWED_CONTENT_TYPES` in `src/lib/blob/paths.ts` doesn't accept `"*/*"`.
Use `undefined` for an unrestricted kind, or list explicit MIME types
(`image/*` wildcards work; `*/*` does not).

**Metadata error: `"You cannot export 'metadata' from a component marked
with 'use client'"`**
Remove the `"use client"` directive from the page — App Router treats files
with no directive as Server Components, which is what `metadata` requires.

**Autosave feels laggy on the test runner**
The runner debounces draft saves at 3s while the student is on the same
question, but flushes immediately when they navigate (prev / next / sidebar
jump). If a student clicks Submit before typing anywhere, the last-typed
answer is still captured because Submit reads from the same in-memory ref.

**Prisma client doesn't know a new enum value**
Run `npx prisma generate` after any `schema.prisma` edit. If the enum
addition also changes the database column, follow up with
`npx prisma migrate dev --name your_change`.

---

## License

MIT (or the licence you eventually pick — update this line accordingly).
