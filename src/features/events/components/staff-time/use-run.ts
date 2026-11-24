"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Result<T> = { data?: T; serverError?: string } | null | undefined;

/**
 * Runs one of A's staff actions: returns its data, or null after showing why
 * not (in a toast, unless `onError` takes the message). Refreshes the page
 * when it worked.
 */
export function useRun() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function run<T>(call: () => Promise<Result<T>>, o: { done?: string; onError?: (message: string) => void } = {}): Promise<T | null> {
    setPending(true);
    const r = await call().catch(() => null);
    setPending(false);
    if (r?.data === undefined) {
      (o.onError ?? toast.error)(r?.serverError ?? "That didn't work. Try again.");
      return null;
    }
    if (o.done) toast.success(o.done);
    router.refresh();
    return r.data;
  }

  return { pending, run };
}
