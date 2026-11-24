/**
 * /support: public help (owner 24 Nov; support.md). Short answers for people
 * who aren't signed in, and a form that reaches Nexa support. Signed-in
 * people are sent to the full help centre.
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { HelpArticles } from "@/features/support/components/help-articles";
import { PublicHelpFrame } from "@/features/support/components/public-frame";
import { PublicQueryForm } from "@/features/support/components/public-query-form";
import { articlesFor } from "@/features/support/help-articles";
import { getViewer } from "@/lib/viewer";

export const metadata = {
  title: "Help and support",
  description: "Answers to common questions about Nexa LMS, and a form to reach our support team.",
  alternates: { canonical: "/support" },
};

export default async function SupportPage() {
  if (await getViewer()) redirect("/dashboard/help");
  return (
    <PublicHelpFrame
      title="Help and support"
      lead="Find a quick answer, or send us a message. We usually answer within one working day."
    >
      <section className="flex flex-col gap-3" aria-labelledby="answers">
        <h2 id="answers" className="text-foreground text-base font-semibold">Common questions</h2>
        <HelpArticles articles={articlesFor("public")} askBase="#contact" />
      </section>

      <section id="contact" className="flex scroll-mt-6 flex-col gap-3" aria-labelledby="contact-heading">
        <div>
          <h2 id="contact-heading" className="text-foreground text-base font-semibold">Contact us</h2>
          <p className="text-muted-foreground text-sm">
            Students and parents: questions about your classes, marks or fees are answered fastest by your tutor or school. <Link href="/auth?callbackUrl=/dashboard/help" className="text-primary underline underline-offset-2">Sign in</Link> and use Help to send them a message.
          </p>
        </div>
        <PublicQueryForm />
      </section>
    </PublicHelpFrame>
  );
}
