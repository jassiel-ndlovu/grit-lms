# Graphing

Checked: 2026-11-16. Author: Agent B research (subagent).

## Bottom line

- **Pick Mafs for both uses** (lesson graphs and graph answers). It is MIT, made of React components, SVG-based, about 95 KB gzip including KaTeX, and has draggable points with constraints and arrow-key control.
- **Fallback: JSXGraph** (MIT/LGPL, mature, multi-touch, keyboard and ARIA, geometry and 3D). Use it if Mafs stalls or we need constructions such as circles through points, loci or 3D.
- **Avoid GeoGebra and Desmos for a paid product.** GeoGebra needs a commercial licence. Desmos needs a per-partner API key under terms we could not read.
- **Store every graph as our own small JSON spec**, not a library's state blob. Checking a graph answer is then a pure function on the server (point within tolerance, line slope and intercept, parabola vertex and shape).

## What we need

1. **Lesson graphs.** A tutor puts a graph in a lesson or question: static (y = x², shaded region) or interactive (a slider for `a` in y = a·x²). It must look right on phones, render fast, and work with the markdown pipeline (`src/app/components/markdown.tsx`).
2. **Graph as an answer type.** The student plots a point, draws a line through two points, or drags a parabola. The answer is marked automatically. This is a new question type next to NUMERIC and the others. Plus tier.

## Options

