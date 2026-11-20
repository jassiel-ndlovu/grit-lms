/**
 * 403, for pages that call forbidden() from next/navigation. Needs
 * `experimental.authInterrupts` in next.config (A's file); until then
 * nothing renders this.
 */

import Link from "next/link";

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
              <Link href="/dashboard">Go to your dashboard</Link>
            </Button>
            <BackButton />
          </>
        }
      />
    </ErrorFrame>
  );
}
