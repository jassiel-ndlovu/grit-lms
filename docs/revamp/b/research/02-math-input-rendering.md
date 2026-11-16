# Math input and rendering

Checked: 2026-11-16. Author: Agent B research (subagent).

## Bottom line

- **Input:** use MathLive (MIT, actively maintained, virtual keyboard, LaTeX in and out). MathQuill is MPL-2.0 and still on a 0.10 alpha. Gate visual input behind Plus.
- **Rendering:** keep MathJax, but move from 3.2.2 on a CDN to MathJax 4 served from our own bundle. Do not switch to KaTeX yet. KaTeX is faster and renders on the server, but it fails on some TeX that MathJax accepts (`\require`, `\bbox`, `\label`/`\ref`, `eqnarray`, `multline`, `\DeclareMathOperator`, `\mbox`), and we cannot see which of these are in the database without an audit.
- **Solving typed problems ("find t for t^2 + 3t + 2 = 0"):** run Cortex Compute Engine locally for anything typed in MathLive. Use an LLM only to turn free text into LaTeX or MathJSON, then let the engine solve and check it. Do not use Wolfram|Alpha: you may not cache its results, it requires attribution and branding, and commercial prices are not published.
- **Answer checking:** add symbolic and tolerance checks for NUMERIC and SHORT_ANSWER with Compute Engine. Today NUMERIC uses exact `===` (see `src/features/assessments/lib/auto-grade.ts`).

## How the repo does math today

- `src/app/components/math-provider.tsx` mounts `MathJaxContext` from `better-react-mathjax` (`^2.3.0` in `package.json`). It loads `https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.js` with SVG output and `fontCache: "global"`. It skips `pre` and `code`.
- `src/app/components/markdown.tsx` (`LessonMarkdown`) renders react-markdown + remark-gfm and wraps the output in `<MathJax dynamic>`. Typesetting happens in the browser after mount. The `dynamic` prop exists because re-typesetting on every parent render was too slow (test runner).
- `src/lib/tex-delimiters.ts` rewrites `\(..\)` and `\[..\]` to `$..$` and `$$..$$` before markdown parses them, and escapes punctuation in maths bodies so `\\`, `_` and `*` reach MathJax unchanged. It also keeps the `\[26\]` mark-allocation escape. `scripts/check-tex-delimiters.ts` tests `bmatrix`, `aligned`, `cases` and `pmatrix`.
- `src/app/globals.css` (around lines 232-270) has `mjx-container` and `mjx-assistive-mml` rules. They fix scroll height caused by nested assistive MathML and the alignment of inline SVG.
- Other places that mention MathJax: `markdown-textarea.tsx`, `test-question-editor.tsx`, `lesson-form.tsx`, `grading-form.tsx`, the submissions and test review pages, `test-io.ts` (the LLM import guide tells authors "MathJax v3"), and the marketing copy in `src/app/page.tsx`.
- The repo itself only uses `aligned`, `cases`, `bmatrix`, `pmatrix` and `\text{}` in tests and fixtures. **The real content is in Postgres, which I did not query** (hard rule). Any renderer switch needs an audit of that corpus first.

Every renderer below needs these to keep working: the delimiter rewrite (it is renderer-neutral and stays), the `dynamic` behaviour, and the CSS. A KaTeX move would delete the `mjx-*` CSS and replace `<MathJax>` with a rehype plugin.

## 1. Visual math input

### Options

