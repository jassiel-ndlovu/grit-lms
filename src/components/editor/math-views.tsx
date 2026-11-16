"use client";

/**
 * Editor views for the maths nodes (contracts/editor.md). The schema and
 * markdown rules come from src/lib/content/math.ts unchanged; this adds:
 * - a node view that shows the TeX typeset by MathJax (the same engine as
 *   the student page), with a TeX box under it while the node is selected
 *   or still empty;
 * - input rules: `$x^2$` becomes inline maths, `$$` then space on an empty
 *   line becomes a maths block.
 */

import * as React from "react";
import { InputRule } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { MathJax } from "better-react-mathjax";

import { BlockMath, InlineMath } from "@/lib/content/math";
import { cn } from "@/lib/utils";

function TexBox({
  latex, onChange, onDone, onFocus, onBlur, multiline,
}: {
  latex: string;
  onChange: (latex: string) => void;
  onDone: () => void;
  onFocus: () => void;
  onBlur: () => void;
  multiline: boolean;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => {
    // Only on mount: a new, empty node opens straight into its TeX box.
    // Tiptap's focus() command (run by the insert) refocuses the editor a
    // frame later, so take focus now and again after that, unless the
    // person has moved on to something other than the editor by then.
    if (latex !== "") return;
    const box = ref.current;
    box?.focus();
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => {
        const active = document.activeElement;
        if (box && (active === box || active?.closest(".ProseMirror"))) box.focus();
      });
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <textarea
      ref={ref}
      aria-label="TeX"
      value={latex}
      rows={multiline ? Math.min(8, Math.max(2, latex.split("\n").length)) : 1}
      spellCheck={false}
      placeholder={multiline ? "\\begin{aligned} … \\end{aligned}" : "x^2"}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={(e) => {
        // Escape, or Enter in an inline box, returns to the text.
        if (e.key === "Escape" || (!multiline && e.key === "Enter")) {
          e.preventDefault();
          onDone();
        }
      }}
      className="border-input bg-background focus-visible:ring-ring w-full min-w-48 resize-y rounded-md border px-2 py-1 font-mono text-xs outline-none focus-visible:ring-2"
    />
  );
}

/**
 * The TeX box state for a maths node view. The box is open while the node
 * is selected, still empty, or the box itself has focus.
 */
function useTexEditing({ editor, getPos, node, selected }: ReactNodeViewProps) {
  const [focused, setFocused] = React.useState(false);
  const latex = String(node.attrs.latex ?? "");

  // An attribute step, not updateAttributes: that replaces a leaf node,
  // which moves the selection off it and would close the box mid-word.
  const setLatex = React.useCallback((value: string) => {
    const pos = getPos();
    if (typeof pos === "number") editor.view.dispatch(editor.state.tr.setNodeAttribute(pos, "latex", value));
  }, [editor, getPos]);

  // Back to the text after the node; a node left empty is removed.
  const leave = React.useCallback(() => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    setFocused(false);
    // Now, not a frame later as the focus() command does: the TeX box is
    // about to unmount, and keys typed in between would go nowhere.
    editor.view.focus();
    if (String(node.attrs.latex ?? "").trim() === "") {
      editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
      return;
    }
    editor.chain().focus().setTextSelection(pos + node.nodeSize).run();
  }, [editor, getPos, node]);

  return {
    latex,
    open: editor.isEditable && (selected || focused || latex === ""),
    box: {
      latex,
      onChange: setLatex,
      onDone: leave,
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
  };
}

function InlineMathView(props: ReactNodeViewProps) {
  const { node, selected } = props;
  const { latex, open, box } = useTexEditing(props);
  return (
    <NodeViewWrapper as="span" className={cn("relative inline-block rounded px-0.5", selected && "bg-accent")}>
      <span contentEditable={false}>
        {latex ? (
          <MathJax inline dynamic>{node.attrs.display ? `\\[${latex}\\]` : `\\(${latex}\\)`}</MathJax>
        ) : (
          <span className="text-muted-foreground font-mono text-xs">TeX</span>
        )}
      </span>
      {open ? (
        <span contentEditable={false} className="bg-popover absolute top-full left-0 z-20 mt-1 block w-72 rounded-md border p-1.5 shadow-md">
          <TexBox {...box} multiline={false} />
        </span>
      ) : null}
    </NodeViewWrapper>
  );
}

function BlockMathView(props: ReactNodeViewProps) {
  const { selected } = props;
  const { latex, open, box } = useTexEditing(props);
  return (
    <NodeViewWrapper className={cn("my-2 rounded-md px-2 py-1", selected && "bg-accent")} data-drag-handle>
      <div contentEditable={false} className="overflow-x-auto text-center">
        {latex ? (
          <MathJax dynamic>{`\\[${latex}\\]`}</MathJax>
        ) : (
          <span className="text-muted-foreground font-mono text-xs">Empty maths block</span>
        )}
      </div>
      {open ? (
        <div contentEditable={false} className="mt-1">
          <TexBox {...box} multiline />
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}

/** Keys typed in a TeX box stay there instead of reaching the editor. */
const viewOptions = {
  stopEvent: ({ event }: { event: Event }) => (event.target as HTMLElement | null)?.tagName === "TEXTAREA",
};

export const EditorInlineMath = InlineMath.extend({
  addNodeView() {
    return ReactNodeViewRenderer(InlineMathView, viewOptions);
  },
  addInputRules() {
    const type = this.type;
    return [
      // Not nodeInputRule: in Tiptap 3.34 the typed character is already in
      // the document when the rule runs, and nodeInputRule inserts it again,
      // leaving a stray "$". Replace exactly the `$...$` span instead.
      new InputRule({
        // `$x^2$` after a space or at the start; not `$$`, not an empty pair.
        find: /(?:^|\s)(\$([^$\s](?:[^$]*[^$\s])?)\$)$/,
        handler: ({ state, range, match }) => {
          const span = match[1];
          // range.to includes the typed "$" when it is already inserted.
          const typed = range.to - range.from === match[0].length;
          const end = typed ? range.to : range.to + 1;
          if (!typed) state.tr.insertText("$", range.to);
          state.tr.replaceWith(end - span.length, end, type.create({ latex: match[2], display: false }));
        },
      }),
    ];
  },
});

export const EditorBlockMath = BlockMath.extend({
  addNodeView() {
    return ReactNodeViewRenderer(BlockMathView, viewOptions);
  },
  addInputRules() {
    return [
      new InputRule({
        find: /^\$\$\s$/,
        handler: ({ range, chain }) => {
          chain().deleteRange(range).insertContent({ type: this.name, attrs: { latex: "" } }).run();
        },
      }),
    ];
  },
});
