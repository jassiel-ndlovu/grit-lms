"use client";

/**
 * ExportTestButton — client button that calls the exportTestJson action,
 * receives the serialized JSON, and triggers a browser download.
 *
 * Rendered inside TutorTestActions and (optionally) on the test edit page.
 */

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";

import { exportTestJson } from "../actions";

export interface ExportTestButtonProps {
  testId: string;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}

export function ExportTestButton({
  testId,
  label = "Export JSON",
  variant = "outline",
  size = "sm",
  className,
}: ExportTestButtonProps) {
  const [pending, setPending] = React.useState(false);

  async function onClick() {
    setPending(true);
    try {
      const result = await exportTestJson({ id: testId });
      if (result?.serverError) throw new Error(result.serverError);
      const data = result?.data;
      if (!data) throw new Error("Export returned no payload");

      // Trigger a browser download without leaving the page.
      const blob = new Blob([data.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Test exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={pending}
      className={className}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {label}
    </Button>
  );
}
