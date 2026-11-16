/**
 * Checks what Agent A supplies for legacy Batches 2 and 3
 * (docs/revamp/a/design/07-legacy-replacement.md, section 5):
 * the `assignment-brief` Blob kind. (getOwnProfile was dropped: B found
 * getViewer() already carries the avatar.)
 *
 *   npx tsx scripts/check-batch23-supplies.ts
 */

import {
  ALLOWED_CONTENT_TYPES,
  assignmentBriefPath,
  BlobKind,
  isValidPath,
  MAX_BYTES,
  submissionPath,
} from "../src/lib/blob/paths";

let failures = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got:  ${JSON.stringify(got)}\n        want: ${JSON.stringify(want)}`);
}

// Blob kind
const brief = assignmentBriefPath("sub_123", "Week 3 worksheet (final).pdf");
check("brief path layout", brief, "submissions/sub_123/brief/Week-3-worksheet-final-.pdf");
check("brief path is valid for assignment-brief", isValidPath(BlobKind.AssignmentBrief, brief), true);
check("brief path is not a student submission path", isValidPath(BlobKind.Submission, brief), false);
check(
  "student submission path is not a brief path",
  isValidPath(BlobKind.AssignmentBrief, submissionPath("sub_123", "answer.pdf")),
  false,
);
check("brief rejects path traversal", isValidPath(BlobKind.AssignmentBrief, "submissions/sub_123/brief/../x"), false);
check("brief accepts PDFs", ALLOWED_CONTENT_TYPES[BlobKind.AssignmentBrief]?.includes("application/pdf"), true);
check("brief size limit 100 MB", MAX_BYTES[BlobKind.AssignmentBrief], 100 * 1024 * 1024);


console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
