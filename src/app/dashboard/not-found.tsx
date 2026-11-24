/**
 * 404 inside the dashboard (a page called notFound(): a course, test or
 * invoice that doesn't exist or isn't yours), shown in the shell so the
 * sidebar stays.
 */

import Link from "next/link";
import { House } from "lucide-react";

import { BackButton, MissingPath } from "@/components/error-screen-client";
import { ErrorScreen } from "@/components/error-screen";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function DashboardNotFound() {
  return (
    <ErrorScreen
      kind="404"
      description="It may have been moved or deleted, or it belongs to an organisation or course you're not part of. Check the address, or pick a page from the menu."
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
  );
}
