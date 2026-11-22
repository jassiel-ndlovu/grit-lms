import * as React from "react";

import { DEFAULT_WIDTH, FRAME_BODY_CLASS, FRAME_WIDTH_CLASS, type FrameWidth, type PageType } from "@/lib/ui-layout";
import { cn } from "@/lib/utils";

import { PageHeader, type Crumb } from "./page-header";
import { Ribbon } from "./ribbon";

/**
 * PageFrame — one frame for every dashboard page (#205, owner-approved plan).
 *
 *   ┌ PageHeader ─ breadcrumb · status · actions · help ─┐  48 px, sticky
 *   ├ Ribbon ───── views and tools for this page ────────┤  40 px, sticky, optional
 *   │  PageTitle (icon, eyebrow, 28 px title, description, properties)
 *   │  section … 32 px apart
 *
 * Widths, padding and the section gap come from src/app/page-frame.css
 * through src/lib/ui-layout.ts. `type` picks the usual width (Reading 720,
 * Standard 1120 or Full); `width` overrides it.
 *
 * The test runner (`type="runner"`) gets a thin header strip; a Pro
 * lockdown sitting (`lockdown`) gets none at all.
 *
 * Server-safe: the Ribbon is the only client part.
 */
export interface PageFrameProps {
  /** The primary header's breadcrumb. The last crumb is the current page. */
  breadcrumb: Crumb[];
  /** One StatusChip, or nothing. */
  status?: React.ReactNode;
  /** One primary action at most, plus quiet secondary ones. */
  actions?: React.ReactNode;
  /** Pass null to hide the help button. */
  helpHref?: string | null;
  /** The secondary header's content (RibbonNav, RibbonToolbar). Omit for none. */
  secondary?: React.ReactNode;
  type?: PageType;
  width?: FrameWidth;
  /** Runner only: hide the header entirely (Pro lockdown tests). */
  lockdown?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function PageFrame({
  breadcrumb, status, actions, helpHref, secondary, type = "list", width, lockdown = false, className, children,
}: PageFrameProps) {
  const w = width ?? DEFAULT_WIDTH[type];
  const runner = type === "runner";
  return (
    <div data-slot="page-frame" data-page-type={type} data-width={w}>
      {lockdown && runner ? null : (
        <PageHeader
          breadcrumb={breadcrumb}
          status={status}
          actions={actions}
          helpHref={runner ? null : helpHref}
          density={runner ? "runner" : "default"}
        />
      )}
      {secondary && !runner ? <Ribbon>{secondary}</Ribbon> : null}
      <div className={cn(FRAME_BODY_CLASS, FRAME_WIDTH_CLASS[w], className)}>{children}</div>
    </div>
  );
}

/**
 * PageTitle — the page's title, in the content as in Notion. Optional icon
 * and eyebrow above a 28 px title, a description, then a property row
 * (PropertyList, chips, dates). Exactly one h1 per page.
 */
export function PageTitle({
  title, icon, eyebrow, description, properties, actions, illustration, className,
}: {
  title: React.ReactNode;
  /** A lucide icon or an emoji; shown at 32 px above the title. */
  icon?: React.ReactNode;
  /** A short label above the title: the record's kind or its parent. */
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  /** The property row under the description. */
  properties?: React.ReactNode;
  /** Rarely: an action that belongs to the title (most go in the header). */
  actions?: React.ReactNode;
  /**
   * A small Open Peeps scene (#204) beside the title from 768 px, at most
   * 112 px tall. Decorative; hidden on phones.
   */
  illustration?: React.ReactNode;
  className?: string;
}) {
  const body = (
    <div data-slot="page-title" className={cn("flex min-w-0 flex-col gap-2", illustration ? "flex-1" : className)}>
      {icon ? (
        <span aria-hidden className="text-muted-foreground mb-1 grid size-8 place-items-center text-2xl [&_svg]:size-7">
          {icon}
        </span>
      ) : null}
      {eyebrow ? <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{eyebrow}</p> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-foreground min-w-0 text-[28px] leading-[1.15] font-semibold tracking-tight [overflow-wrap:anywhere]">
          {title}
        </h1>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {description ? <div className="text-muted-foreground max-w-prose text-sm">{description}</div> : null}
      {properties ? <div className="pt-2">{properties}</div> : null}
    </div>
  );
  if (!illustration) return body;
  return (
    <div className={cn("flex items-end gap-6", className)}>
      {body}
      <div aria-hidden className="hidden h-28 w-40 shrink-0 items-end justify-center md:flex [&_svg]:h-full [&_svg]:w-auto">
        {illustration}
      </div>
    </div>
  );
}

/**
 * A framed page that only has a sentence to say: not found, no access, no
 * profile yet. Same header and width rules as every other page.
 */
export function PageMessage({
  breadcrumb, title, children,
}: {
  breadcrumb: Crumb[];
  title?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <PageFrame type="settings" breadcrumb={breadcrumb}>
      {title ? <PageTitle title={title} /> : null}
      {/* Boxed, so a page with nothing to show still reads as a page, not a stray line. */}
      <div role="status" className="border-border text-muted-foreground rounded-lg border border-dashed px-6 py-10 text-center text-sm">
        {children}
      </div>
    </PageFrame>
  );
}

/** A titled block of the page; sections sit 32 px apart (the frame's gap). */
export function PageSection({
  title, description, actions, children, className, id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section id={id} aria-labelledby={title ? headingId : undefined} className={cn("flex flex-col gap-3", className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            {title ? (
              <h2 id={headingId} className="text-foreground text-base font-semibold">
                {title}
              </h2>
            ) : null}
            {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
