"use client";

/**
 * VideoUrlList — controlled editor for an array of video URLs.
 *
 * Stays simple on purpose: each row is an `<input type="url">` plus a
 * delete button. The lesson form supplies the array via RHF; rendering
 * happens here. YouTube parsing happens at view time inside LessonContent —
 * this component only stores raw URLs.
 */

import * as React from "react";
import { Plus, Trash2, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface VideoUrlListProps {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
}

export function VideoUrlList({ value, onChange, className }: VideoUrlListProps) {
  function update(index: number, next: string) {
    onChange(value.map((v, i) => (i === index ? next : v)));
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...value, ""]);
  }

  return (
    <div className={cn("space-y-2", className)}>
      {value.length === 0 ? (
        <p className="text-muted-foreground text-xs">No videos yet</p>
      ) : (
        <ul className="space-y-2">
          {value.map((url, i) => (
            <li key={i} className="flex items-center gap-2">
              <Video className="text-muted-foreground size-4 shrink-0" />
              <Input
                type="url"
                value={url}
                onChange={(e) => update(i, e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => remove(i)}
                aria-label={`Remove video ${i + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="size-3" /> Add video
      </Button>
    </div>
  );
}
