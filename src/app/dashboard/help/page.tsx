/**
 * /dashboard/help: the help and contact centre (owner 24 Nov; support.md).
 * Help written for the viewer's role, a way to ask, and their own queries.
 * Staff who answer queries get a link to their inbox.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { Bug, Inbox, Lightbulb, MessageCircleQuestion } from "lucide-react";

import { PageFrame, PageSection, PageTitle } from "@/components/shell/page-frame";
import { Button } from "@/components/ui/button";
import { TonePanel } from "@/components/ui/nexus";
import { articlesFor, type HelpAudience } from "@/features/support/help-articles";
import { HelpArticles } from "@/features/support/components/help-articles";
import { QueryList } from "@/features/support/components/query-list";
import { helpContext, listMyQueries } from "@/features/support/support";
import { supportRoutes } from "@/features/support/support-ui";
import { getViewer } from "@/lib/viewer";

export const metadata = { title: "Help" };

const ASK = [
  { kind: "QUESTION", label: "Ask a question", hint: "How to do something, or why something happened.", icon: MessageCircleQuestion },
  { kind: "PROBLEM", label: "Report a problem", hint: "Something isn't working or shows an error.", icon: Bug },
  { kind: "FEEDBACK", label: "Share feedback", hint: "An idea, a complaint or a compliment.", icon: Lightbulb },
] as const;

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?callbackUrl=/dashboard/help");
  const { from } = await searchParams;
  const [context, mine] = await Promise.all([helpContext(viewer), listMyQueries(viewer)]);
  const audience: HelpAudience = context.persona === "admin" ? "staff" : context.persona;
  const fromQs = from ? `&from=${encodeURIComponent(from)}` : "";
  const open = mine.filter((q) => q.status !== "CLOSED");
  const familyAnswerer = context.organisations.length === 1 ? context.organisations[0].name : "your tutor or school";

  return (
    <PageFrame type="list" breadcrumb={[{ label: "Help" }]} helpHref={null}>
      <PageTitle
        title="Help"
        description={
          context.persona === "learner" || context.persona === "guardian"
            ? `Find an answer below, or send a message. Questions about classes, marks and fees go to ${familyAnswerer}; anything about your account or the app goes to Nexa support.`
            : "Find an answer below, or send a message to Nexa support. We usually answer within one working day."
        }
      />

      {context.canSeeOrganisationInbox || context.isNexaAdmin ? (
        <TonePanel tone="accent" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            <Inbox aria-hidden className="mr-2 inline size-4" />
            {context.isNexaAdmin ? "Queries sent to Nexa support are in the support inbox." : "Questions from your students and parents are in your organisation's inbox."}
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href={context.isNexaAdmin ? supportRoutes.nexaInbox : supportRoutes.organisationInbox}>Open the inbox</Link>
          </Button>
        </TonePanel>
      ) : null}

      <PageSection title="Contact us" description="Pick what fits best. You can add screenshots, and you'll be told when someone replies.">
        <ul className="grid gap-3 sm:grid-cols-3">
          {ASK.map((a) => (
            <li key={a.kind}>
              <Link href={`${supportRoutes.newQuery}?kind=${a.kind}${fromQs}`} className="border-border hover:bg-muted/50 flex h-full flex-col gap-1 rounded-lg border p-4">
                <span className="text-foreground flex items-center gap-2 text-sm font-medium"><a.icon aria-hidden className="text-primary size-4" /> {a.label}</span>
                <span className="text-muted-foreground text-xs">{a.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </PageSection>

      {mine.length ? (
        <PageSection
          title="Your queries"
          description={open.length ? `${open.length} still open. A dot means there's a reply you haven't read.` : "All your queries are closed. Reply to one within 30 days to reopen it."}
        >
          <QueryList items={mine} side="requester" />
        </PageSection>
      ) : null}

      <PageSection title="Answers to common questions">
        <HelpArticles articles={articlesFor(audience)} askBase={from ? `${supportRoutes.newQuery}?from=${encodeURIComponent(from)}` : supportRoutes.newQuery} />
      </PageSection>
    </PageFrame>
  );
}
