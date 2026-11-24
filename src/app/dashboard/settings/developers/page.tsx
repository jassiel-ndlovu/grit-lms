/**
 * Settings › API and webhooks (contracts/api.md, Pro). Owners and admins
 * (`workspace.settings`).
 */

import Link from "next/link";
import { redirect } from "next/navigation";

import { PageFrame, PageMessage, PageTitle } from "@/components/shell/page-frame";
import { Button } from "@/components/ui/button";
import { TonePanel } from "@/components/ui/nexus";
import { SCOPE_LABEL, API_SCOPES, WEBHOOK_EVENTS } from "@/features/api/api-math";
import { DevelopersPanel } from "@/features/api/components/developers-panel";
import { apiAccessAvailable, listApiKeys, listWebhookEndpoints } from "@/features/api/manage";
import { siteUrl } from "@/lib/site";
import { can, getViewer } from "@/lib/viewer";

export const metadata = { title: "API and webhooks" };

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export default async function DevelopersPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?callbackUrl=/dashboard/settings/developers");
  const crumbs = [{ label: "Settings", href: "/dashboard/settings" }, { label: "API and webhooks" }];
  if (!viewer.workspace || !can(viewer, "workspace.settings") || (viewer.persona !== "staff" && viewer.persona !== "admin")) {
    return <PageMessage breadcrumb={crumbs}>Only owners and admins can manage API keys and webhooks.</PageMessage>;
  }
  const title = (
    <PageTitle
      title="API and webhooks"
      description="Connect Nexa to your other systems: API keys let them read your data, and webhooks tell them when something happens."
    />
  );
  if (!(await apiAccessAvailable(viewer.workspace.id))) {
    return (
      <PageFrame type="settings" breadcrumb={crumbs}>
        {title}
        <TonePanel tone="accent" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">API keys and webhooks are part of the <strong>Pro</strong> plan. Move a course to Pro in Billing to use them.</p>
          <Button asChild size="sm" variant="outline"><Link href="/dashboard/settings/billing">Open Billing</Link></Button>
        </TonePanel>
      </PageFrame>
    );
  }
  const [keys, endpoints] = await Promise.all([listApiKeys(viewer), listWebhookEndpoints(viewer)]);
  return (
    <PageFrame type="settings" breadcrumb={crumbs}>
      {title}
      <DevelopersPanel
        apiBase={`${siteUrl()}/api/v1`}
        scopes={API_SCOPES.map((s) => ({ key: s, label: SCOPE_LABEL[s] }))}
        events={[...WEBHOOK_EVENTS]}
        keys={keys.map((k) => ({ ...k, createdAt: k.createdAt.toISOString(), lastUsedAt: iso(k.lastUsedAt), expiresAt: iso(k.expiresAt), revokedAt: iso(k.revokedAt) }))}
        endpoints={endpoints.map((w) => ({ ...w, createdAt: w.createdAt.toISOString(), lastSuccessAt: iso(w.lastSuccessAt), failingSince: iso(w.failingSince) }))}
      />
    </PageFrame>
  );
}