| | Mafs | JSXGraph | function-plot | Plotly.js | GeoGebra Apps API | Desmos API |
|---|---|---|---|---|---|---|
| Licence | MIT ([npm](https://registry.npmjs.org/mafs/latest)) | LGPL and MIT dual ([jsxgraph.org](https://jsxgraph.org/home/)) | MIT ([GitHub](https://github.com/mauriciopoppe/function-plot)) | MIT ([GitHub](https://github.com/plotly/plotly.js)) | Free for **non-commercial** use only; commercial use "requires a special license" ([licence](https://www.geogebra.org/license)) | API key required; terms page did not load for us (unverified) ([API docs](https://www.desmos.com/api)) |
| Cost | Free | Free | Free | Free | "Moderate license fee", no figure ([licence](https://www.geogebra.org/license)) | Unknown; partners get individual keys ([notice](https://groups.google.com/g/desmos-api-announce/c/fAvghiKr3uQ)) |
| Version | 0.21.0 ([npm](https://registry.npmjs.org/mafs/latest)) | 1.14.3 ([jsxgraph.org](https://jsxgraph.org/home/)) | 1.26.0 ([bundlephobia](https://bundlephobia.com/api/size?package=function-plot)) | 4.3.0 ([bundlephobia](https://bundlephobia.com/api/size?package=plotly.js-dist-min)) | Loaded from GeoGebra servers (unverified) | v1.12 docs page; v1.13 docs exist ([v1.13](https://www.desmos.com/api/v1.13/docs/index.html)) |
| Bundle (gzip) | 95 KB ([bundlephobia](https://bundlephobia.com/api/size?package=mafs)), includes KaTeX as a dependency ([npm](https://registry.npmjs.org/mafs/latest)) | 259 KB ([bundlephobia](https://bundlephobia.com/api/size?package=jsxgraph)) | 45 KB ([bundlephobia](https://bundlephobia.com/api/size?package=function-plot)) | 1.41 MB for the min dist ([bundlephobia](https://bundlephobia.com/api/size?package=plotly.js-dist-min)) | Large remote script (unverified) | Remote script (unverified) |
| Rendering | SVG | SVG (Canvas optional, unverified) | SVG via D3 ([GitHub](https://github.com/mauriciopoppe/function-plot)) | SVG/WebGL | Canvas (unverified) | Canvas (unverified) |
| React | Native React components; peer `react >=18` ([npm](https://registry.npmjs.org/mafs/latest)) | Imperative; mount in `useEffect` with a ref. No official React wrapper (unverified) | Imperative, D3 | `react-plotly.js` wrapper (unverified) | Imperative, `deployggb.js` or `mathApps.create().inject()` ([Apps API](https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_API/)) | Imperative, script tag with key ([API docs](https://www.desmos.com/api)) |
| SSR | Guess: SVG from React, should server-render (unverified) | No (needs the DOM) | No | No | No | No |
| Interactivity | `MovablePoint` with horizontal, vertical or custom `constrain` function ([Mafs docs](https://mafs.dev/guides/interaction/movable-points)) | Full dynamic geometry, sliders, gliders, constructions ([jsxgraph.org](https://jsxgraph.org/home/)) | Zoom and pan, re-evaluates on zoom ([GitHub](https://github.com/mauriciopoppe/function-plot)) | Hover, zoom; not built for dragging maths objects | Full geometry and CAS | Full calculator |
| Touch | Uses `@use-gesture/react` ([npm](https://registry.npmjs.org/mafs/latest)); touch not stated in docs (unverified) | Multi-touch ([jsxgraph.org](https://jsxgraph.org/home/)) | Mouse-focused (unverified) | Yes (unverified) | Yes (unverified) | Yes (unverified) |
| Accessibility | Points move with arrow keys ([Mafs docs](https://mafs.dev/guides/interaction/movable-points)) | Board `keyboard` option since 1.3.0; per-element `aria` labels and `aria-live` ([accessibility](https://jsxgraph.uni-bayreuth.de/home/documentation/accessibility/), [example](https://jsxgraph.uni-bayreuth.de/share/example/screen-reader)) | Weak (unverified) | Basic (unverified) | (unverified) | Strongest: braille modes, audio trace, graph descriptions ([API docs](https://www.desmos.com/api)) |
| Saved state | Our own JSON (we own all state) | Our own JSON | Its config object | Its figure JSON | Base64 `.ggb`, XML, or `getFileJSON` ([Apps API](https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_API/)) | `getState()` object, which docs say to treat as opaque ([API docs](https://www.desmos.com/api)) |
| Popularity | ~3.5k GitHub stars ([GitHub](https://github.com/stevenpetryk/mafs)) | Long-running university project ([jsxgraph.org](https://jsxgraph.org/home/)) | | | | |

### Notes per option

- **Mafs.** It fits our stack best: plain React, Tailwind-friendly SVG, small. Risks: it is still 0.x, a small project, and its last release date was not confirmed (unverified). It uses KaTeX for labels, not MathJax. Guess: plain text labels or a MathJax overlay are fine for v1. If we ever move rendering to KaTeX (see `02-math-input-rendering.md`), this goes away. It covers functions, points, vectors, polygons and movable points, which is all the school graphing we need.
- **JSXGraph.** The most capable free option. It handles geometry constructions, conics, sliders and 3D, and has the best documented keyboard and ARIA story among the free libraries. Its imperative API needs a thin React wrapper that creates the board in `useEffect` and destroys it on unmount. It is 2.7 times the size of Mafs ([bundlephobia](https://bundlephobia.com/api/size?package=jsxgraph)).
- **function-plot.** Small and quick for "plot this f(x)", but it is a plotter, not an answer tool. No movable points.
- **Plotly.js.** For data charts (statistics lessons, analytics dashboards), not for maths answers. 1.4 MB gzip ([bundlephobia](https://bundlephobia.com/api/size?package=plotly.js-dist-min)) is too heavy for students on mobile data.
- **GeoGebra.** Best maths content and CAS, and tutors know it. Commercial use requires a "License and Collaboration Agreement" ([licence](https://www.geogebra.org/license)). Nexa sells Plus and Pro tiers, so that applies. Its state is a binary `.ggb` or XML, which we cannot check easily. **Input for Agent A:** licence cost unknown; ask office@geogebra.org.
- **Desmos.** Best accessibility, and students know it. Production use needs our own API key, and the generic demo key is being retired ([notice](https://groups.google.com/g/desmos-api-announce/c/fAvghiKr3uQ)). The API terms page did not render for our fetch, so commercial terms are (unverified). State is opaque ([API docs](https://www.desmos.com/api)), so marking would mean reading expressions back out of it. **Input for Agent A:** the API terms and any partner fee need checking by a person.

Simple embed option: a tutor can still paste a link to a public Desmos or GeoGebra graph as an ordinary link in a lesson. That needs no API and no licence from us. Guess: allowing iframes of those sites is a separate decision on CSP and privacy (Agent A).

## Use (a): graphs inside lessons

- Author a graph in a small editor: add a function (typed as LaTeX or an expression), points, segments, a shaded region, axes range and grid. The editor shows a Mafs live preview.
- Store it as a fenced block in the existing markdown, so no schema change:

````markdown
```graph
{ "v": 1, "view": { "x": [-5, 5], "y": [-2, 10] }, "items": [ { "kind": "fn", "expr": "x^2", "color": "blue" } ] }
```
````

- In `markdown.tsx`, the `code` override already branches on `language-*`. Add `language-graph`: parse the JSON and render `<GraphView spec={...} />`, loaded with `next/dynamic` so lessons without graphs do not pay the cost. MathJax already skips `pre` and `code` (`math-provider.tsx`), so the JSON is safe from typesetting.
- Interactive lesson graphs use a `slider` item (`{ "kind": "slider", "name": "a", "min": -3, "max": 3 }`) and expressions that refer to it.
- Accessibility: every graph spec carries a required `alt` text written by the tutor, rendered as `aria-label` or `figcaption`. Guess: a generated description ("parabola, vertex (0,0), opens up") is a nice follow-up.

## Use (b): graphing as an answer type

New question type `GRAPH` (Plus). The tutor sets a task and a key. The student gets a Mafs board with tools limited to what the task needs.

| Task | Student does | Stored answer | Auto-check |
|---|---|---|---|
| Plot a point | Drag one point (snap to grid optional) | `{ "points": [[2, 3]] }` | Distance to key ≤ tol |
| Plot several points | Drag N points | `{ "points": [[...], ...] }` | Set match, order ignored, each ≤ tol |
| Draw a line | Drag two points | `{ "line": [[x1,y1],[x2,y2]] }` | Slope and intercept within tol, or both key points lie on the line. Vertical lines handled by comparing x |
| Line segment or ray | Two points | as above | Endpoints match (order ignored for segments) |
| Parabola | Drag vertex and one other point | `{ "parabola": { "vertex": [h,k], "point": [x,y] } }` | Derive `a` from the second point; compare h, k, a within tol |
| Other functions (exp, abs, sine) | Drag two to three handles | `{ "fn": "abs", "handles": [...] }` | Fit parameters, compare to key |
| Inequality region | Pick boundary plus side | `{ "boundary": ..., "side": "above" }` | Boundary check plus sample-point test |

The constraint function on `MovablePoint` ([Mafs docs](https://mafs.dev/guides/interaction/movable-points)) does grid snapping and keeps the parabola handle off the vertex's vertical line. Arrow keys give a keyboard path for students who cannot drag.

Marking runs on the server in `src/features/assessments/lib/auto-grade.ts` as a new `case "GRAPH"`. Pure maths on numbers; no library needed on the server. Partial credit is possible (for example vertex right but `a` wrong) as a later option.

### Proposed JSON spec (shared by both uses)

```jsonc
{
  "v": 1,
  "alt": "Graph of y = x^2 - 4 with roots at -2 and 2",
  "view": { "x": [-6, 6], "y": [-6, 6], "grid": 1, "snap": 0.5 },
  "items": [
    { "id": "f", "kind": "fn", "expr": "x^2 - 4", "color": "blue", "label": "f(x)" },
    { "id": "A", "kind": "point", "at": [2, 0], "label": "A" },
    { "id": "s", "kind": "segment", "from": [0, 0], "to": [2, 0] },
    { "id": "a", "kind": "slider", "name": "a", "min": -3, "max": 3, "step": 0.5, "value": 1 }
  ],
  // only on GRAPH questions
  "task": {
    "type": "parabola",          // point | points | line | segment | parabola | fn | region
    "tools": ["move"],
    "start": { "vertex": [0, 0], "point": [1, 1] },
    "key": { "vertex": [1, -4], "a": 1 },
    "tol": 0.25
  }
}
```

- Lesson graphs: stored inside the markdown fence (see above).
- Question graphs: the prompt graph in the question markdown. The `task.key` goes into the existing answer-key storage (`answer-key.ts` and `answer-key-store.ts`), so the key never reaches the student. The student answer is a JSON value in the submission, like MATCHING and REORDER today.
- Expressions in `expr` are parsed with a safe expression parser, never `eval`. Guess: math.js `compile` or Compute Engine on the server; a small parser on the client for plotting.
- `v` allows migrations later. The spec does not depend on the library, so switching Mafs to JSXGraph only changes the renderer.

## Effort (Guess)

- Lesson `graph` fence plus viewer and a basic editor: 4-6 days.
- GRAPH question type for point, line and parabola with auto-marking: 5-8 days, including the test runner, review and grading pages.

## Recommendation

- **(a) Lesson graphs: Mafs**, rendered from our JSON spec inside a `graph` fence in markdown. Reasons: React-native, MIT, about 95 KB gzip, SVG that looks sharp on phones, and the same library as the answer type. **Fallback: JSXGraph** if we need geometry constructions or 3D. Plotly only for data or statistics charts, if ever.
- **(b) Graph answers: Mafs** `MovablePoint` with `constrain`, marked by our own server-side checks on the stored JSON. **Fallback: JSXGraph**, which has stronger touch and ARIA support and the same "own JSON in, own JSON out" model.
- Not GeoGebra or Desmos inside the product: commercial licence or unknown terms, and their state formats are hard to auto-mark. Allow plain links to them in lessons.

## Open questions for the owner

1. Is Mafs' 0.x status and small team acceptable, given that the JSON spec keeps a switch to JSXGraph cheap?
2. Should lesson graphs be free (any tutor) and only the GRAPH answer type be Plus? The plan lists "graphing" under Plus without splitting the two.
3. Which answer tasks are needed first? Suggest point, line and parabola (CAPS Grade 9-12 functions), then hyperbola and exponential.
4. Do you want someone to contact GeoGebra or Desmos about terms anyway? Tutors may ask for them by name.
5. Should graph labels support TeX in v1 (Mafs uses KaTeX, the rest of the app MathJax), or plain text only?

## Sources

- https://mafs.dev/ (checked 2026-11-16)
- https://mafs.dev/guides/interaction/movable-points (checked 2026-11-16)
- https://github.com/stevenpetryk/mafs (checked 2026-11-16)
- https://registry.npmjs.org/mafs/latest (checked 2026-11-16)
- https://bundlephobia.com/api/size?package=mafs (checked 2026-11-16)
- https://jsxgraph.org/home/ (checked 2026-11-16)
- https://jsxgraph.uni-bayreuth.de/home/documentation/accessibility/ (checked 2026-11-16)
- https://jsxgraph.uni-bayreuth.de/share/example/screen-reader (checked 2026-11-16)
- https://bundlephobia.com/api/size?package=jsxgraph (checked 2026-11-16)
- https://github.com/mauriciopoppe/function-plot (checked 2026-11-16)
- https://bundlephobia.com/api/size?package=function-plot (checked 2026-11-16)
- https://github.com/plotly/plotly.js (checked 2026-11-16)
- https://bundlephobia.com/api/size?package=plotly.js-dist-min (checked 2026-11-16)
- https://www.geogebra.org/license (checked 2026-11-16)
- https://geogebra.github.io/docs/reference/en/GeoGebra_Apps_API/ (checked 2026-11-16)
- https://www.desmos.com/api (checked 2026-11-16)
- https://www.desmos.com/api/v1.13/docs/index.html (checked 2026-11-16)
- https://www.desmos.com/api-terms (checked 2026-11-16; page did not render for fetch)
- https://groups.google.com/g/desmos-api-announce/c/fAvghiKr3uQ (checked 2026-11-16)
