/**
 * 401, for pages that call unauthorized() from next/navigation. Needs
 * `experimental.authInterrupts` in next.config (A's file); until then
 * nothing renders this.
 */

import Link from "next/link";

import { ErrorFrame, ErrorScreen } from "@/components/error-screen";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Sign in" };

export default function Unauthorized() {
  return (
    <ErrorFrame>
      <ErrorScreen
        kind="401"
        actions={
          <>
            <Button asChild>
              <Link href="/auth">Sign in</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Go to the home page</Link>
            </Button>
          </>
        }
      />
    </ErrorFrame>
  );
}
