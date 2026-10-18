"use client";

/**
 * LessonTreeTools — the manage-lessons sidebar's "Numbering" and
 * "Rearrange" buttons. Both write straight to the server (there's no
 * surrounding form to hold them), then refresh the RSC page.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LabelSchemeDialog } from "@/components/label-scheme-dialog";
import { TreeReorderDialog, type ReorderNode } from "@/components/tree-reorder-dialog";
import { isDefaultScheme, normalizeScheme } from "@/lib/enum-labels";

import { reorderLessons, updateLessonLabelScheme } from "../actions";

export interface LessonTreeToolsProps {
  courseId: string;
  labelScheme: string[];
  tree: ReorderNode[];
  titles: Record<string, string>;
}

export function LessonTreeTools({ courseId, labelScheme, tree, titles }: LessonTreeToolsProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const scheme = normalizeScheme(labelScheme);

  async function saveScheme(next: string[]) {
    const res = await updateLessonLabelScheme({
      courseId,
      scheme: isDefaultScheme(next) ? [] : next,
    });
    if (res?.serverError || res?.validationErrors) {
      toast.error(res.serverError ?? "Numbering was rejected.");
      return;
    }
    toast.success("Lesson numbering updated.");
    router.refresh();
  }

  async function saveOrder(next: ReorderNode[]) {
    const t = toast.loading("Saving lesson order…");
    const res = await reorderLessons({ courseId, tree: next });
    if (res?.serverError || res?.validationErrors) {
      toast.error(res.serverError ?? "Order was rejected.", { id: t });
      return;
    }
    toast.success("Lesson order saved.", { id: t });
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <LabelSchemeDialog scheme={scheme} onChange={saveScheme} noun="lesson" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={tree.length === 0}
        onClick={() => setOpen(true)}
      >
        <ArrowUpDown className="size-3.5" /> Rearrange
      </Button>
      <TreeReorderDialog
        open={open}
        onOpenChange={setOpen}
        title="Rearrange lessons"
        tree={tree}
        scheme={scheme}
        tooltip={(id) => titles[id]}
        onApply={saveOrder}
      />
    </div>
  );
}
