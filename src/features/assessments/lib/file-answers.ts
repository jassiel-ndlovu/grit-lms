/**
 * Normalisation for FILE_UPLOAD answers stored on TestSubmission.answers.
 *
 * The column is free-form JSON keyed by questionId, and three shapes exist
 * in the wild:
 *
 *   1. `[{ fileUrl, fileType, fileName }, ...]`  — what the runner writes
 *      today, and what the legacy question-input component wrote.
 *   2. `{ fileUrl, fileType, fileName }`         — a single-file interlude
 *      that shipped with the Inkwell runner rewrite.
 *   3. `null` / `undefined` / `{}`               — never answered.
 *
 * Everything that reads a file answer (runner, review page, tutor grading
 * form, student grade detail) goes through `toFileAnswers` so an attempt
 * written under one shape still renders under another.
 */

export interface TestFileAnswer {
  fileUrl: string;
  /** MIME type when the browser reported one, else "OTHER". */
  fileType: string;
  fileName: string;
}

function fileNameFromUrl(url: string): string {
  try {
    return decodeURIComponent(url.split("?")[0]).split("/").pop() || url;
  } catch {
    return url;
  }
}

/** Coerce one candidate entry into a TestFileAnswer, or null if it isn't one. */
function coerce(raw: unknown): TestFileAnswer | null {
  if (typeof raw === "string") {
    // Tolerate a bare URL string.
    return raw.trim()
      ? { fileUrl: raw, fileType: "OTHER", fileName: fileNameFromUrl(raw) }
      : null;
  }
  if (!raw || typeof raw !== "object") return null;

  const o = raw as Record<string, unknown>;
  const url = typeof o.fileUrl === "string" ? o.fileUrl : null;
  if (!url) return null;

  return {
    fileUrl: url,
    fileType: typeof o.fileType === "string" ? o.fileType : "OTHER",
    fileName:
      typeof o.fileName === "string" && o.fileName.trim()
        ? o.fileName
        : fileNameFromUrl(url),
  };
}

/**
 * Read a FILE_UPLOAD answer as a list of files, whatever shape it was
 * stored in. Returns an empty array when nothing was uploaded.
 */
export function toFileAnswers(value: unknown): TestFileAnswer[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map(coerce).filter((f): f is TestFileAnswer => f !== null);
  }
  const one = coerce(value);
  return one ? [one] : [];
}
