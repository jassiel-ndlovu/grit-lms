/**
 * 403, for pages that call forbidden() from next/navigation. Needs
 * `experimental.authInterrupts` in next.config (A's file); until then
 * nothing renders this.
 */

import Link from "next/link";
import { House } from "lucide-react";

import { BackButton } from "@/components/error-screen-client";
import { ErrorFrame, ErrorScreen } from "@/components/error-screen";
import { Button } from "@/components/ui/button";

export const metadata = { title: "No access" };

export default function Forbidden() {
  return (
    <ErrorFrame>
      <ErrorScreen
        kind="403"
        actions={
          <>
            <Button asChild>
              <Link href="/dashboard">
                <House aria-hidden className="size-4" />
                Go to your dashboard
              </Link>
            </Button>
            <BackButton />
          </>
        }
      />
    </ErrorFrame>
  );
}
