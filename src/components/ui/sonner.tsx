"use client";

import * as React from "react";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

import { NexusCorner, NexusLoader } from "@/components/ui/nexus";

/**
 * The app's toasts, mounted once in the root layout. The tinted background
 * and coloured border come from src/app/nexus.css, one tone per state. The
 * state's symbol sits in the circle, so it never rests on colour alone.
 */
function State({ seed, children }: { seed: string; children: React.ReactNode }) {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        <NexusCorner seed={seed} size={64} className="z-0" />
      </span>
      <span className="text-popover relative grid size-6 shrink-0 place-items-center rounded-full bg-(--tone) [&_svg]:m-0 [&_svg]:size-3.5">
        {children}
      </span>
    </>
  );
}

const ICONS: ToasterProps["icons"] = {
  success: <State seed="toast-success"><Check aria-hidden strokeWidth={3} /></State>,
  info: <State seed="toast-info"><Info aria-hidden strokeWidth={2.5} /></State>,
  warning: <State seed="toast-warning"><TriangleAlert aria-hidden strokeWidth={2.5} /></State>,
  error: <State seed="toast-error"><X aria-hidden strokeWidth={3} /></State>,
  loading: <NexusLoader size={24} label={null} />,
};

function Toaster(props: ToasterProps) {
  return <Sonner theme="system" className="toaster group" icons={ICONS} {...props} />;
}

export { Toaster };
