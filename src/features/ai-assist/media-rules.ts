/**
 * Session notes and diagrams (#216 phase 3, Pro): the pure parts, covered
 * by scripts/check-ai-media.ts. Transcript parsing (VTT, SRT or plain text)
 * and SVG cleaning.
 */

export const MEDIA_LIMITS = {
  transcriptChars: 150_000,
  svgBytes: 150_000,
} as const;

/**
 * A meeting transcript as plain lines "Speaker: words". Reads WebVTT (Zoom,
 * Teams, Meet), SRT and plain text: drops cue numbers, timestamps, WEBVTT
 * headers, NOTE blocks and tags; joins a speaker's consecutive cues.
 */
export function transcriptText(raw: string): string {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const out: Array<{ speaker: string | null; text: string }> = [];
  let inNote = false;
  for (const line0 of lines) {
    const line = line0.trim();
    if (!line) { inNote = false; continue; }
    if (inNote) continue;
    if (/^WEBVTT/i.test(line) || /^(STYLE|REGION)\b/.test(line)) continue;
    if (/^NOTE\b/.test(line)) { inNote = true; continue; }
    if (/^\d+$/.test(line)) continue;
    if (/-->/.test(line)) continue;
    let text = line.replace(/<\/?v(?:\s+([^>]*))?>/g, (_m, who) => (who ? `${who}: ` : "")).replace(/<[^>]+>/g, "").trim();
    let speaker: string | null = null;
    const m = /^([^:]{1,60}):\s+(.*)$/.exec(text);
    if (m && !/^https?$/i.test(m[1])) { speaker = m[1].trim(); text = m[2]; }
    if (!text) continue;
    const last = out[out.length - 1];
    if (last && last.speaker === speaker) last.text += ` ${text}`;
    else out.push({ speaker, text });
  }
  return out.map((o) => (o.speaker ? `${o.speaker}: ${o.text}` : o.text)).join("\n");
}

/** Speaker names in a transcript, for scrubbing (anything before a colon at a line's start). */
export function speakersOf(text: string): string[] {
  const s = new Set<string>();
  for (const line of text.split("\n")) {
    const m = /^([^:]{2,60}):\s/.exec(line);
    if (m) s.add(m[1].trim());
  }
  return [...s];
}

const ALLOWED = new Set([
  "svg", "g", "defs", "title", "desc", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan",
  "marker", "lineargradient", "radialgradient", "stop", "clippath", "pattern", "symbol", "use",
]);

/**
 * Keeps an SVG to safe drawing elements: no scripts, foreignObject, images,
 * links, animations or styles; no event handlers; href only to "#ids" in
 * the same file; no url(...) except url(#id). Returns null if what's left
 * isn't a usable SVG.
 */
export function cleanSvg(svg: string): string | null {
  if (!svg || svg.length > MEDIA_LIMITS.svgBytes) return null;
  let s = svg.replace(/<\?xml[^>]*>/gi, "").replace(/<!DOCTYPE[^>]*>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  // Drop disallowed elements with their content.
  s = s.replace(/<(script|style|foreignObject|iframe|image|a|animate\w*|set|object|embed|audio|video|canvas)\b[\s\S]*?(<\/\1\s*>|\/>)/gi, "");
  s = s.replace(/<\/?(script|style|foreignObject|iframe|image|a|animate\w*|set|object|embed|audio|video|canvas)\b[^>]*>/gi, "");
  let bad = false;
  s = s.replace(/<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g, (_m, close: string, name: string, attrs: string, self: string) => {
    const n = name.toLowerCase();
    if (!ALLOWED.has(n)) return "";
    if (close) return `</${name}>`;
    const kept: string[] = [];
    for (const a of attrs.matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g)) {
      const key = a[1].toLowerCase();
      const value = a[3] ?? a[4] ?? "";
      if (key.startsWith("on") || key === "style") continue;
      if ((key === "href" || key === "xlink:href") && !value.startsWith("#")) continue;
      if (/url\(\s*(?!['"]?#)/i.test(value) || /javascript:|data:/i.test(value)) continue;
      if (key === "xmlns" || key === "xmlns:xlink" || /^[a-z][\w:-]*$/.test(key)) kept.push(`${a[1]}="${value.replace(/"/g, "&quot;")}"`);
    }
    if (n === "svg" && !kept.some((k) => k.startsWith("viewBox="))) bad = true;
    return `<${name}${kept.length ? ` ${kept.join(" ")}` : ""}${self ? " /" : ""}>`;
  });
  s = s.trim();
  if (bad || !/^<svg[\s>]/i.test(s) || !/<\/svg>$/i.test(s)) return null;
  if (!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(s)) s = s.replace(/^<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  return s;
}