| | MathLive | MathQuill |
|---|---|---|
| Licence | MIT ([GitHub](https://github.com/arnog/mathlive)) | MPL-2.0 ([GitHub](https://github.com/mathquill/mathquill)) |
| Latest version | 0.111.4 ([npm](https://registry.npmjs.org/mathlive/latest)) | 0.10.1-a ([npm](https://registry.npmjs.org/mathquill/latest)) |
| Maintenance | Releases twice a year (around June and January) plus patches ([GitHub](https://github.com/arnog/mathlive)) | README says it is "resuming active development"; 347 open issues, 58 open PRs ([GitHub](https://github.com/mathquill/mathquill)) |
| Bundle | 811 KB min, 222 KB gzip ([bundlephobia](https://bundlephobia.com/api/size?package=mathlive)) | (unverified) |
| Virtual keyboard | Yes, built in, mobile-ready, custom layouts ([GitHub](https://github.com/arnog/mathlive)) | No built-in keyboard (unverified) |
| Output formats | LaTeX, MathML, ASCIIMath, Typst, MathJSON ([GitHub](https://github.com/arnog/mathlive)) | LaTeX |
| Accessibility | Math-to-speech and ARIA labels ([GitHub](https://github.com/arnog/mathlive)) | (unverified) |
| React | Web component `<math-field>`, with a React guide ([mathlive.io](https://mathlive.io/mathlive/guides/react/)) | jQuery-era API, community wrappers (unverified) |
| SSR | Separate `mathlive-ssr` export for Node ([npm](https://registry.npmjs.org/mathlive/latest)) | No |

### MathLive notes

- It is a custom element (`<math-field>`). In React 18 you use a `ref` and listen to the `input` event. React 19 handles custom-element properties and events natively, so the wrapper gets simpler. The official React guide covers refs, events, TypeScript JSX declarations and SSR ([mathlive.io](https://mathlive.io/mathlive/guides/react/)). Guide content beyond the outline is (unverified).
- **Load it client-only** (`next/dynamic` with `ssr: false`, or a lazy `import("mathlive")` on focus). At 222 KB gzip ([bundlephobia](https://bundlephobia.com/api/size?package=mathlive)) it must not be on every page. Only Plus users who reach an answer box or editor should pay that cost.
- **Security:** versions up to 0.109.2 had an HTML-escaping XSS fixed in 0.110.0 ([Patchstack](https://patchstack.com/database/npm/plugin/mathlive/vulnerability/npm-mathlive-s-lack-of-escaping-of-html-allows-for-xss-2)). Pin to 0.111.x or later.
- **Weekly downloads:** about 117k ([Snyk](https://security.snyk.io/package/npm/mathlive)).
- **Mobile:** the virtual keyboard is "mobile-ready" ([GitHub](https://github.com/arnog/mathlive)). Guess: on phones we should set it to show on focus and hide the OS keyboard, because many South African students work on phones. Test on low-end Android before launch.
- **Storage:** store the LaTeX string the field outputs. It drops into the existing markdown + TeX pipeline with no schema change. Optionally store MathJSON next to it for marking.

### How it fits the product

- **Student answer box (Plus):** a NUMERIC or SHORT_ANSWER question can be marked "maths answer". The runner shows a `<math-field>` instead of a text input. The answer is saved as LaTeX.
- **Tutor editor (Plus):** add an "Insert equation" button to `markdown-textarea.tsx`. It opens a MathLive popover and inserts `$...$` at the cursor. Tutors who know LaTeX keep typing it.
- **Free tier:** a plain text input with LaTeX preview, as today.

### Compute Engine (same author)

- `@cortex-js/compute-engine` parses LaTeX to MathJSON, simplifies, evaluates, and solves equations and systems ([mathlive.io](https://mathlive.io/compute-engine/)). MIT licence, version 0.192.0 ([npm](https://registry.npmjs.org/@cortex-js/compute-engine/latest)).
- The README example `solve("x^2 - 5x + 6 = 0", "x")` returns `[2, 3]` ([README](https://cdn.jsdelivr.net/npm/@cortex-js/compute-engine@0.59.0/README.md)). Which equation types it can solve is not documented (unverified).
- `isSame()` checks structure. `isEqual()` checks mathematical equality and can return `undefined` when it cannot decide ([guide](https://mathlive.io/compute-engine/guides/symbolic-computing/)).
- **Size warning:** 6.4 MB min, 1.88 MB gzip ([bundlephobia](https://bundlephobia.com/api/size?package=@cortex-js/compute-engine)). Do not ship it to browsers. Run it in a server action or route handler, where it does the marking anyway.

## 2. Rendering: KaTeX vs MathJax 3 vs MathJax 4

| | MathJax 3 (today) | MathJax 4 | KaTeX |
|---|---|---|---|
| Status | Superseded. We use 3.2.2 | 4.0.0 on 4 Aug 2025. Latest 4.1.3, 3 Jul ([GitHub releases](https://github.com/mathjax/MathJax/releases); 2025 date per [mathjax.org](https://www.mathjax.org/MathJax-v4.0.0-available/)) | 0.19.1, 23 Oct 2026 ([GitHub releases](https://github.com/KaTeX/KaTeX/releases)) |
| Licence | Apache-2.0 (unverified) | Apache-2.0 (unverified) | MIT ([npm](https://registry.npmjs.org/katex/latest)) |
| Speed | Asynchronous typeset after mount; we already had to work around re-typeset cost | Speech moved to a web worker ([mathjax.org](https://www.mathjax.org/MathJax-v4.0.0-available/)); no published benchmark found | Claims "the fastest math typesetting library for the web"; synchronous, no reflow ([katex.org](https://katex.org/)) |
| Server rendering | Possible in Node, but our setup is client-only | Node use is better documented, with ES and CommonJS builds ([mathjax.org](https://www.mathjax.org/MathJax-v4.0.0-available/), [docs](https://docs.mathjax.org/en/latest/server/start.html)) | `renderToString` in Node, send plain HTML ([katex.org](https://katex.org/)) |
| TeX coverage | Widest; autoloads mhchem, cancel, color, bbox, enclose, html, newcommand, unicode and more ([docs](https://docs.mathjax.org/en/v3.2/input/tex/extensions/autoload.html)) | Same, plus line breaking for display and inline maths ([mathjax.org](https://www.mathjax.org/MathJax-v4.0.0-available/)) | Narrower; see gaps below ([support table](https://katex.org/docs/support_table)) |
| Accessibility | Assistive MathML (the source of our CSS bug) | Expression explorer on by default, speech in a worker ([what's new](https://docs.mathjax.org/en/v4.0/upgrading/whats-new-4.0.html)) | Outputs HTML plus hidden MathML by default (`htmlAndMathml`) ([options](https://katex.org/docs/options)) |
| Bundle | ~CDN script (size unverified) | Can be self-hosted from npm (`mathjax` package, `@mathjax/src` replaces `mathjax-full`) ([what's new](https://docs.mathjax.org/en/v4.0/upgrading/whats-new-4.0.html)) | 260 KB min, 77 KB gzip JS, plus CSS and fonts ([bundlephobia](https://bundlephobia.com/api/size?package=katex)) |
| React wrapper | `better-react-mathjax` 2.x | `better-react-mathjax` 3.0.3 supports v4 and uses 4.1.0 by default ([GitHub](https://github.com/fast-reflexes/better-react-mathjax)). React 19 support not stated | `rehype-katex` in the react-markdown pipeline (unverified version) |

### KaTeX gaps that would break existing TeX

Per the [KaTeX support table](https://katex.org/docs/support_table):

| TeX | MathJax 3/4 | KaTeX | Risk for us |
|---|---|---|---|
| `\require{...}` | Yes | **Not supported** | High if old content or LLM imports use it |
| `\ce{}`, `\pu{}` (chemistry) | Autoloaded | Needs the separate mhchem script ([README](https://unpkg.com/katex@0.18.1/contrib/mhchem/README.md)) | Physical Sciences content |
| `\bbox`, `\enclose`, `\unicode`, `\class`, `\cssId` | Autoloaded | **Not supported** | Low |
| `\label`, `\ref`, `\eqref` | Yes | **Not supported** | Medium in long lessons |
| `eqnarray`, `multline` | Yes | **Not supported** | Medium: older authors use `eqnarray` |
| `\DeclareMathOperator`, `\mbox` | Yes | **Not supported** | Medium |
| `\href` | Yes | Needs `trust` turned on ([options](https://katex.org/docs/options)) | Low |
| `align`, `align*`, `alignat`, `gather`, `aligned`, `cases`, matrices, `\text`, `\operatorname`, `\cancel`, `\boxed`, `\color`, `\tag`, `\newcommand`, `\mathbb` | Yes | Yes | None |

KaTeX with `throwOnError: false` shows the unsupported command as red source text instead of crashing ([options](https://katex.org/docs/options)). That is still a visible break for students.

### Should we switch from MathJax?

**Not now.** Reasons:

1. Content compatibility. We cannot prove the corpus is KaTeX-safe without an audit. MathJax 4 keeps everything working.
2. Our pain was the MathJax 3 setup (wrong bundle, CDN, re-typeset cost), not MathJax itself. MathJax 4 plus `better-react-mathjax` 3 fixes the version and lets us self-host.
3. MathJax 4 adds line breaking for long equations ([mathjax.org](https://www.mathjax.org/MathJax-v4.0.0-available/)). That matters on phones.

**Upgrade path (small):**

- Bump `better-react-mathjax` to 3.x and set `version={4}`. Serve MathJax from our own static files, not cdnjs. Changing the URL from v3 to v4 also means dropping `/es5` ([mathjax.org](https://www.mathjax.org/MathJax-v4.0.0-available/)).
- Re-test the `mjx-assistive-mml` and SVG alignment rules in `globals.css`. v4 changed assistive MathML ([what's new](https://docs.mathjax.org/en/v4.0/upgrading/whats-new-4.0.html)).
- Update the "MathJax v3" text in `test-io.ts`.
- Guess: 1-2 days including visual checks.

**Later option:** pre-render TeX on the server (MathJax 4 in Node, or KaTeX with a MathJax fallback for the formulas KaTeX rejects). That removes the client typeset pass for read-only content such as the test runner and lesson view. Do it only after the corpus audit.

**Corpus audit (owner action, needs DB access):** a script that reads every lesson body, question, option and memo, extracts the TeX, and runs `katex.renderToString(tex, { throwOnError: true })`. It should count the failures by command. If failures are near zero, the KaTeX server render becomes attractive.

### MathLive's own renderer

MathLive renders math itself, including a static mode ([GitHub](https://github.com/arnog/mathlive)). Use it only inside the input field. Do not use it for page content, so there stays one rendering pipeline.

## 3. Natural-language problems ("find t for t^2 + 3t + 2 = 0")

### Local engines

| Engine | Licence | Solve | Notes |
|---|---|---|---|
| Cortex Compute Engine | MIT ([npm](https://registry.npmjs.org/@cortex-js/compute-engine/latest)) | Equations and systems ([docs](https://mathlive.io/compute-engine/)) | Reads LaTeX directly, pairs with MathLive. 1.88 MB gzip, so run it on the server |
| math.js | Apache-2.0 (unverified) | Docs list `simplify`, `derivative`, `rationalize`; no symbolic `solve` ([docs](https://mathjs.org/docs/expressions/algebra.html)) | Good numeric evaluator for tolerance checks |
| nerdamer-prime | MIT, 1.5.0 ([npm](https://registry.npmjs.org/nerdamer-prime/latest)) | Polynomials (scope per search, unverified) | Fork of nerdamer; the original is quiet |
| Algebrite | MIT, 1.4.0 ([npm](https://registry.npmjs.org/algebrite/latest)) | Simple polynomials only (unverified) | CoffeeScript port of EigenMath |
| SymPy via Pyodide | BSD (unverified) | Full CAS | First Pyodide load was 6.4 MB and 4-5 s to start, per an older roadmap ([Pyodide](https://pyodide-ryanking13.readthedocs.io/en/stable/project/roadmap.html)). The SymPy wheel alone is 5.9 MB ([MIT mirror](https://mirrors.mit.edu/sage/spkg/upstream/sympy/index.html)). Too heavy for phones; possible in a server function (unverified on Vercel) |

**None of these understand English.** "find t for ..." needs a parser in front. Options:

- A tiny rule parser for verbs like "solve", "find X for", "simplify", "differentiate", "factorise", followed by a LaTeX expression. Guess: this covers most tutor-authored prompts.
- An LLM that turns the sentence into `{ op: "solve", latex: "t^2+3t+2=0", var: "t" }`. Compute Engine then does the maths. The LLM never produces the answer, so it cannot get the arithmetic wrong.

### Wolfram|Alpha APIs

| Fact | Detail |
|---|---|
| APIs | Full Results, LLM API, Simple, Short Answers, Spoken Results, Fast Query Recognizer, Summary Boxes, Instant Calculators ([products page](https://products.wolframalpha.com/api)) |
| Free tier | 2,000 **non-commercial** calls per month ([products page](https://products.wolframalpha.com/api)) |
| Commercial price | Not published. "Standard API Pricing" is linked but shows no figures; custom pricing on request ([products page](https://products.wolframalpha.com/api)). The LLM API page mentions "low monthly plans" with no numbers ([LLM API docs](https://products.wolframalpha.com/llm-api/documentation)) |
| Bundled calls | A Mathematica industry plan lists 12,000 W\|A API calls a month ([wolfram.com](https://www.wolfram.com/mathematica/pricing/industry)) (unverified, from a search summary) |
| Caching | **Prohibited:** "Licensed Applications may not cache content generated by Wolfram\|Alpha" ([commercial terms](https://products.wolframalpha.com/api/commercial-termsofuse)) |
| Attribution | Must show "Computed by Wolfram\|Alpha" with a link, a dedicated display area in an agreed design, and the Input Interpretation pod ([commercial terms](https://products.wolframalpha.com/api/commercial-termsofuse)) |
| Billing | Monthly, on the number of successful queries ([commercial terms](https://products.wolframalpha.com/api/commercial-termsofuse)) |
| Show Steps | Not a separate product. It is a `podstate` on the Full Results API ([docs](https://products.wolframalpha.com/show-steps-api/documentation), [tutorial](https://martinheinz.dev/blog/36)). Users report step output sometimes missing ([Wolfram Community](https://community.wolfram.com/groups/-/m/t/3330117)) |
| LLM API | Plain-text result capped at 6,800 characters by default; GET with AppID ([LLM API docs](https://products.wolframalpha.com/llm-api/documentation)) |

**Input for Agent A:** paid use needs a sales quote. No caching means every student view is a billed call. The display and branding rules clash with our UI. Data goes to a US provider; check POPIA for minors' input.

### LLM only

- Good at reading the sentence and explaining steps. Not reliable for the final answer on its own. Guess: fine as a parser and explainer, wrong as the source of truth.
- Cost per call: **input for Agent A** (depends on model and provider choice; not researched here).

### Recommendation for this section

Use MathLive input, then Compute Engine on the server to solve and check. Add an optional LLM step that turns free text into a structured request and explains the steps, verified by the engine. Skip Wolfram|Alpha.

## 4. Bonus: checking maths answers for equivalence

Today (`src/features/assessments/lib/auto-grade.ts`):

- `SHORT_ANSWER` is a normalised string compare. `x+1` and `1+x` do not match.
- `NUMERIC` is `Number(a) === Number(key)`. No tolerance, no fractions (`1/2` gives `NaN`), no `\frac{1}{2}`.

Proposed checks, in order:

1. **NUMERIC:** parse both with Compute Engine (accepts `0.5`, `1/2`, `\frac12`, `5\times10^{-1}`). Compare with an absolute or relative tolerance the tutor sets. Default: exact, which is today's behaviour.
2. **Maths SHORT_ANSWER:** `expr.isEqual(key)` ([guide](https://mathlive.io/compute-engine/guides/symbolic-computing/)). If it returns `undefined`, use a numeric fallback: evaluate both at 5-10 random points for the free variables and compare within 1e-9. Guess: this catches nearly all equivalent forms with very few false passes.
3. **Form rules** the tutor can turn on: "must be simplified", "must be factorised" (`isSame()` against the canonical form), "accept equivalent forms".
4. **Equations and solution sets:** compare sets of roots, ignoring order (`t = -1, t = -2`).

Schema impact: a small `mathCheck` JSON on the question (`{ mode: "exact" | "equivalent" | "tolerance", tol?: number, form?: "any" | "simplified" | "factored" }`). Run it on the server inside the existing auto-grade. Prisma `db push` per project practice.

## Recommendation

- **Input:** MathLive 0.111.x, loaded only on the client and only for Plus answer boxes and the editor's equation popover. Fallback: a plain LaTeX text box with live preview (what free users get anyway). Not MathQuill: MPL-2.0, alpha versions, no keyboard.
- **Rendering:** stay on MathJax, upgrade to v4 self-hosted via `better-react-mathjax` 3. Reasons: zero content risk, line breaking on phones, better accessibility. Fallback or later step: KaTeX server rendering with MathJax for formulas KaTeX rejects, only after a corpus audit shows few failures.
- **Solving and checking:** Cortex Compute Engine on the server. Optional LLM front end to parse free text. Fallback: nerdamer-prime for polynomial solving if Compute Engine fails on a case. Not Wolfram|Alpha: no caching allowed, branding rules, prices not published.

## Open questions for the owner

1. May we run a read-only audit of all stored TeX (lessons, questions, memos) against KaTeX? It needs DB access, which this research did not have.
2. Should visual math input be Plus-only for tutors as well as students, or free for students answering a Plus tutor's test? (Gating by who owns the test seems fairer.)
3. Is a server-side maths check (Compute Engine in a server action) acceptable for latency during timed tests, or should we mark after submit only?
4. Do we want step-by-step explanations at all (LLM cost, risk of wrong steps shown to minors)?
5. Do you agree to dropping the cdnjs dependency and self-hosting MathJax 4?

## Sources

- https://github.com/arnog/mathlive (checked 2026-11-16)
- https://registry.npmjs.org/mathlive/latest (checked 2026-11-16)
- https://bundlephobia.com/api/size?package=mathlive (checked 2026-11-16)
- https://mathlive.io/mathlive/guides/react/ (checked 2026-11-16)
- https://patchstack.com/database/npm/plugin/mathlive/vulnerability/npm-mathlive-s-lack-of-escaping-of-html-allows-for-xss-2 (checked 2026-11-16)
- https://security.snyk.io/package/npm/mathlive (checked 2026-11-16)
- https://github.com/mathquill/mathquill (checked 2026-11-16)
- https://registry.npmjs.org/mathquill/latest (checked 2026-11-16)
- https://mathlive.io/compute-engine/ (checked 2026-11-16)
- https://mathlive.io/compute-engine/guides/symbolic-computing/ (checked 2026-11-16)
- https://cdn.jsdelivr.net/npm/@cortex-js/compute-engine@0.59.0/README.md (checked 2026-11-16)
- https://registry.npmjs.org/@cortex-js/compute-engine/latest (checked 2026-11-16)
- https://bundlephobia.com/api/size?package=@cortex-js/compute-engine (checked 2026-11-16)
- https://www.mathjax.org/MathJax-v4.0.0-available/ (checked 2026-11-16)
- https://docs.mathjax.org/en/v4.0/upgrading/whats-new-4.0.html (checked 2026-11-16)
- https://github.com/mathjax/MathJax/releases (checked 2026-11-16)
- https://docs.mathjax.org/en/v3.2/input/tex/extensions/autoload.html (checked 2026-11-16)
- https://docs.mathjax.org/en/latest/server/start.html (checked 2026-11-16)
- https://github.com/fast-reflexes/better-react-mathjax (checked 2026-11-16)
- https://katex.org/ (checked 2026-11-16)
- https://katex.org/docs/support_table (checked 2026-11-16)
- https://katex.org/docs/options (checked 2026-11-16)
- https://github.com/KaTeX/KaTeX/releases (checked 2026-11-16)
- https://registry.npmjs.org/katex/latest (checked 2026-11-16)
- https://bundlephobia.com/api/size?package=katex (checked 2026-11-16)
- https://unpkg.com/katex@0.18.1/contrib/mhchem/README.md (checked 2026-11-16)
- https://mathjs.org/docs/expressions/algebra.html (checked 2026-11-16)
- https://registry.npmjs.org/nerdamer-prime/latest (checked 2026-11-16)
- https://registry.npmjs.org/algebrite/latest (checked 2026-11-16)
- https://pyodide-ryanking13.readthedocs.io/en/stable/project/roadmap.html (checked 2026-11-16)
- https://mirrors.mit.edu/sage/spkg/upstream/sympy/index.html (checked 2026-11-16)
- https://products.wolframalpha.com/api (checked 2026-11-16)
- https://products.wolframalpha.com/llm-api/documentation (checked 2026-11-16)
- https://products.wolframalpha.com/api/commercial-termsofuse (checked 2026-11-16)
- https://products.wolframalpha.com/show-steps-api/documentation (checked 2026-11-16)
- https://martinheinz.dev/blog/36 (checked 2026-11-16)
- https://community.wolfram.com/groups/-/m/t/3330117 (checked 2026-11-16)
- https://www.wolfram.com/mathematica/pricing/industry (checked 2026-11-16)
