/**
 * Which account-wide banners a viewer sees, as plain data.
 *
 * Rendered by `<AccountBanners viewer />` into AppShell's `banner` slot
 * (docs/revamp/contracts/navigation.md). Wording follows
 * docs/revamp/a/ux/03-billing.md (billing states) and
 * docs/revamp/a/ux/06-admin-console.md (impersonation).
 *
 * Pure: no React, no database, so scripts/check-account-banners.ts can run it.
 * Billing amounts and renewal dates join the messages when the billing
 * queries ship (Phase 2); the viewer only carries the state and trial end.
 */

import { can, type Viewer } from "@/lib/viewer-core";

export type BannerTone = "danger" | "warning" | "info";

export type BannerAction =
  | { kind: "link"; label: string; href: string }
  | { kind: "resend-verification"; label: string };

export type AccountBanner = {
  id: "impersonation" | "billing" | "verify-email";
  tone: BannerTone;
  message: string;
  actions: BannerAction[];
};

const BILLING_HREF = "/dashboard/settings/billing";
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDay(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", timeZone }).format(
    new Date(iso),
  );
}

function minutesLeft(iso: string, now: Date): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 60_000));
}

export function accountBannersFor(viewer: Viewer, now: Date = new Date()): AccountBanner[] {
  const banners: AccountBanner[] = [];

  // 1. Impersonation: always first, cannot be dismissed.
  if (viewer.impersonatedBy) {
    const where = viewer.workspace ? ` (${viewer.workspace.name})` : "";
    banners.push({
      id: "impersonation",
      tone: "danger",
      message:
        `You are viewing as ${viewer.user.name}${where} · ${viewer.impersonatedBy.name}, Nexa admin · ` +
        `${minutesLeft(viewer.impersonatedBy.endsAt, now)} min left · Payments and security settings are blocked`,
      // endImpersonation() arrives with the admin console (Phase 3).
      actions: [{ kind: "link", label: "Back to admin console", href: "/admin" }],
    });
  }

  // 2. Billing: staff only. Learners and guardians never see billing banners.
  const ws = viewer.workspace;
  if (ws && viewer.persona === "staff") {
    const pays = can(viewer, "billing.manage");
    const tz = ws.timezone;
    const payNow: BannerAction = { kind: "link", label: "Pay now", href: BILLING_HREF };

    switch (ws.billingState) {
      case "TRIAL": {
        if (!ws.trialEndsAt) break;
        const daysLeft = Math.ceil((new Date(ws.trialEndsAt).getTime() - now.getTime()) / DAY_MS);
        if (daysLeft > 5) break; // days 1 to 9 of 14: chip only, no banner
        const ends = formatDay(ws.trialEndsAt, tz);
        banners.push(
          pays
            ? { id: "billing", tone: "warning", message: `Your trial ends on ${ends}. Pay to continue for 30 days.`, actions: [payNow] }
            : { id: "billing", tone: "warning", message: `Trial ends on ${ends}.`, actions: [] },
        );
        break;
      }
      case "PAST_DUE":
        if (pays) {
          banners.push({
            id: "billing",
            tone: "danger",
            message: "We couldn't renew your plan. Update your card or pay now to avoid interruptions.",
            actions: [{ kind: "link", label: "Update card", href: BILLING_HREF }, payNow],
          });
        }
        break;
      case "READ_ONLY":
        banners.push(
          pays
            ? {
                id: "billing",
                tone: "danger",
                message:
                  "Your workspace is read-only because the renewal wasn't paid. Students can still see their work. Pay to unlock.",
                actions: [payNow],
              }
            : { id: "billing", tone: "danger", message: "This workspace is read-only. Ask the owner to renew.", actions: [] },
        );
        break;
      case "CANCELLED":
        banners.push(
          pays
            ? {
                id: "billing",
                tone: "warning",
                message: "Cancelled. The workspace becomes read-only when the last paid period ends.",
                actions: [{ kind: "link", label: "Reactivate", href: BILLING_HREF }],
              }
            : { id: "billing", tone: "warning", message: "This workspace is closing.", actions: [] },
        );
        break;
      case "ACTIVE":
      case "COMPED":
        break;
    }
  }

  // 3. Email verification: anyone signed in with an unverified address.
  // Not while impersonating: the admin must not trigger mail as the user.
  if (!viewer.user.emailVerified && !viewer.impersonatedBy) {
    banners.push({
      id: "verify-email",
      tone: "info",
      message: `Please verify your email address, ${viewer.user.email}, so you get reminders and receipts.`,
      actions: [{ kind: "resend-verification", label: "Resend link" }],
    });
  }

  return banners;
}
