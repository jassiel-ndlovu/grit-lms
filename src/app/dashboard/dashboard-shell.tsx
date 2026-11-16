"use client"

import { ReactNode, useState } from 'react';
import Header from './models/header';
import Nav from './models/nav';
import { LegacyProviders } from './legacy-providers';

/*
 * Layout notes:
 *   - The document (window) is the only vertical scroller. `main` used to be
 *     its own `h-screen overflow-y-auto` box, which Next's route-change
 *     scroll reset doesn't handle: it resets `<html>` (a no-op there) and
 *     skips scrolling when the new page's first element is already in the
 *     viewport, so a short page kept the long page's offset.
 *   - The sidebar is sticky beside the content on lg+, and a drawer opened
 *     from the header below that.
 *   - No page footer — its content lives at the foot of the nav.
 *   - With REVAMP_UI the layout renders AppShell instead (components/shell).
 */
export default function DashboardShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <LegacyProviders>
    <div className="flex min-h-screen bg-background">
      <Nav mobileOpen={menuOpen} onMobileOpenChange={setMenuOpen} />

      {/* min-w-0 lets wide children (tables, code) scroll inside themselves
          instead of widening the page past the viewport. */}
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        <Header onOpenMenu={() => setMenuOpen(true)} />
          <div className="flex-1 pb-12">
            {children}
          </div>
      </main>
    </div>
    </LegacyProviders>
  );
}
