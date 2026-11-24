/** /dashboard/enquiries/new: add an enquiry that came by phone, in person or elsewhere. */

import { redirect } from "next/navigation";

import { PageFrame, PageMessage, PageTitle } from "@/components/shell/page-frame";
import { EnquiryForm } from "@/features/crm/components/enquiry-parts";
import { enquiryChoices } from "@/features/crm/crm-page-data";
import { crmRoutes } from "@/features/crm/crm-ui";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "New enquiry" };

export default async function NewEnquiryPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/auth?callbackUrl=${crmRoutes.create}`);
  const crumbs = [{ label: "Enquiries", href: crmRoutes.list }, { label: "New enquiry" }];
  if (!viewer.workspace || viewer.persona !== "staff" || !can(viewer, "enquiries.manage")) {
    return <PageMessage breadcrumb={crumbs}>Only staff who handle enquiries can add one.</PageMessage>;
  }
  const choices = await enquiryChoices(viewer.workspace.id);
  return (
    <PageFrame type="settings" breadcrumb={crumbs}>
      <PageTitle title="New enquiry" description="Someone asked about classes by phone, in person or another way. Add them so they're followed up." />
      <EnquiryForm branches={choices.branches} staff={choices.staff} />
    </PageFrame>
  );
}
