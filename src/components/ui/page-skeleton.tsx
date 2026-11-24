import { NexusLoader } from "@/components/ui/nexus";
import { Skeleton } from "@/components/ui/skeleton";
import { SignatureStrip } from "@/components/shell/signature-strip";
import { DEFAULT_WIDTH, FRAME_BODY_CLASS, FRAME_WIDTH_CLASS, HEADER_TOP_CLASS, type PageType } from "@/lib/ui-layout";
import { cn } from "@/lib/utils";

/**
 * What a page looks like while it loads (loading.tsx): its header, title
 * and the outline of what is coming, in the same frame, so nothing jumps
 * when the page arrives. Screen readers hear "Loading" once.
 */
export type SkeletonKind = "home" | "list" | "record" | "form" | "grid" | "calendar";

const TYPE: Record<SkeletonKind, PageType> = { home: "home", list: "list", record: "record", form: "settings", grid: "list", calendar: "list" };

export function PageSkeleton({ kind = "list" }: { kind?: SkeletonKind }) {
  return (
    <div data-slot="page-skeleton">
      <span role="status" className="sr-only">Loading</span>
      <div aria-hidden>
        <div className={cn("bg-background/95 border-border sticky z-20 flex h-(--header-primary) items-center gap-3 border-b px-4", HEADER_TOP_CLASS)}>
          <NexusLoader size={20} label={null} />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-7 w-24" />
          <SignatureStrip />
        </div>
        <div className={cn(FRAME_BODY_CLASS, FRAME_WIDTH_CLASS[DEFAULT_WIDTH[TYPE[kind]]])}>
          <div className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-2/3 max-w-sm" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Body kind={kind} />
        </div>
      </div>
    </div>
  );
}

function Rows({ count }: { count: number }) {
  return (
    <div className="border-border divide-border divide-y rounded-lg border">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={cn("h-4", ["w-1/2", "w-2/5", "w-3/5"][i % 3])} />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-5 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function Body({ kind }: { kind: SkeletonKind }) {
  switch (kind) {
    case "home":
      return (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <Rows count={5} />
          <div className="space-y-4">
            <Skeleton className="h-44 rounded-lg" />
            <Skeleton className="h-32 rounded-lg" />
          </div>
        </div>
      );
    case "record":
      return (
        <>
          <div className="grid max-w-xl grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
          <Skeleton className="h-40 rounded-lg" />
          <Rows count={4} />
        </>
      );
    case "form":
      return (
        <div className="space-y-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-9" />
            </div>
          ))}
          <Skeleton className="h-9 w-32" />
        </div>
      );
    case "grid":
      return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      );
    case "calendar":
      return (
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className="h-14 rounded-sm sm:h-24" />)}
        </div>
      );
    default:
      return <Rows count={8} />;
  }
}

/** The test runner: no header and no outline, so nothing hints at the questions. */
export function RunnerLoading() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div role="status" className="flex flex-col items-center gap-4">
        <NexusLoader size={56} label={null} />
        <p className="text-muted-foreground text-sm">Getting your test ready</p>
      </div>
    </div>
  );
}
