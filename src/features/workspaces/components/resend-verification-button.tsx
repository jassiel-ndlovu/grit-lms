"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { requestEmailVerification } from "@/features/users/actions";

/** Sends a new verification link (throttled to one a minute on the server). */
export function ResendVerificationButton({ label }: { label: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await requestEmailVerification({});
          const data = res?.data;
          if (data?.ok) toast.success("Verification link sent. Check your inbox.");
          else toast.error(data && !data.ok ? data.error : "Couldn't send the link. Try again.");
        })
      }
    >
      {pending ? "Sending…" : label}
    </Button>
  );
}
