/**
 * Branding (Plus) and white-label (Pro) for a workspace (#216 phase 3).
 * Custom domains are on hold (owner, 24 Nov): everything stays on
 * www.nexa-lms.co.za. Contract: viewer.md, "Branding and white-label".
 */

import "server-only";

import { isOwnBlobUrl } from "@/features/billing/retention";
import { planAtLeast, workspacePlan } from "@/features/billing/workspace-plan";
import { prisma } from "@/lib/db";
import { UserError } from "@/lib/user-error";
import { ViewerError, type Viewer } from "@/lib/viewer";
import { can } from "@/lib/viewer-core";

import { cleanSenderName, validAccent, type EmailBrand } from "./brand-rules";

export const BRANDING_UPSELL = "Your logo, colour and sender name are part of the Plus plan.";
export const WHITE_LABEL_UPSELL = "White-label is part of the Pro plan.";

const select = { id: true, slug: true, name: true, logoUrl: true, accentColor: true, senderName: true, welcomeText: true, hideNexaBranding: true, supportEmail: true } as const;

/** The settings screen: current branding, the plan, and what it allows. */
export async function getBranding(viewer: Viewer) {
  if (!viewer.workspace || !can(viewer, "workspace.branding")) throw new ViewerError("FORBIDDEN");
  const [ws, plan] = await Promise.all([prisma.workspace.findUniqueOrThrow({ where: { id: viewer.workspace.id }, select }), workspacePlan(viewer.workspace.id)]);
  return { ...ws, plan, canBrand: planAtLeast(plan, "PLUS"), canWhiteLabel: planAtLeast(plan, "PRO"), signInPath: `/w/${ws.slug}` };
}

/** Logo (an image uploaded to Nexa's Blob store), accent colour, sender name and welcome text. Plus and Pro. */
export async function setBranding(viewer: Viewer, input: { logoUrl?: string | null; accentColor?: string | null; senderName?: string | null; welcomeText?: string | null }) {
  if (!viewer.workspace || !can(viewer, "workspace.branding")) throw new ViewerError("FORBIDDEN");
  if (!planAtLeast(await workspacePlan(viewer.workspace.id), "PLUS")) throw new UserError(BRANDING_UPSELL);
  if (input.logoUrl && !isOwnBlobUrl(input.logoUrl)) throw new UserError("Upload the logo to Nexa first.");
  if (input.accentColor && !validAccent(input.accentColor)) throw new UserError("Use a colour like #1F6FEB.");
  const sender = input.senderName === undefined ? undefined : input.senderName ? cleanSenderName(input.senderName) : null;
  if (sender !== undefined && sender !== null && sender.length < 2) throw new UserError("The sender name is too short.");
  const ws = await prisma.workspace.update({
    where: { id: viewer.workspace.id },
    data: {
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl || null } : {}),
      ...(input.accentColor !== undefined ? { accentColor: input.accentColor || null } : {}),
      ...(sender !== undefined ? { senderName: sender } : {}),
      ...(input.welcomeText !== undefined ? { welcomeText: input.welcomeText?.trim().slice(0, 300) || null } : {}),
    },
    select,
  });
  forgetBrand(ws.id);
  await prisma.auditLog.create({ data: { workspaceId: ws.id, actorUserId: viewer.user.id, action: "workspace.branding", targetType: "Workspace", targetId: ws.id, data: { logo: !!ws.logoUrl, accent: ws.accentColor, sender: ws.senderName } } });
  return ws;
}

/** White-label on or off, and the support address families see instead of Nexa's. Pro. */
export async function setWhiteLabel(viewer: Viewer, input: { hideNexaBranding: boolean; supportEmail?: string | null }) {
  if (!viewer.workspace || !can(viewer, "workspace.branding")) throw new ViewerError("FORBIDDEN");
  if (input.hideNexaBranding && !planAtLeast(await workspacePlan(viewer.workspace.id), "PRO")) throw new UserError(WHITE_LABEL_UPSELL);
  const email = input.supportEmail === undefined ? undefined : input.supportEmail?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError("Enter a valid support email address.");
  if (input.hideNexaBranding && !email && !(await prisma.workspace.findUniqueOrThrow({ where: { id: viewer.workspace.id }, select: { supportEmail: true } })).supportEmail) {
    throw new UserError("Add a support email first, so families know who to ask.");
  }
  const ws = await prisma.workspace.update({ where: { id: viewer.workspace.id }, data: { hideNexaBranding: input.hideNexaBranding, ...(email !== undefined ? { supportEmail: email } : {}) }, select });
  forgetBrand(ws.id);
  await prisma.auditLog.create({ data: { workspaceId: ws.id, actorUserId: viewer.user.id, action: "workspace.whitelabel", targetType: "Workspace", targetId: ws.id, data: { on: ws.hideNexaBranding } } });
  return ws;
}

/** For the public branded sign-in page /w/<slug> (B): null when the workspace has no Plus branding. */
export async function brandForSlug(slug: string) {
  const ws = await prisma.workspace.findUnique({ where: { slug }, select });
  if (!ws) return null;
  const plan = await workspacePlan(ws.id);
  if (!planAtLeast(plan, "PLUS")) return null;
  const white = ws.hideNexaBranding && planAtLeast(plan, "PRO");
  return { slug: ws.slug, name: ws.name, logoUrl: ws.logoUrl, accentColor: ws.accentColor, welcomeText: ws.welcomeText, whiteLabel: white, supportEmail: white ? ws.supportEmail : null };
}

/* ------------------------------------------------------------------------- */
/* For the email queue                                                       */
/* ------------------------------------------------------------------------- */

const cache = new Map<string, { at: number; brand: EmailBrand | null }>();
function forgetBrand(workspaceId: string) {
  cache.delete(workspaceId);
}

/** The brand for a workspace's emails, or null (Core, or nothing set). Cached for five minutes per instance. */
export async function emailBrandFor(workspaceId: string, now: number = Date.now()): Promise<EmailBrand | null> {
  const hit = cache.get(workspaceId);
  if (hit && now - hit.at < 300_000) return hit.brand;
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select });
  let brand: EmailBrand | null = null;
  if (ws) {
    const plan = await workspacePlan(ws.id);
    if (planAtLeast(plan, "PLUS")) {
      brand = { name: ws.name, senderName: ws.senderName || ws.name, logoUrl: ws.logoUrl, accentColor: ws.accentColor, whiteLabel: ws.hideNexaBranding && planAtLeast(plan, "PRO") };
    }
  }
  cache.set(workspaceId, { at: now, brand });
  return brand;
}
