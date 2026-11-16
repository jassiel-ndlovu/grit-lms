"use client";

/**
 * Slash menu: type "/" to insert a block. The Tiptap suggestion plugin
 * tracks the query; React draws the list next to the caret. Arrow keys move,
 * Enter inserts, Escape closes. The list is a listbox owned by the editor
 * (aria-activedescendant on the editor element), so focus stays in the text.
 */

import * as React from "react";
import { Extension, type Editor, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from "@tiptap/suggestion";

import { cn } from "@/lib/utils";

import { filterCommands, runCommand, type BlockCommand } from "./commands";

export interface SlashState {
  items: BlockCommand[];
  range: Range;
  rect: DOMRect | null;
  active: number;
}

interface SlashOptions {
  commands: () => BlockCommand[];
  onState: (state: SlashState | null) => void;
}

const slashKey = new PluginKey("slash-menu");

export const SlashMenuExtension = Extension.create<SlashOptions>({
  name: "slashMenu",
  addOptions() {
    return { commands: () => [], onState: () => {} };
  },
  addProseMirrorPlugins() {
    const { commands, onState } = this.options;
    let state: SlashState | null = null;
    const set = (next: SlashState | null) => {
      state = next;
      onState(next);
    };
    const fromProps = (p: SuggestionProps<BlockCommand, BlockCommand>, active = 0): SlashState => ({
      items: p.items,
      range: p.range,
      rect: p.clientRect?.() ?? null,
      active: Math.min(active, Math.max(0, p.items.length - 1)),
    });

    return [
      Suggestion<BlockCommand, BlockCommand>({
        editor: this.editor,
        pluginKey: slashKey,
        char: "/",
        startOfLine: false,
        allowSpaces: false,
        items: ({ query }) => filterCommands(commands(), query),
        command: ({ editor, range, props }) => runCommand(editor, props, range),
        render: () => ({
          onStart: (p) => set(fromProps(p)),
          onUpdate: (p) => set(fromProps(p, 0)),
          onExit: () => set(null),
          onKeyDown: ({ event }: SuggestionKeyDownProps) => {
            if (!state || state.items.length === 0) return false;
            const n = state.items.length;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              set({ ...state, active: (state.active + (event.key === "ArrowDown" ? 1 : n - 1)) % n });
              return true;
            }
            if (event.key === "Enter" || event.key === "Tab") {
              runCommand(this.editor, state.items[state.active], state.range);
              return true;
            }
            if (event.key === "Escape") {
              set(null);
              return true;
            }
            return false;
          },
        }),
      }),
    ];
  },
});

export function SlashMenu({ editor, state, listId }: { editor: Editor; state: SlashState | null; listId: string }) {
  const optionId = (i: number) => `${listId}-${i}`;

  // The editor element owns the listbox while it is open.
  React.useEffect(() => {
    const el = editor.view.dom;
    if (state && state.items.length) {
      el.setAttribute("aria-controls", listId);
      el.setAttribute("aria-activedescendant", optionId(state.active));
    } else {
      el.removeAttribute("aria-controls");
      el.removeAttribute("aria-activedescendant");
    }
    // optionId only depends on listId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, state, listId]);

  if (!state || !state.rect) return null;
  const { rect } = state;
  return (
    <div
      className="bg-popover text-popover-foreground fixed z-50 w-64 rounded-md border p-1 shadow-lg"
      style={{ top: rect.bottom + 6, left: rect.left }}
    >
      {state.items.length === 0 ? (
        <p className="text-muted-foreground px-2 py-1.5 text-sm">No matching block</p>
      ) : (
        <ul id={listId} role="listbox" aria-label="Insert a block" className="max-h-72 overflow-y-auto">
          {state.items.map((item, i) => {
            const Icon = item.icon;
            return (
              <li
                key={item.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === state.active}
                // mousedown, not click: keep the editor's selection.
                onMouseDown={(e) => {
                  e.preventDefault();
                  runCommand(editor, item, state.range);
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                  i === state.active && "bg-accent text-accent-foreground",
                )}
              >
                <Icon className="text-muted-foreground size-4" aria-hidden />
                {item.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
