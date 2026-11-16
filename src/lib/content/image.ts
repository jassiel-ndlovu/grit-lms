/**
 * Image node with the width convention today's content uses: an alt of
 * `Graph of f [50%]` (or `[320px]`) sets the width (see widthFromAlt in
 * src/app/components/markdown.tsx). On import the width moves into the
 * `width` attribute and leaves the alt clean, for screen readers; on export
 * it goes back into the alt, so older renderers keep sizing the image.
 */

import Image from "@tiptap/extension-image";

const WIDTH_IN_ALT = /\s*\[(\d+(?:%|px)?)\]\s*$/;

export function splitAltWidth(alt: string | null | undefined): { alt: string; width: string | null } {
  const text = alt ?? "";
  const m = WIDTH_IN_ALT.exec(text);
  if (!m) return { alt: text, width: null };
  return { alt: text.slice(0, m.index), width: m[1] };
}

export const ContentImage = Image.extend({
  parseMarkdown(token, helpers) {
    const { alt, width } = splitAltWidth(token.text);
    return helpers.createNode("image", { src: token.href, title: token.title ?? null, alt, width });
  },

  renderMarkdown(node) {
    const src = String(node.attrs?.src ?? "");
    const alt = String(node.attrs?.alt ?? "");
    const width = node.attrs?.width ? ` [${node.attrs.width}]` : "";
    const title = node.attrs?.title ? ` "${String(node.attrs.title).replace(/"/g, '\\"')}"` : "";
    return `![${alt}${width}](${src}${title})`;
  },
}).configure({ inline: false });
