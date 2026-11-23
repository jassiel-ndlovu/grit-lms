/**
 * 404 for any address the app doesn't have, and for notFound() outside the
 * dashboard. Inside the dashboard, dashboard/not-found.tsx keeps the shell.
 */

import Link from "next/link";
import { House } from "lucide-react";

import { BackButton, MissingPath } from "@/components/error-screen-client";
import { ErrorFrame, ErrorScreen } from "@/components/error-screen";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <ErrorFrame>
      <ErrorScreen
        kind="404"
        detail={<MissingPath />}
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
