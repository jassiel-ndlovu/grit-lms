/**
 * The frame for the public help pages (/support): the site header, a
 * reading-width column and the footer. Server component.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { APP_NAME } from "@/lib/branding";

export function PublicHelpFrame({ title, lead, children }: { title: string; lead?: string; children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-border border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark />
            <span className="text-foreground text-lg font-semibold tracking-tight">{APP_NAME}</span>
          </Link>
          <Link href="/" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm">
            <ArrowLeft aria-hidden className="size-4" /> Back to home
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-foreground text-3xl font-semibold tracking-tight">{title}</h1>
          {lead ? <p className="text-muted-foreground max-w-prose text-sm">{lead}</p> : null}
        </div>
        {children}
      </main>
      <footer className="text-muted-foreground border-border border-t px-4 py-6 text-center text-xs">
        © {new Date().getFullYear()} {APP_NAME} ·{" "}
        <Link href="/privacy-policy" className="hover:text-foreground underline underline-offset-2">Privacy</Link> ·{" "}
        <Link href="/terms-of-service" className="hover:text-foreground underline underline-offset-2">Terms</Link>
      </footer>
    </div>
  );
}
