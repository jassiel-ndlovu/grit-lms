/**
 * Test accounts and data on PREVIEW for end-to-end testing (issue #148).
 *
 *   npx tsx scripts/seed-preview.ts            # wipe the previous seed, then seed
 *   npx tsx scripts/seed-preview.ts --wipe     # only wipe
 *
 * Re-runnable. It owns only its own rows: users `seed.*@example.test`,
 * workspaces with slug `seed-*`, discount codes `SEED*`. Everything else in
 * Preview is left alone. Same target guard as scripts/seed-fake.ts: never
 * production.
 *
 * One password for every seeded account, from SEED_USER_PASSWORD or the
 * git-ignored `.env.test-accounts` (created on the first run with a random
 * password). The account list is written there too. Never commit it.
 *
 * What it makes (names are made up; @example.test receives no mail):
 *   Organisations
 *     seed-ubuntu   ACTIVE, paid; payouts to the owner's Paystack test
 *                   subaccount "Main Branch"; owner, admin, two tutors
 *     seed-khanya   TRIAL (9 days left), no payouts
 *     seed-sizwe    PAST_DUE: renewal unpaid for 5 days
 *     seed-thuto    READ_ONLY: trial ended unpaid
 *     seed-lerato   CANCELLED at period end
 *   Solo practices
 *     seed-thandi   TRIAL, no payouts
 *     seed-sipho    ACTIVE; payouts to the test subaccount "Secondary Branch"
 *   Learners: an adult who pays their own fees, minors whose parent pays,
 *     a student with no fees, a student in two workspaces.
 *   Parents: one child; siblings; children in two workspaces.
 *   Fees: paid, open and overdue invoices; a refunded invoice with an active
 *     recovery; fee discount codes (live, ended).
 *   Platform: paid and open invoices; Nexa codes live, ended, used up, off.
 *   Learning: each active course has lessons, a test with submissions, an
 *     assignment with entries and a weekly class.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { PrismaClient, type Prisma } from "../src/generated/prisma";
import { SERVICES } from "../src/features/billing/catalogue";
import { encryptSecret } from "../src/features/payments/secrets";
import { checkTarget } from "./seed-fake";

const DOMAIN = "@example.test";
const ENV_FILE = ".env.test-accounts";
/** The owner's Paystack TEST subaccounts (codes are not secrets). */
const SUBACCOUNTS = { main: "ACCT_epu53gjf4cw2rkv", secondary: "ACCT_gnicfdmpg7qr5dc" };
const DAY = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(Date.now() + days * DAY);

const prisma = new PrismaClient();

/* ------------------------------------------------------------------------- */
/* Wipe: only the seed's own rows, children first.                            */
/* ------------------------------------------------------------------------- */

