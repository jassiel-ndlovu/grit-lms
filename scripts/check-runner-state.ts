/**
 * Check the student runner's question states: npx tsx scripts/check-runner-state.ts
 */
import {
  runnerKey,
  stepName,
  summariseStep,
  timerWarning,
  unansweredLabels,
} from "../src/features/assessments/lib/runner-state";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

const leaf = (id: string, type = "SHORT_ANSWER") => ({ id, type, subQuestions: [] });
const q1 = leaf("q1");
const q2 = { id: "q2", type: "NONE", subQuestions: [leaf("q2a"), leaf("q2b")] };
const q3 = { id: "q3", type: "NONE", subQuestions: [] };
const none = new Set<string>();
const labels = new Map([["q1", "1"], ["q2", "2"], ["q2a", "2.a"], ["q2b", "2.b"], ["q3", "3"]]);

check("empty", summariseStep(q1, {}, none, none).state, "empty");
check("blank string is not an answer", summariseStep(q1, { q1: "  " }, none, none).state, "empty");
check("done", summariseStep(q1, { q1: "x" }, none, none).state, "done");
check("context parent: parts count, the parent doesn't", summariseStep(q2, { q2a: "x" }, none, none), {
  state: "partial", answered: 1, total: 2, unsaved: false, flagged: false,
});
check("all parts answered is done", summariseStep(q2, { q2a: "x", q2b: [1] }, none, none).state, "done");
check("empty array is not an answer", summariseStep(q2, { q2a: "x", q2b: [] }, none, none).state, "partial");
check("unsaved part marks the step", summariseStep(q2, {}, none, new Set(["q2b"])).unsaved, true);
check("flag is per step", summariseStep(q2, {}, new Set(["q2"]), none).flagged, true);

check("name: answered and flagged", stepName("3", summariseStep(q1, { q1: "x" }, new Set(["q1"]), none)), "Question 3, answered, flagged");
check("name: partly", stepName("2", summariseStep(q2, { q2a: "x" }, none, none)), "Question 2, partly answered, 1 of 2 parts");
check("name: not answered, not saved", stepName("1", summariseStep(q1, {}, none, new Set(["q1"]))), "Question 1, not answered, not saved");
check("name: context only", stepName("3", summariseStep(q3, {}, none, none)), "Question 3, no answer needed");

check("unanswered in test order", unansweredLabels([q1, q2, q3], { q2a: "x" }, labels), [
  { stepIndex: 0, id: "q1", label: "1" },
  { stepIndex: 1, id: "q2b", label: "2.b" },
]);

const key = (k: string, mods: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}) =>
  runnerKey({ key: k, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...mods });
check("Alt+Down next", key("ArrowDown", { altKey: true }), "next");
check("Alt+Up prev", key("ArrowUp", { altKey: true }), "prev");
check("Alt+F flag", key("f", { altKey: true }), "flag");
check("Option+F on a Mac keyboard", key("ƒ", { altKey: true }), "flag");
check("Ctrl+S save", key("s", { ctrlKey: true }), "save");
check("Cmd+S save", key("s", { metaKey: true }), "save");
check("plain f is typing", key("f"), null);
check("plain ArrowDown is typing", key("ArrowDown"), null);
check("Ctrl+Shift+S is not save", key("s", { ctrlKey: true, shiftKey: true }), null);

check("first tick says nothing", timerWarning(null, 200), null);
check("crossing 5 minutes", timerWarning(301, 300), "5 minutes left.");
check("crossing 1 minute", timerWarning(61, 60), "1 minute left.");
check("already under 5 minutes: quiet", timerWarning(200, 199), null);
check("a jump past both says the nearer one", timerWarning(400, 50), "1 minute left.");
check("zero is the auto-submit, not a warning", timerWarning(1, 0), null);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
