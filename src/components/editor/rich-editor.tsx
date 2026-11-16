"use client";

/**
 * RichEditor — the rich-text and maths editor (contracts/editor.md).
 *
 *   <RichEditor label="Lesson body" value={lesson.descriptionJson}
 *     fallbackMarkdown={lesson.description} name="body" onChange={...} />
 *
 * - Loads the stored envelope, or converts the markdown column when there
 *   is no JSON yet (lazy conversion).
 * - Emits the envelope on every change. The server validates it with
 *   validateDoc and derives the markdown copy itself (editor.md rules 1-2);
 *   the editor never sends markdown.
 * - `name` adds a hidden input holding the envelope as JSON, for forms that
 *   post to a server action.
 * - Needs a MathProvider above it (the dashboard layout mounts one).
 *
 * The schema is contentExtensions() plus editing-only extensions; `features`
 * hides commands but never removes nodes, so any stored document loads.
 */

import * as React from "react";
import type { AnyExtension, JSONContent } from "@tiptap/core";
import { Dropcursor, Gapcursor, Placeholder, TrailingNode, UndoRedo } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";

import { contentExtensions } from "@/lib/content/extensions";
import { markdownToDoc } from "@/lib/content/markdown";
import { validateDoc } from "@/lib/content/schema";
import { readStoredContent, toStoredContent, type StoredContent } from "@/lib/content/value";
import { cn } from "@/lib/utils";

import "@/components/content/rich-content.css";
import "./editor.css";
import { DEFAULT_FEATURES, commandsFor, type EditorFeatures } from "./commands";
import { EditorBlockMath, EditorInlineMath } from "./math-views";
import { SlashMenu, SlashMenuExtension, type SlashState } from "./slash-menu";
import { EditorToolbar } from "./toolbar";

export interface RichEditorProps {
  /** Accessible name, e.g. "Lesson body". */
  label: string;
  /** The stored `xJson` value. */
  value?: unknown;
  /** The markdown column, used when there is no JSON yet. */
  fallbackMarkdown?: string | null;
  onChange?: (value: StoredContent) => void;
  /** Adds a hidden input with the envelope as JSON. */
  name?: string;
  features?: Partial<EditorFeatures>;
  placeholder?: string;
  editable?: boolean;
  className?: string;
}

const EMPTY: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

function initialDoc(value: unknown, fallbackMarkdown: string | null | undefined): JSONContent {
  const stored = readStoredContent(value);
  const fromJson = stored ? validateDoc(stored.doc) : null;
  if (fromJson) return fromJson;
  if (fallbackMarkdown) return validateDoc(markdownToDoc(fallbackMarkdown)) ?? EMPTY;
  return EMPTY;
}

export function RichEditor({
  label, value, fallbackMarkdown, onChange, name, features: featureProp, placeholder = "Type / for blocks, $ for maths",
  editable = true, className,
}: RichEditorProps) {
  const features = React.useMemo(() => ({ ...DEFAULT_FEATURES, ...featureProp }), [featureProp]);
  const [slash, setSlash] = React.useState<SlashState | null>(null);
  const [stored, setStored] = React.useState<StoredContent | null>(null);
  const listId = React.useId();

  // The editor is built once; callbacks reach the latest props through refs.
  const latest = React.useRef({ features, onChange });
  latest.current = { features, onChange };

  const editor = useEditor({
    immediatelyRender: false, // server render would mismatch; the editor mounts on the client
    content: initialDoc(value, fallbackMarkdown),
    editable,
    extensions: [
      ...contentExtensions().map((e): AnyExtension =>
        e.name === "inlineMath" ? EditorInlineMath : e.name === "blockMath" ? EditorBlockMath : e,
      ),
      UndoRedo,
      Dropcursor,
      Gapcursor,
      TrailingNode, // always a paragraph after a final table or maths block
      Placeholder.configure({ placeholder }),
      SlashMenuExtension.configure({
        commands: () => commandsFor(latest.current.features),
        onState: setSlash,
      }),
    ],
    editorProps: {
      attributes: {
        "data-slot": "rich-content",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        class: "rich-editor-surface min-h-32 px-4 py-3 text-sm outline-none",
      },
    },
    onUpdate: ({ editor: e }) => {
      const next = toStoredContent(e.getJSON());
      setStored(next);
      latest.current.onChange?.(next);
    },
  });

  return (
    <div
      data-slot="rich-editor"
      className={cn(
        "border-input bg-background focus-within:ring-ring/50 relative rounded-md border focus-within:ring-2",
        className,
      )}
    >
      {editor ? (
        <>
          {editable ? <EditorToolbar editor={editor} features={features} label={label} /> : null}
          <EditorContent editor={editor} />
          <SlashMenu editor={editor} state={slash} listId={listId} />
        </>
      ) : (
        <div className="text-muted-foreground min-h-32 px-4 py-3 text-sm" aria-busy="true">
          Loading editor…
        </div>
      )}
      {name ? <input type="hidden" name={name} value={stored ? JSON.stringify(stored) : ""} /> : null}
    </div>
  );
}
