/**
 * Checks the helpers behind the AI-assisted marking screens (#150): which
 * marks count as AI-suggested or tutor-confirmed, what is recorded when the
 * grade is saved, the bulk-accept rule, review order, progress words,
 * evidence highlighting, Previous and Next, the switch's state and the
 * written-question labels.
 *
 *   npx tsx scripts/check-ai-marking-ui.ts
 *
 * Pure: no database, no network, no AI calls. Exits 1 on any failure.
 */

import {
  actionForSavedScore, aiSwitchState, awaitingReview, criteriaOf, finalActions, highlightRuns, isAiMarkedType, isSafeToBulkAccept,
  neighbours, plainPreview, progressLabel, progressOf, provenanceOf, queuedLabel, riskRank, writtenQuestions, type AiSuggestion,
} from "../src/features/assessments/lib/ai-marking-ui";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

function sug(over: Partial<AiSuggestion> = {}): AiSuggestion {
  return {
    id: "s1", questionId: "q1", status: "DONE", criteria: [], totalAwarded: 3, outOf: 5, confidence: "HIGH", flags: [], feedbackToStudent: null,
    escalated: false, error: null, tutorAction: null, tutorScore: null, actedAt: null, ...over,
  };
}

// --- Types ------------------------------------------------------------------------
check("essays and short answers are AI-marked", [isAiMarkedType("ESSAY"), isAiMarkedType("SHORT_ANSWER")], [true, true]);
check("other types are not", [isAiMarkedType("MULTIPLE_CHOICE"), isAiMarkedType("FILE_UPLOAD"), isAiMarkedType("CODE")], [false, false, false]);

// --- Criteria JSON ----------------------------------------------------------------
check("criteria: junk is empty", criteriaOf("nope"), []);
check(
  "criteria: malformed rows dropped, blank evidence dropped",
  criteriaOf([{ id: "c1", label: "Method", awarded: 2, max: 3, justification: "ok", evidence: ["a", "", 4] }, { id: "c2", awarded: "x", max: 2 }, null]),
  [{ id: "c1", label: "Method", awarded: 2, max: 3, justification: "ok", evidence: ["a"] }],
);

// --- Provenance: AI-suggested vs tutor-confirmed ----------------------------------
check("a ready suggestion with no decision is only suggested", provenanceOf(sug(), undefined), "suggested");
check("accepted on this page", provenanceOf(sug(), "ACCEPTED"), "accepted");
check("edited earlier (stored)", provenanceOf(sug({ tutorAction: "EDITED" }), undefined), "edited");
check("this page's decision wins over the stored one", provenanceOf(sug({ tutorAction: "ACCEPTED" }), "REJECTED"), "rejected");
check("a failed suggestion leaves the tutor's own mark", provenanceOf(sug({ status: "FAILED", totalAwarded: null }), undefined), "tutor");
check("no suggestion: the tutor's mark", provenanceOf(undefined, undefined), "tutor");
check("still marking: the tutor's mark", provenanceOf(sug({ status: "RUNNING", totalAwarded: null }), undefined), "tutor");

// --- What is recorded on save -----------------------------------------------------
check("typed the same mark → accepted", actionForSavedScore(sug(), "3"), { action: "ACCEPTED", score: 3 });
check("typed another mark → edited", actionForSavedScore(sug(), "4"), { action: "EDITED", score: 4 });
check("left blank → nothing", actionForSavedScore(sug(), " "), null);
check("already decided before → nothing", actionForSavedScore(sug({ tutorAction: "ACCEPTED" }), "3"), null);
check("not done → nothing", actionForSavedScore(sug({ status: "QUEUED" }), "3"), null);

const list = [
  sug({ id: "a", questionId: "q1" }),
  sug({ id: "b", questionId: "q2", totalAwarded: 2 }),
  sug({ id: "c", questionId: "q3" }),
  sug({ id: "d", questionId: "q4" }),
  sug({ id: "e", questionId: "q5" }),
];
const scores: Record<string, string> = { q1: "3", q2: "1.5", q3: "", q4: "2", q5: "" };
check(
  "final actions: accept kept, edit changed, reject, untouched typed, untouched blank",
  finalActions(list, { a: "ACCEPTED", b: "EDITED", c: "REJECTED" }, (q) => scores[q]),
  [
    { suggestionId: "a", action: "ACCEPTED", score: 3 },
    { suggestionId: "b", action: "EDITED", score: 1.5 },
    { suggestionId: "c", action: "REJECTED", score: null },
    { suggestionId: "d", action: "EDITED", score: 2 },
  ],
);
check(
  "final actions: Edit that ends on the AI's mark counts as accepted",
  finalActions([sug()], { s1: "EDITED" }, () => "3"),
  [{ suggestionId: "s1", action: "ACCEPTED", score: 3 }],
);
check("final actions: Accept then the box emptied records nothing", finalActions([sug()], { s1: "ACCEPTED" }, () => ""), []);

