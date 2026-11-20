/**
 * /dashboard/students/[learnerId] — a student's profile (#174; a/ux/01,
 * section 7): the Sign-in tab (new code) and the Parents tab (link,
 * unlink). `?tab=parents` opens the Parents tab.
 */

import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ParentsPanel, SignInPanel, type ParentRow } from "@/features/courses/components/accounts/student-account-panels";
import { getRosterStudent } from "@/features/courses/lib/roster";
import { listParents } from "@/features/users/account-actions";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "Student" };

interface PageProps {
  params: Promise<{ learnerId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function StudentProfilePage({ params, searchParams }: PageProps) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");
  if (!viewer.workspace || !can(viewer, "learners.invite")) redirect("/dashboard");

  const [{ learnerId }, { tab }] = await Promise.all([params, searchParams]);
  const student = await getRosterStudent(viewer, learnerId);
  if (!student) notFound();

  const canLink = can(viewer, "guardians.link");
  const parentsRes = canLink ? await listParents({ learnerId }) : null;
  const parents: ParentRow[] = (parentsRes?.data ?? []).map((p) => ({
    ...p,
    linkedAt: typeof p.linkedAt === "string" ? p.linkedAt : new Date(p.linkedAt).toISOString(),
  }));

  return (
    <>
      <PageHeader breadcrumb={[{ label: "Students", href: "/dashboard/students" }, { label: student.name }]} />
      <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:px-6 sm:py-10">
        <div className="space-y-1">
          <h1 className="font-display text-foreground text-2xl leading-tight tracking-tight sm:text-3xl">{student.name}</h1>
          <p className="text-muted-foreground text-sm">
            {student.courses.length ? student.courses.map((c) => c.name).join(", ") : "Not on a course"}
            {student.isMinor ? " · Under 18" : ""}
          </p>
        </div>

        <Tabs defaultValue={tab === "parents" && canLink ? "parents" : "sign-in"}>
          <TabsList>
            <TabsTrigger value="sign-in">Sign-in</TabsTrigger>
            {canLink ? <TabsTrigger value="parents">Parents</TabsTrigger> : null}
          </TabsList>
          <TabsContent value="sign-in" className="pt-3">
            <SignInPanel
              userId={student.userId}
              name={student.name}
              workspaceName={viewer.workspace.name}
              username={student.username}
              email={student.email}
              awaitingFirstSignIn={student.awaitingFirstSignIn}
            />
          </TabsContent>
          {canLink ? (
            <TabsContent value="parents" className="pt-3">
              {parentsRes?.data ? (
                <ParentsPanel learnerId={student.learnerId} studentName={student.name} workspaceName={viewer.workspace.name} parents={parents} />
              ) : (
                <p role="alert" className="text-muted-foreground text-sm">
                  We couldn&apos;t load this student&apos;s parents just now. Refresh to try again.
                </p>
              )}
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </>
  );
}
