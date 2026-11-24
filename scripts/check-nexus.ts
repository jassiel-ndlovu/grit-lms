/**
 * Checks the owner's UI features of 24 Nov: the nexus geometry, panel tones,
 * the saving indicator's words, marking with the keyboard and reused
 * comments, class mode and the topic map.
 *
 *   npx tsx scripts/check-nexus.ts
 *
 * Pure: no database, no network. Exits 1 on any failure.
 */

import { latestPerStudent } from "../src/features/assessments/lib/item-analysis";
import { markingProgress, markKey, namesSomeone, nextToMark, reusableComments, withComment } from "../src/features/assessments/lib/marking-flow";
import { classTopics, learnerTopics, topicCounts, topicLine, topicTrail } from "../src/features/courses/lib/topic-map";
import { classPercent, classPhase, lessonsToShow, phaseLabel, spanLabel } from "../src/features/events/lib/class-mode";
import { cornerFigure, dueTone, hubFigure, markTone, type Figure } from "../src/lib/nexus";
import { saveText } from "../src/lib/save-state";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const COMMENTS = [
  { questionId: "q1", feedback: "Show your working." }, { questionId: "q1", feedback: "Check the sign." }, { questionId: "q1", feedback: " Check the sign. " },
  { questionId: "q1", feedback: "Well tried, Lwazi" }, { questionId: "q1", feedback: "x".repeat(161) }, { questionId: "q1", feedback: "one\ntwo" },
  { questionId: "q2", feedback: "Good" }, { questionId: "q2", feedback: "  " }, { questionId: "q2", feedback: null }, { questionId: null, feedback: "Lost" },
];

/* Geometry */
const inside = (f: Figure) => [f.hub, ...f.nodes].every((p) => p.x - p.r >= 0 && p.y - p.r >= 0 && p.x + p.r <= f.size && p.y + p.r <= f.size);
check("the same seed draws the same figure", cornerFigure("a"), cornerFigure("a"));
check("another seed draws another", JSON.stringify(cornerFigure("a")) === JSON.stringify(cornerFigure("b")), false);
check("200 corner figures stay in their box", Array.from({ length: 200 }, (_, i) => cornerFigure(`s${i}`)).every(inside), true);
check("hub figures stay in their box", [3, 6, 8].every((n) => inside(hubFigure(n))), true);
check("one line per point", [["a", "b", "c", "x"].every((s) => cornerFigure(s).lines.length === cornerFigure(s).nodes.length), hubFigure(6).lines.length], [true, 6]);
check(
  "lines stop at the rims",
  hubFigure(6).lines.every((l) => Math.abs(Math.hypot(l.x1 - 24, l.y1 - 24) - hubFigure(6).hub.r) < 0.05),
  true,
);

/* Tones */
const now = new Date("2026-11-24T10:00:00Z");
const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000);
check("due tones", [dueTone(inHours(-1), now), dueTone(inHours(47), now), dueTone(inHours(49), now)], ["danger", "warning", "neutral"]);
check("marking tones", [markTone(inHours(1), now), markTone(inHours(-1), now), markTone(inHours(-24 * 8), now)], ["neutral", "warning", "danger"]);

/* Saving */
check("saved, with the time", saveText("saved", { time: "14:32" }), "Saved 14:32");
check("on this device", saveText("saved", { where: "device", time: "14:32" }), "Saved on this device 14:32");
check("a failure says why", saveText("failed", { error: "Too long" }), "Too long");
check("a failure wins over offline", saveText("failed", { offline: true }), "Not saved");
check("offline with changes", saveText("pending", { offline: true }), "Offline, not saved yet");
check("offline, nothing waiting", saveText("saved", { offline: true }), "Offline");

/* Marking */
const all = [
  { studentId: "a", status: "GRADED" }, { studentId: "b", status: "SUBMITTED" },
  { studentId: "c", status: "IN_PROGRESS" }, { studentId: "d", status: "SUBMITTED" },
];
check("progress leaves out attempts in progress", markingProgress(all), { marked: 1, total: 3, toMark: 2 });
check("next to mark", nextToMark(all, "b")?.studentId, "d");
check("next goes round", nextToMark(all, "d")?.studentId, "b");
check("next is never this one", nextToMark([{ studentId: "a", status: "SUBMITTED" }], "a"), null);
check("only the latest attempt counts", markingProgress(latestPerStudent([{ studentId: "a", status: "GRADED" }, { studentId: "a", status: "SUBMITTED" }])).toMark, 0);
const key = (k: string, o: Partial<Record<"ctrlKey" | "metaKey" | "shiftKey" | "altKey", boolean>> = {}) =>
  ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...o });
