"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { WriteGuard } from "@/components/shell/workspace-access";
import { Button } from "@/components/ui/button";
import { clearStudyFlagAction } from "@/features/study/actions";

/** A tutor has followed up on a flagged chat. */
export function ClearFlagButton({ chatId }: { chatId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function clear() {
    setPending(true);
    const r = await clearStudyFlagAction({ chatId }).catch(() => null);
    setPending(false);
    if (!r?.data) {
      toast.error(r?.serverError ?? "That didn't work. Try again.");
      return;
    }
    toast.success("Flag cleared.");
    router.refresh();
  }

  return (
    <WriteGuard label="Clear flag">
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => void clear()}>
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Check aria-hidden className="size-4" />}
        Clear flag
      </Button>
    </WriteGuard>
  );
}
