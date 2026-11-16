"use client";

import * as React from "react";

import { RichEditor } from "@/components/editor/rich-editor";
import { docToMarkdown } from "@/lib/content/markdown";
import { validateDoc } from "@/lib/content/schema";
import type { StoredContent } from "@/lib/content/value";

export function EditorDemo({ sample }: { sample: string }) {
  const [value, setValue] = React.useState<StoredContent | null>(null);
  // What the server does on save (editor.md rules 1-2).
  const valid = value ? validateDoc(value.doc) : null;
  const markdown = valid ? docToMarkdown(valid) : "";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <RichEditor label="Lesson body" fallbackMarkdown={sample} onChange={setValue} name="body" />
      <div className="min-w-0 space-y-4 text-sm">
        <p data-testid="validity">
          {value === null ? "Edit to see the output." : valid ? "validateDoc: passes" : "validateDoc: FAILS"}
        </p>
        <details open>
          <summary className="cursor-pointer font-medium">Derived markdown</summary>
          <pre data-testid="markdown" className="bg-muted mt-2 overflow-x-auto rounded-md p-3 font-mono text-xs">{markdown}</pre>
        </details>
        <details>
          <summary className="cursor-pointer font-medium">Stored JSON</summary>
          <pre className="bg-muted mt-2 max-h-96 overflow-auto rounded-md p-3 font-mono text-xs">
            {value ? JSON.stringify(value, null, 2) : ""}
          </pre>
        </details>
      </div>
    </div>
  );
}
