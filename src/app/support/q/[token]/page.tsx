/**
 * /support/q/[token]: a public requester's query, through the private link
 * in their email (support.md). They can read the answers and reply.
 */

import { PublicHelpFrame } from "@/features/support/components/public-frame";
import { QueryThread } from "@/features/support/components/query-thread";
import { STATUS_LABEL } from "@/features/support/support-rules";
import { getQueryByToken } from "@/features/support/support";
import { whenLabel } from "@/features/support/support-ui";
import { UserError } from "@/lib/user-error";

export const metadata = { title: "Your query", robots: { index: false, follow: false } };

export default async function PublicQueryPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let q: Awaited<ReturnType<typeof getQueryByToken>>;
  try {
    q = await getQueryByToken(token);
  } catch (e) {
    if (e instanceof UserError) {
      return (
        <PublicHelpFrame title="This link doesn't work" lead="It may have been mistyped, or the query was deleted. Send us a new query from the Help and support page.">
          <a href="/support#contact" className="text-primary text-sm underline underline-offset-2">Go to Help and support</a>
        </PublicHelpFrame>
      );
    }
    throw e;
  }
  const now = new Date();
  return (
    <PublicHelpFrame title={q.subject} lead={`${q.ref} · ${STATUS_LABEL[q.status]} · Sent ${whenLabel(q.createdAt, now)}. Keep this link private: anyone with it can read and reply.`}>
      <QueryThread
        id={q.id}
        status={q.status}
        route={q.route}
        helpful={q.helpful}
        side="public"
        token={token}
        answererName={q.requesterName}
        messages={q.messages.map((m) => ({ ...m, whenLabel: whenLabel(m.createdAt, now) }))}
      />
    </PublicHelpFrame>
  );
}
