/**
 * Dashboard footer — Inkwell identity (Chapter 5).
 *
 * The legacy footer was a four-column dark-mode marketing block. For a
 * logged-in dashboard we want something quieter: a single-row strip with
 * the wordmark, contact, and a handful of utility links. No gradients,
 * no social icons, no fictional feature badges.
 */

"use client";

import React from "react";
import Link from "next/link";
import { ArrowUp, Mail, MapPin, Phone } from "lucide-react";

import { APP_NAME, APP_LEGAL_NAME, APP_CONTACT } from "@/lib/branding";

const UTILITY_LINKS = [
  { href: "/dashboard/help", label: "Help" },
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/terms-of-service", label: "Terms" },
] as const;

export default function DashboardFooter() {
  const year = new Date().getFullYear();

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <footer className="relative border-t border-border bg-card/60">
      {/* Floating "back to top" — small, neutral, terracotta on hover. */}
      <button
        type="button"
        onClick={scrollToTop}
        className="absolute -top-5 right-6 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-brand-terracotta hover:text-brand-terracotta"
        title="Back to top"
        aria-label="Back to top"
      >
        <ArrowUp className="h-4 w-4" />
      </button>

      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 md:flex-row md:items-center md:justify-between">
        {/* Wordmark + tagline. */}
        <div className="flex items-baseline gap-3">
          <p className="font-display text-lg leading-none tracking-tight text-foreground">
            {APP_NAME}
          </p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Learning, well composed.
          </p>
        </div>

        {/* Contact strip — terse, single line on desktop. */}
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" aria-hidden />
            <a
              href={`mailto:${APP_CONTACT.email}`}
              className="transition-colors hover:text-foreground"
            >
              {APP_CONTACT.email}
            </a>
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" aria-hidden />
            <span>{APP_CONTACT.phone}</span>
          </li>
          <li className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            <span>{APP_CONTACT.location}</span>
          </li>
        </ul>

        {/* Utility links + copyright. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {UTILITY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <span className="text-muted-foreground/70">
            &copy; {year} {APP_LEGAL_NAME}
          </span>
        </div>
      </div>
    </footer>
  );
}
