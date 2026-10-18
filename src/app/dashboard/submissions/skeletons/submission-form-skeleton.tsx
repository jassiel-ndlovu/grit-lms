import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the assignment create/edit page — mirrors its layout. */
export default function SubmissionFormSkeleton() {
  return (
    <div className="bg-background min-h-screen">
      <div className="bg-card border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-6">
          <Skeleton className="h-5 w-36" />
        </div>
      </div>
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        {[0, 1, 2].map((i) => (
          <Card key={i} className="space-y-5 p-6">
            <Skeleton className="h-5 w-32" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-20 w-full" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