check("keys in a score box", ["Enter", "f", "C", "x"].map((k) => markKey(key(k), true)), ["next", "full", "comment", null]);
check("Shift and Enter", markKey(key("Enter", { shiftKey: true }), true), "previous");
check("no single keys outside a score box", ["Enter", "f", "c"].map((k) => markKey(key(k), false)), [null, null, null]);
check("Ctrl or ⌘ and Enter anywhere", [markKey(key("Enter", { ctrlKey: true }), false), markKey(key("Enter", { metaKey: true }), true)], ["save-next", "save-next"]);
check("Ctrl and F is the browser's", markKey(key("f", { ctrlKey: true }), true), null);
check("comments: most used first, no names, no essays", reusableComments(COMMENTS, ["Lwazi Dube", "Amy O'Connor"]), { q1: ["Check the sign.", "Show your working."], q2: ["Good"] });
check("names, whole words, any case", [namesSomeone("well done lwazi", ["Lwazi Dube"]), namesSomeone("Amylase is an enzyme", ["Amy Ray"]), namesSomeone("See O'Connor", ["Amy O'Connor"])], [true, false, true]);
check("a comment is added once", [withComment("", "A"), withComment("A", "A"), withComment("B ", "A")], ["A", "A", "B\nA"]);

/* Class mode */
const s = { start: "2026-11-24T10:00:00Z", end: "2026-11-24T11:00:00Z", cancelled: false };
const at = (hm: string) => Date.parse(`2026-11-24T${hm}:00Z`);
check("phases", ["09:30", "09:50", "10:30", "11:01"].map((t) => classPhase(s, at(t))), ["before", "soon", "on", "ended"]);
check("cancelled wins", classPhase({ ...s, cancelled: true }, at("10:30")), "cancelled");
check("no end lasts an hour", [classPhase({ ...s, end: null }, at("10:59")), classPhase({ ...s, end: null }, at("11:01"))], ["on", "ended"]);
check("labels", [phaseLabel(s, at("09:50")), phaseLabel(s, at("10:15"))], ["Starts in 10 min", "On now, 45 min left"]);
check("spans", [spanLabel(30_000), spanLabel(65 * 60_000), spanLabel(26 * 3_600_000), spanLabel(48 * 3_600_000)], ["less than a minute", "1 h 5 min", "1 d 2 h", "2 d"]);
check("percent only while on", [classPercent(s, at("10:15")), classPercent(s, at("09:00"))], [25, null]);
const L = ["1", "2", "3", "4", "5"].map((id) => ({ id }));
check("lessons: from the first not done", lessonsToShow(L, new Set(["1", "2"]), 2).map((l) => l.id), ["3", "4"]);
check("lessons: all done shows the last ones", lessonsToShow(L, new Set(["1", "2", "3", "4", "5"]), 2).map((l) => l.id), ["4", "5"]);

/* Topic map */
const topics = [{ code: "a", title: "A" }, { code: "b", title: "B" }, { code: "c", title: "C" }];
const lessons = [{ id: "l1", topics: ["a"] }, { id: "l2", topics: ["a", "b"] }];
const nodes = learnerTopics(topics, lessons, new Set(["l1", "l2"]), [{ topics: ["a"], score: 3, outOf: 4 }, { topics: ["b"], score: 1, outOf: 4 }]);
check("states", nodes.map((n) => n.state), ["passed", "started", "none"]);
check("points", nodes.map((n) => n.steps), [[true, true, true], [true, true, false], [false, false, false]]);
check("in words", nodes.map(topicLine), ["2 of 2 lessons · 1 question marked · 75%", "1 of 1 lesson · 1 question marked · 25%", "Nothing on this topic yet"]);
check("counts", topicCounts(nodes), { passed: 1, started: 1, total: 3 });
check("a learner never sees how many questions are still to come", learnerTopics(topics, [], new Set(), [])[0].questions, { tried: 0, total: 0 });
check("a lesson begun is started", learnerTopics(topics, lessons, new Set(["l1"]), [])[0].state, "started");
const cls = classTopics(topics, lessons, [{ topics: ["a"] }], [{ topics: ["a"], score: 8, outOf: 10 }]);
check("a class in words", topicLine(cls[0]), "2 lessons · 1 question · class average 80%");
check("a class with no marks isn't passing", classTopics(topics, lessons, [{ topics: ["b"] }], [])[1].state, "started");
const trail = topicTrail(Array.from({ length: 17 }, (_, i) => `t${i}`));
check("the trail fits", trail.hubs.every((h) => h.x - 25 >= 0 && h.x + 25 <= trail.width && h.y - 25 >= 0 && h.y + 25 <= trail.height), true);

console.log(failures ? `\n${failures} failed` : "\nAll passed");
process.exit(failures ? 1 : 0);