// --- Bulk accept and review order ------------------------------------------------
check("safe: high, no flags", isSafeToBulkAccept(sug()), true);
check("not safe: low confidence", isSafeToBulkAccept(sug({ confidence: "LOW" })), false);
check("not safe: flagged", isSafeToBulkAccept(sug({ flags: ["needs_tutor"] })), false);
check("not safe: failed", isSafeToBulkAccept(sug({ status: "FAILED", totalAwarded: null })), false);
check(
  "awaiting review skips decided (stored or local) and unfinished",
  awaitingReview([sug({ id: "a" }), sug({ id: "b", tutorAction: "ACCEPTED" }), sug({ id: "c" }), sug({ id: "d", status: "RUNNING" })], { c: "REJECTED" }).map((s) => s.id),
  ["a"],
);
check(
  "risk: flagged/escalated, low, medium, high",
  [sug({ flags: ["off_topic"] }), sug({ escalated: true }), sug({ confidence: "LOW" }), sug({ confidence: "MEDIUM" }), sug()].map(riskRank),
  [0, 0, 1, 2, 3],
);

// --- Progress and words ----------------------------------------------------------
const p = progressOf([
  { status: "QUEUED", tutorAction: null }, { status: "RUNNING", tutorAction: null }, { status: "DONE", tutorAction: null },
  { status: "DONE", tutorAction: "ACCEPTED" }, { status: "FAILED", tutorAction: null }, { status: "SKIPPED", tutorAction: null },
]);
check("progress counts", p, { total: 6, queued: 1, running: 1, done: 2, failed: 1, skipped: 1, reviewed: 1 });
check("progress words while running", progressLabel(p), "2 of 4 marked (1 failed, 1 skipped)");
check("progress words when finished", progressLabel(progressOf([{ status: "DONE", tutorAction: "EDITED" }, { status: "DONE", tutorAction: null }])), "2 marked, 1 reviewed");
check("progress words: none", progressLabel(progressOf([])), "No AI suggestions yet");
check("queued: some, none skipped", queuedLabel({ queued: 12, skipped: 0 }), "12 answers queued.");
check("queued: one, some skipped", queuedLabel({ queued: 1, skipped: 3 }), "1 answer queued; 3 skipped (blank answers or questions without a memo).");
check("queued: nothing new", queuedLabel({ queued: 0, skipped: 0 }), "Nothing new to mark.");

// --- Evidence highlighting -------------------------------------------------------
check("no quotes: one plain run", highlightRuns("abc", []), [{ text: "abc", mark: false }]);
check(
  "case-insensitive, every occurrence",
  highlightRuns("Heat rises. heat sinks.", ["heat"]),
  [{ text: "Heat", mark: true }, { text: " rises. ", mark: false }, { text: "heat", mark: true }, { text: " sinks.", mark: false }],
);
check(
  "overlapping quotes merge",
  highlightRuns("the water cycle", ["water cy", "cycle"]),
  [{ text: "the ", mark: false }, { text: "water cycle", mark: true }],
);
check("a quote not in the answer marks nothing", highlightRuns("abc", ["zzz"]), [{ text: "abc", mark: false }]);

// --- Previous and Next -----------------------------------------------------------
const subs = [{ studentId: "a" }, { studentId: "b" }, { studentId: "c" }];
check("middle", neighbours(subs, "b"), { prev: { studentId: "a" }, next: { studentId: "c" }, index: 1 });
check("first has no previous", neighbours(subs, "a").prev, null);
check("last has no next", neighbours(subs, "c").next, null);
check("missing", neighbours(subs, "z"), { prev: null, next: null, index: -1 });

// --- The switch ------------------------------------------------------------------
check("switch: off with the service", aiSwitchState({ on: false, available: true, readOnly: false }), "off");
check("switch: on", aiSwitchState({ on: true, available: true, readOnly: false }), "on");
check("switch: no Pro → upgrade path", aiSwitchState({ on: false, available: false, readOnly: false }), "upgrade");
check("switch: on but plan lapsed can still be turned off", aiSwitchState({ on: true, available: false, readOnly: false }), "on");
check("switch: read-only locks it", aiSwitchState({ on: true, available: true, readOnly: true }), "locked");

// --- Written-question labels -----------------------------------------------------
const flat = [
  { id: "1", parentId: null, order: 0, type: "MULTIPLE_CHOICE", question: "Pick one" },
  { id: "2", parentId: null, order: 1, type: "NONE", question: "Read the **passage**" },
  { id: "2b", parentId: "2", order: 1, type: "ESSAY", question: "Discuss $x$" },
  { id: "2a", parentId: "2", order: 0, type: "SHORT_ANSWER", question: "Name it" },
  { id: "3", parentId: null, order: 2, type: "ESSAY", question: "Explain" },
];
check(
  "written questions in order with printed labels",
  writtenQuestions(flat, []).map((q) => [q.id, q.label, q.preview]),
  [["2a", "2.a", "Name it"], ["2b", "2.b", "Discuss x"], ["3", "3", "Explain"]],
);
check("preview is cut with an ellipsis", plainPreview("a".repeat(100), 10), `${"a".repeat(9)}…`);

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll AI-marking UI checks passed.");
