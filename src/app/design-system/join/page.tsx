/**
 * /design-system/join — the join-request screens (#206) with sample data
 * and no session: the Find courses grid (a parent with two children, one
 * already asked), the asker's own requests in every state, the staff inbox,
 * its empty states, and the course settings switch. Buttons that reach the
 * server refuse here (no session). Same gate as /design-system.
 */

import { notFound } from "next/navigation";
import { Search } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { WorkspaceAccessProvider } from "@/components/shell/workspace-access";
import { Card } from "@/components/ui/card";
import { CourseListingSwitch } from "@/features/courses/components/join-requests";
import {
  ListedCourseGrid, MyRequestsList, NoJoinRequests, NoListedCourses, StaffRequestList,
  type ListedCourseRow, type MyRequestRow, type StaffRequestRow,
} from "@/features/courses/components/join-views";
import { ReferralLinkCard } from "@/features/courses/components/referral-link";
import { ReferralList, ReferrerTable } from "@/features/courses/components/referral-views";
import { askTargets } from "@/features/courses/lib/join-ui";
import { canPreviewDesignSystem } from "@/lib/ui-flags";

export const metadata = { title: "Join requests · Design system", robots: { index: false } };

const ctx = { timeZone: "Africa/Johannesburg", locale: "en-ZA" };
const school = { id: "w1", name: "Riverside Maths Academy", kind: "ORGANISATION" as const, logoUrl: null };

const COURSES: ListedCourseRow[] = [
  { courseId: "c1", name: "Grade 10 Mathematics", description: "Functions, algebra and Euclidean geometry, term by term, with a weekly practice test.", imageUrl: "", workspace: school, tutors: ["Ms Dlamini"] },
  { courseId: "c2", name: "Physical Sciences: Mechanics", description: "Vectors, Newton's laws and momentum.", imageUrl: "", workspace: school, tutors: ["Mr Naidoo", "Ms Dlamini"], enrolledUserIds: ["k1"] },
  { courseId: "c3", name: "Accounting for beginners", description: null, imageUrl: "", workspace: { id: "w2", name: "Bongi's Tutoring", kind: "SOLO", logoUrl: null }, tutors: ["Bongi"] },
];

const MINE: MyRequestRow[] = [
  { id: "m1", status: "PENDING", message: "Thandi missed the first week.", declineReason: null, createdAt: "2026-11-20T08:00:00.000Z", decidedAt: null, course: { id: "c1", name: "Grade 10 Mathematics", imageUrl: "" }, workspaceName: school.name, student: { id: "k1", name: "Thandi" }, madeByMe: true },
  { id: "m2", status: "PENDING", message: null, declineReason: null, createdAt: "2026-11-21T08:00:00.000Z", decidedAt: null, course: { id: "c1", name: "Grade 10 Mathematics", imageUrl: "" }, workspaceName: school.name, student: { id: "k2", name: "Musa" }, madeByMe: true },
  { id: "m3", status: "APPROVED", message: null, declineReason: null, createdAt: "2026-11-02T08:00:00.000Z", decidedAt: "2026-11-03T08:00:00.000Z", course: { id: "c3", name: "Accounting for beginners", imageUrl: "" }, workspaceName: "Bongi's Tutoring", student: { id: "k1", name: "Thandi" }, madeByMe: true },
  { id: "m4", status: "DECLINED", message: null, declineReason: "The class is full this term. Try again in January.", createdAt: "2026-10-12T08:00:00.000Z", decidedAt: "2026-10-14T08:00:00.000Z", course: { id: "c2", name: "Physical Sciences: Mechanics", imageUrl: "" }, workspaceName: school.name, student: { id: "k2", name: "Musa" }, madeByMe: true },
  { id: "m5", status: "CANCELLED", message: null, declineReason: null, createdAt: "2026-10-01T08:00:00.000Z", decidedAt: "2026-10-02T08:00:00.000Z", course: { id: "c2", name: "Physical Sciences: Mechanics", imageUrl: "" }, workspaceName: school.name, student: { id: "k1", name: "Thandi" }, madeByMe: true },
];

