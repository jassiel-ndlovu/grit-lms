"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Sonner toaster. Mount once at the layout root inside <body>.
 * Theme is currently fixed to "system" — wire to next-themes once dark
 * mode toggle is added.
 */
function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
