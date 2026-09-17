"use client";

/**
 * WeightsEditor — tutor sets each assessment's share of the final mark.
 *
 * Weighting is opt-in. A row left on "By points" inherits a share of
 * whatever the explicit weights leave over, proportional to the
 * assessment's own marks — which, when nothing is weighted, is just a
 * normal marks total. Clearing an input puts a row back to that default.
 *
 * The running total is computed here so the tutor sees the plan add up (or
 * not) before saving; the same maths runs server-side for display.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import { setAssessmentWeights } from "../actions";
import { buildWeightPlan, type WeightedAssessment } from "../lib/weighting";

export interface WeightsEditorProps {
  courseId: string;
  assessments: WeightedAssessment[];
}

export function WeightsEditor({ courseId, assessments }: WeightsEditorProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  // Inputs are kept as strings so an empty field reads as "by points"
  // rather than collapsing to 0 the moment the tutor clears it.
  const initial = React.useMemo(
    () =>
      Object.fromEntries(
        assessments.map((a) => [a.id, a.weight == null ? "" : String(a.weight)]),
      ) as Record<string, string>,
    [assessments],
  );
  const [values, setValues] = React.useState<Record<string, string>>(initial);

  const dirty = React.useMemo(
    () => assessments.some((a) => (values[a.id] ?? "") !== (initial[a.id] ?? "")),
    [assessments, values, initial],
  );

  // Live preview of the plan as typed.
  const plan = React.useMemo(() => {
    const preview: WeightedAssessment[] = assessments.map((a) => {
      const raw = (values[a.id] ?? "").trim();
      const n = raw === "" ? null : Number(raw);
      return {
        ...a,
        weight: n != null && Number.isFinite(n) ? n : null,
      };
    });
    return buildWeightPlan(preview);
  }, [assessments, values]);

  async function onSave() {
    const invalid = assessments.find((a) => {
      const raw = (values[a.id] ?? "").trim();
      if (raw === "") return false;
      const n = Number(raw);
      return !Number.isFinite(n) || n < 0 || n > 100;
    });
    if (invalid) {
      toast.error(`"${invalid.title}" needs a weight between 0 and 100.`);
      return;
    }

    setPending(true);
    try {
      const res = await setAssessmentWeights({
        courseId,
        weights: assessments.map((a) => {
          const raw = (values[a.id] ?? "").trim();
          return { key: a.id, weight: raw === "" ? null : Number(raw) };
        }),
      });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      if (res?.validationErrors) {
        toast.error("Some weights were rejected. Check the values and retry.");
        return;
      }
      toast.success("Weights saved.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  if (assessments.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground text-sm">
          This course has no tests or assignments yet, so there is nothing to
          weight.
        </p>
      </Card>
    );
  }

  const ok = plan.warning == null;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="font-display text-lg leading-tight tracking-tight text-foreground">
            Assessment weights
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Leave a row blank to weight it by its marks. Explicit weights are
            taken first; whatever is left over is shared among the rest.
          </p>
        </div>
        <Badge
          variant={ok ? "brand" : "secondary"}
          className="tabular-nums shrink-0"
        >
          {ok ? (
            <CheckCircle2 className="mr-1 size-3" />
          ) : (
            <AlertTriangle className="mr-1 size-3" />
          )}
          {plan.allocated}% allocated
        </Badge>
      </div>
      <Separator />

      <ul className="divide-border divide-y">
        {plan.assessments.map((a) => {
          const raw = (values[a.id] ?? "").trim();
          return (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {a.title}
                </p>
                <p className="text-muted-foreground text-xs">
                  {a.kind === "test" ? "Test" : "Assignment"} ·{" "}
                  {a.totalPoints} {a.totalPoints === 1 ? "mark" : "marks"} · due{" "}
                  {a.dueDate.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span
                  className="text-muted-foreground w-28 text-right text-xs tabular-nums"
                  title="Share of the final mark this row actually carries"
                >
                  {a.explicit ? "set" : "by points"} ·{" "}
                  {Math.round(a.effectiveWeight * 10) / 10}%
                </span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    inputMode="decimal"
                    placeholder="auto"
                    className="w-24 tabular-nums"
                    value={values[a.id] ?? ""}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [a.id]: e.target.value }))
                    }
                    aria-label={`Weight for ${a.title}`}
                  />
                  <span className="text-muted-foreground text-sm">%</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={raw === ""}
                  onClick={() =>
                    setValues((prev) => ({ ...prev, [a.id]: "" }))
                  }
                  aria-label={`Reset ${a.title} to weight by points`}
                  title="Back to weighting by points"
                >
                  <RotateCcw className="size-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <p
          className={
            ok
              ? "text-muted-foreground text-xs"
              : "text-destructive text-xs"
          }
        >
          {plan.warning ??
            "Weights add up to 100%. Students are measured against the assessments that have actually been graded."}
        </p>
        <Button onClick={onSave} disabled={pending || !dirty} variant="brand">
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save weights
        </Button>
      </div>
    </Card>
  );
}