const INBOX: StaffRequestRow[] = [
  { id: "s1", status: "PENDING", message: "Thandi missed the first week.", declineReason: null, createdAt: "2026-11-20T08:00:00.000Z", decidedAt: null, course: { id: "c1", name: "Grade 10 Mathematics" }, studentName: "Thandi", parentName: "Sipho" },
  { id: "s2", status: "PENDING", message: null, declineReason: null, createdAt: "2026-11-21T09:30:00.000Z", decidedAt: null, course: { id: "c2", name: "Physical Sciences: Mechanics" }, studentName: "Lindi", parentName: null },
];
const DECIDED: StaffRequestRow[] = [
  { id: "s3", status: "DECLINED", message: null, declineReason: "The class is full this term. Try again in January.", createdAt: "2026-10-12T08:00:00.000Z", decidedAt: "2026-10-14T08:00:00.000Z", course: { id: "c2", name: "Physical Sciences: Mechanics" }, studentName: "Musa", parentName: "Sipho" },
];

export default function JoinPreviewPage() {
  if (!canPreviewDesignSystem()) notFound();
  const parent = askTargets({ userId: "p", name: "Sipho", isStudent: false }, [{ userId: "k1", name: "Thandi" }, { userId: "k2", name: "Musa" }]);

  return (
    <div data-ui="revamp" data-shell="focus" className="bg-background text-foreground min-h-screen font-sans">
      <WorkspaceAccessProvider readOnly={false}>
        <PageFrame type="list" breadcrumb={[{ label: "Design system", href: "/design-system" }, { label: "Join requests" }]}>
          <PageTitle icon={<Search />} title="Join requests" description="Find courses, the asker's requests, the staff inbox and the course switch (#206)." />

          <PageSection id="browse" title="Find courses, as a parent of two" description="Grade 10 Mathematics: both children asked, so the card says so. The others offer Ask to join.">
            <ListedCourseGrid courses={COURSES} targets={parent} mine={MINE} />
          </PageSection>

          <PageSection id="mine" title="Your requests" description="Every state. Cancel only while waiting.">
            <MyRequestsList rows={MINE} ctx={ctx} meId="p" />
          </PageSection>

          <PageSection id="inbox" title="Staff inbox: waiting" description="Approve asks whether the student is under 18; a minor who asked alone needs a parent's consent ticked.">
            <StaffRequestList rows={INBOX} ctx={ctx} />
          </PageSection>

          <PageSection id="decided" title="Staff inbox: declined">
            <StaffRequestList rows={DECIDED} ctx={ctx} />
          </PageSection>

          <PageSection id="settings" title="Course settings">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-6"><CourseListingSwitch courseId="c1" listed pending={2} /></Card>
              <Card className="p-6"><CourseListingSwitch courseId="c3" listed={false} pending={0} /></Card>
            </div>
          </PageSection>

          <PageSection id="referral-link" title="Refer a friend" description="A student's or parent's link; the second workspace has no listed course.">
            <div className="max-w-3xl space-y-4">
              <ReferralLinkCard link={{ workspaceId: "w1", workspaceName: school.name, url: "https://example.test/api/referrals/abcdefghjk", requested: 3, joined: 2, hasListed: true }} />
              <ReferralLinkCard link={{ workspaceId: "w2", workspaceName: "Bongi's Tutoring", url: "https://example.test/api/referrals/mnpqrstuvw", requested: 0, joined: 0, hasListed: false }} />
            </div>
          </PageSection>

          <PageSection id="referrals" title="Referrals, for owners and admins">
            <ReferrerTable rows={[{ referrerId: "p", name: "Sipho Dube", requested: 3, joined: 2 }, { referrerId: "s", name: "Lindi Nkosi", requested: 1, joined: 0 }]} />
            <ReferralList
              ctx={ctx}
              rows={[
                { referrerName: "Sipho Dube", referredName: "Ayanda Mokoena", status: "JOINED", createdAt: "2026-11-02T08:00:00.000Z", joinedAt: "2026-11-03T08:00:00.000Z" },
                { referrerName: "Lindi Nkosi", referredName: "Kabelo Molefe", status: "REQUESTED", createdAt: "2026-11-01T08:00:00.000Z", joinedAt: null },
              ]}
            />
          </PageSection>

          <PageSection id="empty" title="Empty states">
            <div className="grid gap-4 lg:grid-cols-2">
              <NoListedCourses searched={false} />
              <NoListedCourses searched />
              <NoListedCourses searched={false} workspace />
              <NoJoinRequests status="PENDING" />
              <NoJoinRequests status="DECLINED" />
            </div>
          </PageSection>
        </PageFrame>
      </WorkspaceAccessProvider>
    </div>
  );
}
