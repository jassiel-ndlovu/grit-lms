"use client";

/**
 * Formatting toolbar: one role="toolbar" tab stop with arrow-key movement
 * (Radix), the same component family as the page RibbonToolbar
 * (contracts/navigation.md). Buttons show their state with aria-pressed.
 */

import * as React from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import * as ToolbarPrimitive from "@radix-ui/react-toolbar";
import { Bold, Code, Italic, Redo2, Strikethrough, Underline, Undo2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { commandsFor, runCommand, type EditorFeatures } from "./commands";

const BUTTON =
  "text-muted-foreground hover:bg-accent hover:text-foreground aria-pressed:bg-accent aria-pressed:text-foreground " +
  "inline-flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring " +
  "disabled:opacity-40 [&_svg]:size-4";

function Mark({ label, icon: Icon, pressed, onClick, shortcut }: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pressed?: boolean;
  onClick: () => void;
  shortcut?: string;
}) {
  return (
    <ToolbarPrimitive.Button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={shortcut ? `${label} (${shortcut})` : label}
      // mousedown keeps the editor's selection; click runs the command.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={BUTTON}
    >
      <Icon />
    </ToolbarPrimitive.Button>
  );
}

export function EditorToolbar({ editor, features, label, className }: {
  editor: Editor;
  features: EditorFeatures;
  label: string;
  className?: string;
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();
  const blocks = commandsFor(features).filter((c) => c.id !== "text");

  return (
    <ToolbarPrimitive.Root
      aria-label={`${label} formatting`}
      className={cn("flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1", className)}
    >
      <Mark label="Bold" shortcut="Ctrl B" icon={Bold} pressed={s.bold} onClick={() => chain().toggleBold().run()} />
      <Mark label="Italic" shortcut="Ctrl I" icon={Italic} pressed={s.italic} onClick={() => chain().toggleItalic().run()} />
      <Mark label="Underline" shortcut="Ctrl U" icon={Underline} pressed={s.underline} onClick={() => chain().toggleUnderline().run()} />
      <Mark label="Strikethrough" icon={Strikethrough} pressed={s.strike} onClick={() => chain().toggleStrike().run()} />
      <Mark label="Inline code" shortcut="Ctrl E" icon={Code} pressed={s.code} onClick={() => chain().toggleCode().run()} />
      <ToolbarPrimitive.Separator className="bg-border mx-1 h-4 w-px" />
      {blocks.map((c) => (
        <Mark key={c.id} label={c.label} icon={c.icon} onClick={() => runCommand(editor, c)} />
      ))}
      <ToolbarPrimitive.Separator className="bg-border mx-1 h-4 w-px" />
      <ToolbarPrimitive.Button type="button" aria-label="Undo" title="Undo (Ctrl Z)" disabled={!s.canUndo}
        onMouseDown={(e) => e.preventDefault()} onClick={() => chain().undo().run()} className={BUTTON}>
        <Undo2 />
      </ToolbarPrimitive.Button>
      <ToolbarPrimitive.Button type="button" aria-label="Redo" title="Redo (Ctrl Shift Z)" disabled={!s.canRedo}
        onMouseDown={(e) => e.preventDefault()} onClick={() => chain().redo().run()} className={BUTTON}>
        <Redo2 />
      </ToolbarPrimitive.Button>
    </ToolbarPrimitive.Root>
  );
}
