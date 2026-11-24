/**
 * Session notes and diagrams (#216 phase 3): transcript parsing and SVG
 * cleaning. Pure.
 *
 *   npx tsx scripts/check-ai-media.ts
 */

import { cleanSvg, speakersOf, transcriptText } from "../src/features/ai-assist/media-rules";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const vtt = `WEBVTT

NOTE Zoom recording

1
00:00:01.000 --> 00:00:04.000
<v Ayanda Zulu>Good morning, today is momentum.</v>

2
00:00:04.500 --> 00:00:06.000
<v Ayanda Zulu>p equals m v.</v>

3
00:00:06.500 --> 00:00:08.000
<v Sipho Dlamini>What about impulse?</v>
`;
check("VTT: speakers kept, timestamps dropped, cues joined", transcriptText(vtt), "Ayanda Zulu: Good morning, today is momentum. p equals m v.\nSipho Dlamini: What about impulse?");
const srt = "1\r\n00:00:01,000 --> 00:00:03,000\r\nTutor: Hello class\r\n\r\n2\r\n00:00:03,500 --> 00:00:05,000\r\nTutor: Open your books\r\n";
check("SRT", transcriptText(srt), "Tutor: Hello class Open your books");
check("plain text passes through", transcriptText("We covered vectors.\nThen scalars."), "We covered vectors. Then scalars.");
check("a URL isn't a speaker", transcriptText("https://example.com/notes"), "https://example.com/notes");
check("speakers found", speakersOf(transcriptText(vtt)), ["Ayanda Zulu", "Sipho Dlamini"]);

const ok = '<svg viewBox="0 0 100 50"><rect x="1" y="1" width="20" height="10" fill="#1F6FEB"/><text x="5" y="30">F = ma</text></svg>';
check("a clean SVG survives, with xmlns added", cleanSvg(ok), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect x="1" y="1" width="20" height="10" fill="#1F6FEB" /><text x="5" y="30">F = ma</text></svg>');
const evil = `<?xml version="1.0"?><svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><style>@import url(https://x)</style><a href="https://x"><text>x</text></a><image href="https://x/p.png"/><foreignObject><div>hi</div></foreignObject><circle r="2" onclick="steal()" fill="url(https://x/y)"/><use href="https://x#a"/><use href="#a"/><path d="M0 0" style="fill:url(https://x)"/></svg>`;
const cleaned = cleanSvg(evil) ?? "";
check("scripts, styles, links, images, foreignObject and handlers gone", [/script|style|onload|onclick|foreignObject|<a\b|<image|https:\/\//i.test(cleaned), cleaned.includes('<use href="#a" />'), cleaned.includes("<circle r=\"2\" />")], [false, true, true]);
check("no viewBox is refused", cleanSvg('<svg width="10"><rect/></svg>'), null);
check("not an SVG is refused", cleanSvg("<div>hi</div>"), null);
check("too big is refused", cleanSvg(`<svg viewBox="0 0 1 1">${"<rect/>".repeat(30_000)}</svg>`), null);
check("javascript: in an attribute dropped", (cleanSvg('<svg viewBox="0 0 1 1"><path d="javascript:alert(1)"/></svg>') ?? "").includes("javascript"), false);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
