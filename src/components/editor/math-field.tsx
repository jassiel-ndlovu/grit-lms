"use client";

/**
 * MathField: visual maths input with MathLive (B research 02; Plus service
 * `math-input`). Type maths the way it looks (fractions, powers, roots),
 * or use MathLive's on-screen maths keyboard, and get TeX out.
 *
 *   <MathField label="Formula" value={latex} onChange={setLatex} onDone={leave} />
 *
 * - MathLive (about 250 KB gzip) is imported when the first field mounts,
 *   so pages without one never load it. Until then a plain TeX box stands in.
 * - Its KaTeX fonts come from mathlive/fonts.css, which Next bundles; no CDN.
 * - Keypress sounds are off.
 * - Enter (single-line fields) and Escape call onDone.
 */

import * as React from "react";
import "mathlive/fonts.css";

import { cn } from "@/lib/utils";

type MathfieldLike = HTMLElement & {
  value: string;
  smartMode: boolean;
  mathVirtualKeyboardPolicy: "auto" | "manual" | "sandboxed";
  getValue(format?: "latex"): string;
  setValue(value: string, options?: { silenceNotifications?: boolean }): void;
};

let loading: Promise<void> | null = null;
function loadMathLive(): Promise<void> {
  loading ??= import("mathlive").then(({ MathfieldElement }) => {
    MathfieldElement.fontsDirectory = null; // fonts.css loads them
    MathfieldElement.soundsDirectory = null; // no keypress sounds
  });
  return loading;
}

export interface MathFieldProps {
  /** Accessible name. */
  label: string;
  /** TeX. */
  value: string;
  onChange: (latex: string) => void;
  /** Enter (single line) or Escape: back to the surrounding text. */
  onDone?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  /** Allow line breaks (aligned block maths). */
  multiline?: boolean;
  className?: string;
}

export function MathField({ label, value, onChange, onDone, onFocus, onBlur, autoFocus, multiline, className }: MathFieldProps) {
  const [ready, setReady] = React.useState(false);
  // The element's text is only its starting value; later changes go through setValue.
  const [initial] = React.useState(value);
  const ref = React.useRef<MathfieldLike | null>(null);
  const latest = React.useRef({ onChange, onDone, multiline });
  latest.current = { onChange, onDone, multiline };

  React.useEffect(() => {
    let live = true;
    loadMathLive().then(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);

  // Set up the element once it exists: events, options and focus.
  React.useEffect(() => {
    const mf = ref.current;
    if (!ready || !mf) return;
    mf.mathVirtualKeyboardPolicy = "auto"; // shows on touch devices; the toggle shows it elsewhere
    mf.smartMode = false; // keep typed words as text-free maths, as TeX would
    const onInput = () => latest.current.onChange(mf.getValue("latex"));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || (e.key === "Enter" && !latest.current.multiline)) {
        e.preventDefault();
        latest.current.onDone?.();
      }
    };
    mf.addEventListener("input", onInput);
    mf.addEventListener("keydown", onKey, { capture: true });
    // Tiptap's focus() (run by the insert command) refocuses the editor a
    // moment later; take focus after that, unless the person moved on.
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (autoFocus) {
      timer = setTimeout(() => {
        const active = document.activeElement;
        if (!active || active === document.body || active.closest(".ProseMirror")) mf.focus();
      }, 80);
    }
    return () => {
      clearTimeout(timer);
      mf.removeEventListener("input", onInput);
      mf.removeEventListener("keydown", onKey, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Outside changes (switching from the TeX box) reach the field.
  React.useEffect(() => {
    const mf = ref.current;
    if (ready && mf && mf.getValue("latex") !== value) mf.setValue(value, { silenceNotifications: true });
  }, [ready, value]);

  const box = cn(
    "border-input bg-background focus-within:ring-ring/50 block w-full min-w-48 rounded-md border px-2 py-1 text-base focus-within:ring-2",
    className,
  );

  if (!ready) {
    return (
      <textarea
        aria-label={label}
        value={value}
        rows={1}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        className={cn(box, "resize-none font-mono text-xs")}
      />
    );
  }

  return React.createElement("math-field", { ref, "aria-label": label, className: box, onFocus, onBlur }, initial);
}
