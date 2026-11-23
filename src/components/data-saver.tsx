"use client";

/**
 * Data saver on screen (lib/data-saver.ts). The dashboard layout passes the
 * device's choice and the browser's Save-Data hint; the wrappers below
 * hold back images, videos and cover photos while it's on. Without the
 * provider (pages outside the dashboard) everything loads as usual.
 */

import * as React from "react";
import Image from "next/image";
import { ImageIcon, Play, WifiOff } from "lucide-react";

import { useOnline } from "@/components/offline/use-online";

import { dataSaverCookie, dataSaverOn, fileNameOf, type DataSaverChoice } from "@/lib/data-saver";
import { cn } from "@/lib/utils";

type DataSaverState = {
  on: boolean;
  choice: DataSaverChoice;
  /** The browser asked to save data. */
  hint: boolean;
  setChoice: (c: DataSaverChoice) => void;
};

const Ctx = React.createContext<DataSaverState>({ on: false, choice: "auto", hint: false, setChoice: () => {} });

export function DataSaverProvider({
  choice: initialChoice,
  hint,
  children,
}: {
  choice: DataSaverChoice;
  hint: boolean;
  children: React.ReactNode;
}) {
  const [choice, setChoiceState] = React.useState(initialChoice);
  const setChoice = React.useCallback((c: DataSaverChoice) => {
    document.cookie = dataSaverCookie(c);
    setChoiceState(c);
  }, []);
  const value = React.useMemo(() => ({ on: dataSaverOn(choice, hint), choice, hint, setChoice }), [choice, hint, setChoice]);
  // Keeps StockPhoto (CSS, no provider needed) in step with the setting.
  React.useEffect(() => {
    if (value.on) document.documentElement.dataset.saver = "on";
    else delete document.documentElement.dataset.saver;
  }, [value.on]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useDataSaver = () => React.useContext(Ctx);

const PLACEHOLDER =
  "border-border text-muted-foreground hover:text-foreground hover:border-input focus-visible:ring-ring flex w-full items-center justify-center gap-2 rounded-md border border-dashed p-4 text-sm outline-none focus-visible:ring-2";

/** A lesson image: a "Show image" button while data saver is on. */
export function SaverImage({
  src,
  alt,
  title,
  className,
  style,
}: {
  src: string;
  alt: string;
  title?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { on } = useDataSaver();
  const online = useOnline();
  const [shown, setShown] = React.useState(false);
  const [missing, setMissing] = React.useState(false);
  const ref = React.useRef<HTMLImageElement>(null);
  // A saved page's image can fail before React listens for it.
  React.useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth === 0) setMissing(true);
  }, [shown, src]);
  const name = alt.trim() || fileNameOf(src) || "image";
  // Offline the browser may still hold the image, so it's tried first.
  if (missing && !online) return <NeedsConnection className="my-4" style={{ maxWidth: style?.maxWidth }}>Image needs a connection: {name}</NeedsConnection>;
  if (on && !shown) {
    return (
      <button type="button" onClick={() => setShown(true)} className={cn(PLACEHOLDER, "my-4")} style={{ maxWidth: style?.maxWidth }}>
        <ImageIcon aria-hidden className="size-4 shrink-0" />
        <span className="min-w-0 [overflow-wrap:anywhere]">
          Show image: {name}
        </span>
      </button>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- Blob and external URLs, sized by the author
  return <img ref={ref} src={src} alt={alt} title={title} loading="lazy" draggable={false} className={className} style={style} onError={() => setMissing(true)} onLoad={() => setMissing(false)} />;
}

/** In a saved lesson, where something isn't kept on the device. */
function NeedsConnection({ className, style, children }: { className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <span
      className={cn("border-border text-muted-foreground flex w-full items-center justify-center gap-2 rounded-md border border-dashed p-4 text-sm", className)}
      style={style}
    >
      <WifiOff aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </span>
  );
}

/** A video embed: "Play video" first while data saver is on (an embed loads megabytes before you press play). */
export function SaverEmbed({ label, children }: { label: string; children: React.ReactNode }) {
  const { on } = useDataSaver();
  const online = useOnline();
  const [shown, setShown] = React.useState(false);
  if (!online && !shown) return <NeedsConnection className="absolute inset-0 border-0">Video needs a connection</NeedsConnection>;
  if (on && !shown) {
    return (
      <button type="button" onClick={() => setShown(true)} className={cn(PLACEHOLDER, "absolute inset-0 border-0")}>
        <Play aria-hidden className="size-4" />
        Load {label} (uses data)
      </button>
    );
  }
  return <>{children}</>;
}

/** A course cover photo, left out while data saver is on (the box keeps its colour). */
export function SaverCover(props: React.ComponentProps<typeof Image>) {
  const { on } = useDataSaver();
  if (on) return null;
  // eslint-disable-next-line jsx-a11y/alt-text -- alt comes through props
  return <Image {...props} />;
}