async function wipe() {
  const users = (await prisma.user.findMany({ where: { email: { startsWith: "seed.", endsWith: DOMAIN } }, select: { id: true } })).map((u) => u.id);
  const ws = (await prisma.workspace.findMany({ where: { slug: { startsWith: "seed-" } }, select: { id: true } })).map((w) => w.id);
  const courses = (await prisma.course.findMany({ where: { workspaceId: { in: ws } }, select: { id: true } })).map((c) => c.id);
  const students = (await prisma.student.findMany({ where: { userId: { in: users } }, select: { id: true } })).map((s) => s.id);
  const payments = (await prisma.payment.findMany({ where: { OR: [{ workspaceId: { in: ws } }, { payerUserId: { in: users } }] }, select: { id: true } })).map((p) => p.id);
  const codes = (await prisma.discountCode.findMany({ where: { OR: [{ code: { startsWith: "SEED" } }, { issuerWorkspaceId: { in: ws } }] }, select: { id: true } })).map((c) => c.id);

  // Learning content.
  await prisma.questionGrade.deleteMany({ where: { OR: [{ testSubmission: { test: { courseId: { in: courses } } } }, { submissionEntry: { submission: { courseId: { in: courses } } } }] } });
  await prisma.grade.deleteMany({ where: { OR: [{ courseId: { in: courses } }, { studentId: { in: students } }] } });
  await prisma.testSubmission.deleteMany({ where: { test: { courseId: { in: courses } } } });
  await prisma.testQuestion.deleteMany({ where: { test: { courseId: { in: courses } } } });
  await prisma.test.deleteMany({ where: { courseId: { in: courses } } });
  await prisma.submissionEntry.deleteMany({ where: { submission: { courseId: { in: courses } } } });
  await prisma.submission.deleteMany({ where: { courseId: { in: courses } } });
  await prisma.lessonCompletion.deleteMany({ where: { lesson: { courseId: { in: courses } } } });
  await prisma.lesson.updateMany({ where: { courseId: { in: courses } }, data: { parentId: null } });
  await prisma.lesson.deleteMany({ where: { courseId: { in: courses } } });
  await prisma.courseEvent.deleteMany({ where: { courseId: { in: courses } } });
  await prisma.notification.deleteMany({ where: { OR: [{ userId: { in: users } }, { courseId: { in: courses } }] } });
  // Money (Restrict relations), then billing.
  await prisma.outboundEmail.deleteMany({ where: { OR: [{ workspaceId: { in: ws } }, { userId: { in: users } }] } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ workspaceId: { in: ws } }, { actorUserId: { in: users } }] } });
  await prisma.payoutRecoveryDeduction.deleteMany({ where: { paymentId: { in: payments } } });
  await prisma.payoutRecovery.deleteMany({ where: { workspaceId: { in: ws } } });
  await prisma.refund.deleteMany({ where: { paymentId: { in: payments } } });
  await prisma.paymentAllocation.deleteMany({ where: { paymentId: { in: payments } } });
  await prisma.invoice.updateMany({ where: { workspaceId: { in: ws } }, data: { lockedByPaymentId: null } });
  await prisma.payment.deleteMany({ where: { id: { in: payments } } });
  await prisma.offsitePayment.deleteMany({ where: { workspaceId: { in: ws } } });
  await prisma.invoiceLine.deleteMany({ where: { invoice: { workspaceId: { in: ws } } } });
  await prisma.invoice.deleteMany({ where: { workspaceId: { in: ws } } });
  await prisma.feeSchedule.deleteMany({ where: { workspaceId: { in: ws } } });
  await prisma.payoutAccount.deleteMany({ where: { workspaceId: { in: ws } } });
  await prisma.redemption.deleteMany({ where: { OR: [{ discountCodeId: { in: codes } }, { workspaceId: { in: ws } }] } });
  await prisma.creditNote.deleteMany({ where: { workspaceId: { in: ws } } });
  await prisma.seatCharge.deleteMany({ where: { workspaceId: { in: ws } } });
  await prisma.billingPeriod.deleteMany({ where: { workspaceId: { in: ws } } });
  await prisma.platformInvoiceLine.deleteMany({ where: { invoice: { workspaceId: { in: ws } } } });
  await prisma.platformInvoice.deleteMany({ where: { workspaceId: { in: ws } } });
  await prisma.discountCode.deleteMany({ where: { id: { in: codes } } });
  await prisma.subscription.deleteMany({ where: { workspaceId: { in: ws } } });
  // Tenancy, then people.
  await prisma.courseService.deleteMany({ where: { courseId: { in: courses } } });
  await prisma.enrollment.deleteMany({ where: { workspaceId: { in: ws } } });
  await prisma.courseStaff.deleteMany({ where: { courseId: { in: courses } } });
  await prisma.course.deleteMany({ where: { id: { in: courses } } });
  await prisma.guardianship.deleteMany({ where: { OR: [{ guardianUserId: { in: users } }, { studentUserId: { in: users } }] } });
  await prisma.learner.deleteMany({ where: { OR: [{ workspaceId: { in: ws } }, { userId: { in: users } }] } });
  await prisma.membership.deleteMany({ where: { OR: [{ workspaceId: { in: ws } }, { userId: { in: users } }] } });
  await prisma.workspace.deleteMany({ where: { id: { in: ws } } });
  await prisma.student.deleteMany({ where: { id: { in: students } } });
  await prisma.tutor.deleteMany({ where: { userId: { in: users } } });
  await prisma.activityLog.deleteMany({ where: { userId: { in: users } } });
  await prisma.userPreferences.deleteMany({ where: { userId: { in: users } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  console.log(`wiped: ${users.length} users, ${ws.length} workspaces, ${courses.length} courses, ${payments.length} payments, ${codes.length} codes`);
}

/* ------------------------------------------------------------------------- */
/* Seed                                                                        */
/* ------------------------------------------------------------------------- */

type Ctx = { hash: string; accounts: Array<[string, string]> };

async function person(ctx: Ctx, key: string, name: string, role: "TUTOR" | "STUDENT" | "PARENT", note: string) {
  const email = `seed.${key}${DOMAIN}`;
  const u = await prisma.user.create({ data: { name, email, password: ctx.hash, role, emailVerified: new Date(), emailConfirmed: true } });
  await prisma.account.create({ data: { providerId: "credential", accountId: u.id, userId: u.id, password: ctx.hash } });
  ctx.accounts.push([email, note]);
  return u;
}

type WsSpec = {
  slug: string; name: string; kind: "SOLO" | "ORGANISATION";
  state: "TRIAL" | "ACTIVE" | "PAST_DUE" | "READ_ONLY" | "CANCELLED";
  subaccount?: string;
};

async function workspace(spec: WsSpec, ownerEmail: string) {
  const trialEndsAt = spec.state === "TRIAL" ? at(9) : at(-40);
  const ws = await prisma.workspace.create({ data: { slug: spec.slug, name: spec.name, kind: spec.kind, billingState: spec.state, trialEndsAt } });
  const paid = spec.state === "ACTIVE" || spec.state === "PAST_DUE" || spec.state === "CANCELLED";
  const periodStart = spec.state === "PAST_DUE" ? at(-35) : at(-12);
  const periodEnd = new Date(periodStart.getTime() + 30 * DAY);
  await prisma.subscription.create({
    data: {
      workspaceId: ws.id, billingEmail: ownerEmail,
      ...(paid ? {
        status: "AUTHORISED",
        // A saved card needs a (sealed) Paystack authorisation to count as one
        // (#223): restart and renewals read authorizationCodeEnc, not the
        // card details. Without PAYMENT_ENC_KEY the seed shows no card at all.
        ...(process.env.PAYMENT_ENC_KEY
          ? { authorizationCodeEnc: encryptSecret("AUTH_seed_preview_fake"), cardBrand: "visa", cardLast4: "4081", cardExpMonth: 12, cardExpYear: 2030 }
          : {}),
        currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, renewsAt: periodEnd, lastPaidAt: periodStart,
        deleteAfter: new Date(periodStart.getTime() + 61 * DAY),
        cancelAtPeriodEnd: spec.state === "CANCELLED", cancelledAt: spec.state === "CANCELLED" ? at(-3) : null,
      } : {}),
      ...(spec.state === "READ_ONLY" ? { readOnlySince: at(-26), deleteAfter: at(35) } : {}),
    },
  });
  if (spec.state === "TRIAL") {
    await prisma.usageCap.createMany({ data: [
      { workspaceId: ws.id, meter: "ACTIVE_STUDENTS", limitQuantity: 20, source: "TRIAL" },
      { workspaceId: ws.id, meter: "AI_MARKS", limitQuantity: 100, source: "TRIAL" },
    ] });
  }
  if (paid) {
    const inv = await prisma.platformInvoice.create({
      data: {
        number: `SEED-NX-${spec.slug}-1`, workspaceId: ws.id, opensPeriodStart: periodStart, status: "PAID",
        subtotalCents: 53700, totalCents: 53700, issuedAt: periodStart, dueAt: periodStart, paidAt: periodStart, paidVia: "CARD",
        lines: { create: [{ kind: "ADVANCE", courseTitle: "All courses", tierKey: "PRO", description: "3 students on Pro", quantity: 3, unitPriceCents: 17900, amountCents: 53700 }] },
      },
    });
    await prisma.billingPeriod.create({ data: { workspaceId: ws.id, start: periodStart, end: periodEnd, status: spec.state === "PAST_DUE" ? "CLOSED" : "OPEN", openedByInvoiceId: inv.id } });
  }
  if (spec.state === "PAST_DUE") {
    await prisma.platformInvoice.create({
      data: {
        number: `SEED-NX-${spec.slug}-2`, workspaceId: ws.id, opensPeriodStart: at(-5), status: "PAST_DUE",
        subtotalCents: 53700, totalCents: 53700, issuedAt: at(-5), dueAt: at(-5), attemptCount: 2, nextAttemptAt: at(2), dunningStage: "DAY3",
        lines: { create: [{ kind: "ADVANCE", courseTitle: "All courses", tierKey: "PRO", description: "3 students on Pro", quantity: 3, unitPriceCents: 17900, amountCents: 53700 }] },
      },
    });
  }
  let payout: { id: string } | null = null;
  if (spec.subaccount) {
    const taken = await prisma.payoutAccount.findUnique({ where: { subaccountCode: spec.subaccount }, select: { id: true } });
    const code = taken ? `ACCT_seed_${spec.slug}` : spec.subaccount;
    if (taken) console.log(`  ${spec.slug}: test subaccount already used outside the seed; using a placeholder (checkout won't reach Paystack)`);
    await prisma.paymentSettings.create({ data: { workspaceId: ws.id, payoutMode: "WORKSPACE" } });
    payout = await prisma.payoutAccount.create({
      data: { workspaceId: ws.id, subaccountCode: code, businessName: spec.name, bankCode: "198765", bankName: "Test bank", accountNumberLast4: "0000", accountName: spec.name, status: "ACTIVE", verifiedAt: at(-20), createdByUserId: "seed" },
      select: { id: true },
    });
  }
  return { ws, payout };
}

async function course(wsId: string, ownerMembershipId: string, name: string, learners: Array<{ learnerId: string; studentId: string }>, full: boolean) {
  const c = await prisma.course.create({
    data: {
      name, description: "Seeded course for end-to-end testing.", imageUrl: "", workspaceId: wsId, ownerMembershipId,
      staff: { create: { membershipId: ownerMembershipId, role: "LEAD" } },
      enrollments: { create: learners.map((l) => ({ workspaceId: wsId, learnerId: l.learnerId, status: "ACTIVE" as const, startedAt: at(-30) })) },
    },
  });
  const premium = Object.values(SERVICES).filter((s) => s.kind === "premium" && s.status === "v1").map((s) => s.key);
  const known = await prisma.service.findMany({ where: { key: { in: premium } }, select: { key: true } });
  await prisma.courseService.createMany({ data: known.map((k) => ({ workspaceId: wsId, courseId: c.id, serviceKey: k.key, enabled: true, changedByUserId: "seed" })) });
  if (!full) return c;

  const unit = await prisma.lesson.create({ data: { title: "Unit 1", order: 0, courseId: c.id, type: "NONE" } });
  const lessons = [];
  for (let i = 1; i <= 3; i++) {
    lessons.push(await prisma.lesson.create({ data: { title: `Lesson ${i}`, description: `Seeded lesson ${i}. Inline maths: \\(x^2 + ${i}x = 0\\).`, order: i - 1, courseId: c.id, parentId: unit.id, duration: 30 } }));
  }
  const test = await prisma.test.create({
    data: {
      title: "Quiz 1", description: "Seeded test.", courseId: c.id, dueDate: at(7), timeLimit: 30, totalPoints: 6, releaseAutoMarksToStudent: true,
      questions: { create: [
        { order: 0, question: "What is 2 + 2?", type: "MULTIPLE_CHOICE", points: 2, options: ["3", "4", "5"], answer: "4", reorderItems: [] },
        { order: 1, question: "The sky is green.", type: "TRUE_FALSE", points: 2, options: [], answer: "false", reorderItems: [] },
        { order: 2, question: "Solve \\(2x = 10\\).", type: "NUMERIC", points: 2, options: [], answer: "5", reorderItems: [] },
      ] },
    },
    include: { questions: { orderBy: { order: "asc" } } },
  });
  const [q1, q2, q3] = test.questions;
  for (const [i, l] of learners.entries()) {
    if (i < 3) await prisma.lessonCompletion.create({ data: { studentId: l.studentId, lessonId: lessons[0].id, completedAt: at(-1) } });
    if (i > 2) continue;
    const graded = i < 2;
    const score = 6 - 2 * i;
    const sub = await prisma.testSubmission.create({
      data: { testId: test.id, studentId: l.studentId, startedAt: at(-2), submittedAt: graded ? at(-1.98) : null, answers: { [q1.id]: i > 0 ? "3" : "4", [q2.id]: "false", [q3.id]: "5" }, score: graded ? score : null, status: graded ? "GRADED" : "IN_PROGRESS" },
    });
    if (graded) await prisma.grade.create({ data: { studentId: l.studentId, courseId: c.id, type: "TEST", title: test.title, outOf: 6, score, testSubmissionId: sub.id } });
  }
  const assignment = await prisma.submission.create({
    data: { title: "Assignment 1", courseId: c.id, dueDate: at(3), createdAt: at(-5), fileType: "pdf", description: "Seeded assignment.", descriptionFiles: [], totalPoints: 10 },
  });
  for (const l of learners.slice(0, 2)) {
    await prisma.submissionEntry.create({ data: { studentId: l.studentId, submissionId: assignment.id, submittedAt: at(-1), attemptNumber: 1, status: "SUBMITTED", feedback: "", fileUrl: [] } });
  }
  await prisma.courseEvent.create({ data: { title: "Weekly class", description: "Seeded weekly class.", type: "LECTURE", date: at(2), duration: 60, courseId: c.id, link: "https://meet.example.test/seed" } as Prisma.CourseEventUncheckedCreateInput });
  return c;
}

async function feeInvoice(input: { wsId: string; payoutId: string; learnerId: string; studentUserId: string; number: string; cents: number; status: "OPEN" | "PAID"; dueDays: number; courseId: string }) {
  return prisma.invoice.create({
    data: {
      number: input.number, workspaceId: input.wsId, payoutAccountId: input.payoutId, learnerId: input.learnerId, studentUserId: input.studentUserId,
      status: input.status, issuedAt: at(input.dueDays - 7), dueAt: at(input.dueDays), subtotalCents: input.cents, totalCents: input.cents,
      ...(input.status === "PAID" ? { paidAt: at(input.dueDays - 2), paidVia: "ONLINE" as const } : {}),
      lines: { create: [{ courseId: input.courseId, description: "Tuition, monthly", quantity: 1, unitAmountCents: input.cents, amountCents: input.cents }] },
    },
  });
}

async function seed(password: string) {
  const ctx: Ctx = { hash: await bcrypt.hash(password, 10), accounts: [] };

  // People.
  const P = {
    ubuntuOwner: await person(ctx, "ubuntu.owner", "Nomvula Dube", "TUTOR", "seed-ubuntu OWNER (org, active, payouts on)"),
    ubuntuAdmin: await person(ctx, "ubuntu.admin", "Kagiso Mokoena", "TUTOR", "seed-ubuntu ADMIN"),
    ubuntuTutor1: await person(ctx, "ubuntu.tutor1", "Ayanda Zulu", "TUTOR", "seed-ubuntu TUTOR (own courses only)"),
    ubuntuTutor2: await person(ctx, "ubuntu.tutor2", "Bongani Nkosi", "TUTOR", "seed-ubuntu TUTOR (own courses only)"),
    khanyaOwner: await person(ctx, "khanya.owner", "Lindiwe Khumalo", "TUTOR", "seed-khanya OWNER (org, trial)"),
    sizweOwner: await person(ctx, "sizwe.owner", "Sizwe Mahlangu", "TUTOR", "seed-sizwe OWNER (org, past due)"),
    thutoOwner: await person(ctx, "thuto.owner", "Palesa Molefe", "TUTOR", "seed-thuto OWNER (org, read-only)"),
    leratoOwner: await person(ctx, "lerato.owner", "Lerato Sithole", "TUTOR", "seed-lerato OWNER (org, cancelled)"),
    thandi: await person(ctx, "thandi", "Thandi Ndaba", "TUTOR", "seed-thandi OWNER (solo, trial)"),
    sipho: await person(ctx, "sipho", "Sipho Radebe", "TUTOR", "seed-sipho OWNER (solo, active, payouts on)"),
    adult: await person(ctx, "student.adult", "Zanele Mthembu", "STUDENT", "adult student, pays own fees (seed-ubuntu)"),
    minor1: await person(ctx, "student.minor1", "Lwazi Dube", "STUDENT", "minor; parent seed.parent.one pays (seed-ubuntu)"),
    sib1: await person(ctx, "student.sib1", "Amahle Ngcobo", "STUDENT", "minor; sibling of sib2 (seed-ubuntu)"),
    sib2: await person(ctx, "student.sib2", "Luyanda Ngcobo", "STUDENT", "minor; sibling of sib1 (seed-ubuntu and seed-sipho)"),
    nofees: await person(ctx, "student.nofees", "Musa Cele", "STUDENT", "student with no fees (seed-ubuntu)"),
    twoWs: await person(ctx, "student.two", "Nandi Shabalala", "STUDENT", "student in two workspaces (seed-ubuntu and seed-sipho)"),
    trialStudent: await person(ctx, "student.trial", "Karabo Moloi", "STUDENT", "student in a trial workspace (seed-thandi)"),
    parentOne: await person(ctx, "parent.one", "Thabo Dube", "PARENT", "parent of one child (Lwazi)"),
    parentSibs: await person(ctx, "parent.siblings", "Nokuthula Ngcobo", "PARENT", "parent of siblings, children in two workspaces"),
  };

  // Workspaces.
  const U = await workspace({ slug: "seed-ubuntu", name: "Ubuntu Tutors (seed)", kind: "ORGANISATION", state: "ACTIVE", subaccount: SUBACCOUNTS.main }, P.ubuntuOwner.email);
  const K = await workspace({ slug: "seed-khanya", name: "Khanya Learning Centre (seed)", kind: "ORGANISATION", state: "TRIAL" }, P.khanyaOwner.email);
  const S = await workspace({ slug: "seed-sizwe", name: "Sizwe Academy (seed)", kind: "ORGANISATION", state: "PAST_DUE" }, P.sizweOwner.email);
  const T = await workspace({ slug: "seed-thuto", name: "Thuto Hub (seed)", kind: "ORGANISATION", state: "READ_ONLY" }, P.thutoOwner.email);
  const L = await workspace({ slug: "seed-lerato", name: "Lerato Centre (seed)", kind: "ORGANISATION", state: "CANCELLED" }, P.leratoOwner.email);
  const TH = await workspace({ slug: "seed-thandi", name: "Thandi Maths (seed)", kind: "SOLO", state: "TRIAL" }, P.thandi.email);
  const SI = await workspace({ slug: "seed-sipho", name: "Sipho Science (seed)", kind: "SOLO", state: "ACTIVE", subaccount: SUBACCOUNTS.secondary }, P.sipho.email);

  const member = (wsId: string, userId: string, role: "OWNER" | "ADMIN" | "TUTOR") => prisma.membership.create({ data: { workspaceId: wsId, userId, role }, select: { id: true } });
  const uOwner = await member(U.ws.id, P.ubuntuOwner.id, "OWNER");
  await member(U.ws.id, P.ubuntuAdmin.id, "ADMIN");
  const uT1 = await member(U.ws.id, P.ubuntuTutor1.id, "TUTOR");
  const uT2 = await member(U.ws.id, P.ubuntuTutor2.id, "TUTOR");
  const kOwner = await member(K.ws.id, P.khanyaOwner.id, "OWNER");
  const sOwner = await member(S.ws.id, P.sizweOwner.id, "OWNER");
  const tOwner = await member(T.ws.id, P.thutoOwner.id, "OWNER");
  const lOwner = await member(L.ws.id, P.leratoOwner.id, "OWNER");
  const thOwner = await member(TH.ws.id, P.thandi.id, "OWNER");
  const siOwner = await member(SI.ws.id, P.sipho.id, "OWNER");

  // Learners and their Student profiles (B's forms pick Student ids).
  const studentOf = new Map<string, string>();
  for (const u of [P.adult, P.minor1, P.sib1, P.sib2, P.nofees, P.twoWs, P.trialStudent]) {
    const s = await prisma.student.create({ data: { fullName: u.name, email: u.email, userId: u.id } });
    studentOf.set(u.id, s.id);
  }
  const learn = async (wsId: string, u: { id: string }, opts: { adult?: boolean } = {}) => {
    const l = await prisma.learner.create({ data: { workspaceId: wsId, userId: u.id, isMinor: !opts.adult, paymentVisible: !!opts.adult }, select: { id: true } });
    // Made by the first workspace's staff (migration 23), except the adult,
    // who stands in for a student who signed up themself.
    if (u.id !== P.adult.id) await prisma.user.updateMany({ where: { id: u.id, managedByWorkspaceId: null }, data: { managedByWorkspaceId: wsId } });
    return { learnerId: l.id, studentId: studentOf.get(u.id)!, userId: u.id };
  };
  const lu = {
    adult: await learn(U.ws.id, P.adult, { adult: true }),
    minor1: await learn(U.ws.id, P.minor1),
    sib1: await learn(U.ws.id, P.sib1),
    sib2: await learn(U.ws.id, P.sib2),
    nofees: await learn(U.ws.id, P.nofees),
    twoWs: await learn(U.ws.id, P.twoWs),
  };
  const ls = { sib2: await learn(SI.ws.id, P.sib2), twoWs: await learn(SI.ws.id, P.twoWs) };
  const lth = await learn(TH.ws.id, P.trialStudent);

  await prisma.guardianship.createMany({ data: [
    { guardianUserId: P.parentOne.id, studentUserId: P.minor1.id, status: "ACTIVE", relationship: "PARENT" },
    { guardianUserId: P.parentSibs.id, studentUserId: P.sib1.id, status: "ACTIVE", relationship: "PARENT" },
    { guardianUserId: P.parentSibs.id, studentUserId: P.sib2.id, status: "ACTIVE", relationship: "PARENT" },
  ] as Prisma.GuardianshipCreateManyInput[] });
  await prisma.user.updateMany({ where: { id: { in: [P.parentOne.id, P.parentSibs.id] } }, data: { managedByWorkspaceId: U.ws.id } });

  // Courses.
  const uMaths = await course(U.ws.id, uT1.id, "Maths Grade 10 (seed)", [lu.adult, lu.minor1, lu.sib1, lu.nofees, lu.twoWs], true);
  const uScience = await course(U.ws.id, uT2.id, "Physical Sciences Grade 11 (seed)", [lu.sib2, lu.twoWs, lu.adult], true);
  await course(U.ws.id, uOwner.id, "Owner's revision class (seed)", [lu.minor1], false);
  const siBio = await course(SI.ws.id, siOwner.id, "Life Sciences Grade 12 (seed)", [ls.sib2, ls.twoWs], true);
  await course(TH.ws.id, thOwner.id, "Algebra basics (seed)", [lth], true);
  for (const [w, m] of [[K, kOwner], [S, sOwner], [T, tOwner], [L, lOwner]] as const) await course(w.ws.id, m.id, `${w.ws.name.replace(" (seed)", "")} course (seed)`, [], false);

  // Fees (seed-ubuntu and seed-sipho have payouts).
  await prisma.feeSchedule.create({ data: { workspaceId: U.ws.id, courseId: uMaths.id, kind: "MONTHLY", amountCents: 85000, description: "Maths tuition", billingDay: 1, startsOn: at(-60) } });
  let n = 0;
  const num = (ws: string) => `INV-SEED-${ws}-${String(++n).padStart(3, "0")}`;
  const fi = (wsId: string, payoutId: string, l: { learnerId: string; userId: string }, cents: number, status: "OPEN" | "PAID", dueDays: number, courseId: string, tag: string) =>
    feeInvoice({ wsId, payoutId, learnerId: l.learnerId, studentUserId: l.userId, number: num(tag), cents, status, dueDays, courseId });
  await fi(U.ws.id, U.payout!.id, lu.adult, 85000, "OPEN", 5, uMaths.id, "U");        // adult pays own: open
  await fi(U.ws.id, U.payout!.id, lu.minor1, 85000, "OPEN", -10, uMaths.id, "U");     // parent one: overdue
  await fi(U.ws.id, U.payout!.id, lu.sib1, 85000, "OPEN", 5, uMaths.id, "U");         // siblings: open
  await fi(U.ws.id, U.payout!.id, lu.sib2, 70000, "OPEN", 5, uScience.id, "U");
  await fi(SI.ws.id, SI.payout!.id, ls.sib2, 60000, "OPEN", 3, siBio.id, "S");        // sibling in second workspace
  const paid = await fi(U.ws.id, U.payout!.id, lu.minor1, 85000, "PAID", -35, uMaths.id, "U");
  const refunded = await fi(U.ws.id, U.payout!.id, lu.sib1, 85000, "PAID", -30, uMaths.id, "U");

  // Their payments, and a partial refund being recovered from the payee.
  for (const [inv, payer] of [[paid, P.parentOne], [refunded, P.parentSibs]] as const) {
    const share = 85000 - 1700 - 1000;
    const pay = await prisma.payment.create({
      data: {
        provider: "PAYSTACK", reference: `nx-chk-seed-${inv.number}`, purpose: "PARENT_CHECKOUT", payerUserId: payer.id, status: "SUCCEEDED",
        amountCents: 85000, commissionCents: 1700, estimatedFeeCents: 2600, feeCents: 2565, channel: "card", paidAt: inv.paidAt!,
        allocations: { create: [{ invoiceId: inv.id, payoutAccountId: U.payout!.id, amountCents: 85000, shareCents: share, commissionCents: 1700, feeShareCents: 2500 }] },
      },
      include: { allocations: true },
    });
    await prisma.invoice.update({ where: { id: inv.id }, data: { payerUserId: payer.id } });
    if (inv.id === refunded.id) {
      const amount = 20000;
      const owed = Math.round((amount * share) / 85000);
      const r = await prisma.refund.create({
        data: { paymentId: pay.id, allocationId: pay.allocations[0].id, amountCents: amount, commissionReturnedCents: amount - owed, reason: "Two lessons cancelled by the tutor (seed case)", providerRefundId: "seed-refund", status: "PROCESSED", requestedByUserId: P.ubuntuOwner.id, processedAt: at(-10) },
      });
      await prisma.payment.update({ where: { id: pay.id }, data: { status: "PARTIALLY_REFUNDED" } });
      await prisma.invoice.update({ where: { id: inv.id }, data: { status: "PARTIALLY_REFUNDED" } });
      await prisma.payoutRecovery.create({ data: { workspaceId: U.ws.id, payoutAccountId: U.payout!.id, refundId: r.id, amountCents: owed, status: "ACTIVE", noticeSentAt: at(-10), deductFrom: at(-3) } });
    }
  }

  // Seats already paid for in each paid workspace's period, as a real
  // first payment records them (settle.ts, markInvoicePaid); without them
  // billing counts every seeded student as "added during the period" (F5).
  for (const w of [U, S, L, SI]) {
    const period = await prisma.billingPeriod.findFirst({ where: { workspaceId: w.ws.id }, orderBy: { start: "asc" }, select: { id: true, openedByInvoiceId: true } });
    if (!period?.openedByInvoiceId) continue;
    const enrols = await prisma.enrollment.findMany({ where: { workspaceId: w.ws.id, endedAt: null }, select: { courseId: true, learnerId: true } });
    if (enrols.length) {
      await prisma.seatCharge.createMany({
        data: enrols.map((e) => ({ workspaceId: w.ws.id, billingPeriodId: period.id, courseId: e.courseId, learnerId: e.learnerId, tierKey: "PRO" as const, kind: "ADVANCE" as const, invoiceId: period.openedByInvoiceId! })),
        skipDuplicates: true,
      });
    }
  }

  // Discount codes.
  const nexa = { issuerWorkspaceId: null, createdByUserId: P.ubuntuOwner.id };
  await prisma.discountCode.createMany({ data: [
    { ...nexa, code: "SEEDLIVE20", description: "20% off for 3 periods (live)", kind: "PERCENT", percentBps: 2000, scope: "WORKSPACE_BILL", startsAt: at(-10), durationPeriods: 3 },
    { ...nexa, code: "SEEDENDED", description: "Ended code", kind: "PERCENT", percentBps: 1000, scope: "WORKSPACE_BILL", startsAt: at(-60), endsAt: at(-1) },
    { ...nexa, code: "SEEDUSEDUP", description: "Used up", kind: "FIXED", amountCents: 5000, scope: "WORKSPACE_BILL", startsAt: at(-30), maxRedemptions: 1, redemptionCount: 1 },
    { ...nexa, code: "SEEDOFF", description: "Switched off", kind: "PERCENT", percentBps: 1500, scope: "WORKSPACE_BILL", startsAt: at(-30), active: false },
    { code: "SEEDSIBLINGS10", issuerWorkspaceId: U.ws.id, createdByUserId: P.ubuntuOwner.id, description: "10% off fees for siblings", kind: "PERCENT", percentBps: 1000, scope: "PARENT_INVOICE", startsAt: at(-5), durationPeriods: 3 },
    { code: "SEEDFEEOLD", issuerWorkspaceId: U.ws.id, createdByUserId: P.ubuntuOwner.id, description: "Ended fee code", kind: "FIXED", amountCents: 10000, scope: "PARENT_INVOICE", startsAt: at(-40), endsAt: at(-2) },
  ] });

  return ctx.accounts;
}

/* ------------------------------------------------------------------------- */

function loadPassword(): string {
  if (process.env.SEED_USER_PASSWORD) return process.env.SEED_USER_PASSWORD;
  if (existsSync(ENV_FILE)) {
    const m = readFileSync(ENV_FILE, "utf8").match(/^SEED_USER_PASSWORD=(.+)$/m);
    if (m) return m[1].trim().replace(/^"|"$/g, "");
  }
  return `Seed-${randomBytes(9).toString("base64url")}`;
}

function writeAccounts(password: string, accounts: Array<[string, string]>) {
  const lines = [
    "# Seeded test accounts on PREVIEW (scripts/seed-preview.ts). Git-ignored: never commit or post.",
    "# Every account below uses SEED_USER_PASSWORD. Re-running the seed keeps it.",
    `SEED_USER_PASSWORD="${password}"`,
    "",
    ...accounts.map(([email, note]) => `# ${email.padEnd(40)} ${note}`),
    "",
  ];
  writeFileSync(ENV_FILE, lines.join("\n"));
}

async function main() {
  const target = checkTarget(process.env.DATABASE_URL, process.env);
  if (!target.ok) {
    console.error(`seed-preview: refusing to run. ${target.reason}`);
    process.exit(1);
  }
  console.log(`seed-preview: target ${target.host}`);
  await wipe();
  if (process.argv.includes("--wipe")) return;
  const password = loadPassword();
  if (password.length < 10) throw new Error("SEED_USER_PASSWORD must be 10 characters or more");
  const accounts = await seed(password);
  writeAccounts(password, accounts);
  console.log(`seed-preview: ${accounts.length} accounts; list and password in ${ENV_FILE}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
