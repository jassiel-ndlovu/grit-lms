/**
 * UI feature flags. Server-side only: they read env vars at request time.
 *
 * REVAMP_UI="1" switches the app to the revamp design (Notion-like tokens,
 * Geist fonts, and later the new shell). Agent A owns the env var itself;
 * set it on staging first. Anything else, or unset, keeps today's UI.
 */
export function isRevampUi(): boolean {
  return process.env.REVAMP_UI === "1";
}

/** Design-system preview pages: always in development, else only with the flag. */
export function canPreviewDesignSystem(): boolean {
  return process.env.NODE_ENV === "development" || isRevampUi();
}

/**
 * MathJax version for the whole app: 4 with the flag, else 3. One per
 * process: better-react-mathjax refuses two versions in one app, so every
 * MathProvider must take its version from here.
 */
export function mathJaxVersion(): 3 | 4 {
  return isRevampUi() ? 4 : 3;
}
