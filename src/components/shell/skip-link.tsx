/**
 * "Skip to content" (#216, accessibility): the first thing a keyboard or
 * screen-reader user reaches on every dashboard page. Hidden until it has
 * focus, then shown at the top left; it moves focus to the page's <main
 * id="main-content">, past the sidebar. Both shells render it.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="bg-primary text-primary-foreground focus-visible:ring-ring sr-only z-[100] rounded-md px-3 py-2 text-sm font-medium outline-none focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus-visible:ring-2"
    >
      Skip to content
    </a>
  );
}
