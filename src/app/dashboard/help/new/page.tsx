/**
 * /dashboard/help/new: send a question, problem report or feedback
 * (support.md). `?kind=`, `?topic=` and `?from=` prefill it.
 */

import { redirect } from "next/navigation";

import { PageFrame, PageTitle } from "@/components/shell/page-frame";
import { QueryForm } from "@/features/support/components/query-form";
import { cleanPagePath, SUPPORT_KINDS, SUPPORT_TOPICS, type SupportKind, type SupportTopic } from "@/features/support/support-rules";
import { helpContext } from "@/features/support/support";
import { supportRoutes } from "@/features/support/support-ui";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Contact us" };

export default async function NewQueryPage({ searchParams }: { searchParams: Promise<{ kind?: string; topic?: string; from?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/auth?callbackUrl=${encodeURIComponent(supportRoutes.newQuery)}`);
  const sp = await searchParams;
  const context = await helpContext(viewer);
  const kind = (SUPPORT_KINDS as readonly string[]).includes(sp.kind ?? "") ? (sp.kind as SupportKind) : undefined;
  const topic = (SUPPORT_TOPICS as readonly string[]).includes(sp.topic ?? "") ? (sp.topic as SupportTopic) : undefined;
  const from = cleanPagePath(sp.from);

  return (
    <PageFrame type="settings" breadcrumb={[{ label: "Help", href: supportRoutes.help }, { label: "Contact us" }]} helpHref={null}>
      <PageTitle
        title="Contact us"
        description="Tell us what you need in your own words. You'll be able to follow the conversation under Help, and you'll be told when someone replies."
      />
      <QueryForm
        context={{ userId: viewer.user.id, persona: context.persona, organisations: context.organisations, courses: context.courses }}
        initialKind={kind}
        initialTopic={topic}
        fromPath={from}
      />
    </PageFrame>
  );
}
