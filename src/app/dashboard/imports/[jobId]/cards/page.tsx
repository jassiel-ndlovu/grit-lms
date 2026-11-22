/**
 * /dashboard/imports/[jobId]/cards — the printable sign-in cards a students
 * import made (#216). The page holds no codes; SignInSheet fetches them.
 */

import { notFound, redirect } from "next/navigation";

import { importRoutes } from "@/components/imports/import-ui";
import { SignInSheet } from "@/components/imports/sign-in-sheet";
import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { getImport } from "@/features/imports/actions";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Sign-in cards" };

export default async function ImportCardsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.workspace) redirect("/auth");
  const { jobId } = await params;
  const view = (await getImport({ jobId }))?.data;
  if (!view) notFound();

  return (
    <PageFrame
      type="list"
      breadcrumb={[
        { label: "Imports", href: importRoutes.home },
        { label: view.fileName, href: importRoutes.job(view.id) },
        { label: "Sign-in cards" },
      ]}
    >
      <PageTitle title="Sign-in cards" description={`New students and parents from ${view.fileName}.`} />
      <SignInSheet jobId={view.id} workspaceName={viewer.workspace.name} />
    </PageFrame>
  );
}
