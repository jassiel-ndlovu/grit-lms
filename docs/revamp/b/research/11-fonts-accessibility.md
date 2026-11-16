# Fonts and accessibility (Geist, WCAG 2.2 AA, math)

Checked: 2026-11-16. Author: Agent B research (subagent).

## Bottom line

- Geist Sans and Geist Mono are free under the SIL OFL 1.1 and ship as variable fonts (wght 100 to 900) through `next/font/google`. That route replaces Inter and JetBrains Mono with no new dependency.
- Five of our proposed colour tokens fail WCAG 2.2 AA as text. They are the muted grey `#787774`, the accent `#2F6FEB` on the `#F7F7F5` panel, amber `#CB912F` everywhere, red `#E03E3E`, and every tinted chip except green. Each has a drop-in fix in the tables below.
- The border `#E9E9E7` (1.22:1) is fine for dividers and cards. It is not fine as the only outline of an input, checkbox or radio, which needs 3:1. Use `#8F8F8B` for those outlines.
- Technical mode's 28px rows pass 2.5.8 (24px minimum). Icon buttons inside them must still be at least 24x24, or spaced so they pass.
- Two real gaps in today's code: the legacy REORDER input is drag-only (fails 2.1.1 and 2.5.7), and timed tests auto-submit with no extension or accommodation path (2.2.1).

## 1. Geist Sans and Geist Mono

| Item | Finding |
|---|---|
| Licence | SIL Open Font License 1.1 ([vercel.com/font](https://vercel.com/font), [geist-font repo](https://github.com/vercel/geist-font)). Free for commercial use, self-hosting and bundling. |
| Families | Sans, Mono, Serif and Pixel. Sans and Mono have 9 weights each ([vercel.com/font](https://vercel.com/font)). |
| Variable | Google Fonts serves Geist and Geist Mono as variable fonts with one `wght` axis, 100 to 900 ([Geist METADATA.pb](https://raw.githubusercontent.com/google/fonts/main/ofl/geist/METADATA.pb), [Geist Mono METADATA.pb](https://raw.githubusercontent.com/google/fonts/main/ofl/geistmono/METADATA.pb)). |
| Subsets on Google Fonts | Geist: latin, latin-ext, cyrillic, cyrillic-ext, vietnamese. Geist Mono adds symbols2 ([Geist METADATA](https://raw.githubusercontent.com/google/fonts/main/ofl/geist/METADATA.pb), [Mono METADATA](https://raw.githubusercontent.com/google/fonts/main/ofl/geistmono/METADATA.pb)). |
| Glyph counts | Sans 652 glyphs (387 Latin). Mono 669 (386 Latin) ([vercel.com/font](https://vercel.com/font)). |
| npm package | `geist` 1.9.2, OFL, peer `next >=13.2.0`. It exports `geist/font/sans`, `geist/font/mono` and `-non-variable` variants ([npm registry](https://registry.npmjs.org/geist/latest)). |
| Tabular numerals | Geist has `tnum` and slashed zero `zero`, both off by default ([Lexington Themes guide](https://lexingtonthemes-com.pages.dev/blog/geist-opentype-features), [fontalternatives comparison](https://fontalternatives.com/blog/geist-vs-inter-vs-satoshi-product-ui/)). The same guide says the Google Fonts build lacks the stylistic sets ([guide](https://lexingtonthemes-com.pages.dev/blog/geist-opentype-features)). Whether `tnum` survives in the Google build is (unverified). |

### next/font/google or the `geist` package

`next/font/google` downloads the font at build time and self-hosts it. "No requests are sent to Google by the browser" ([Next.js font docs](https://nextjs.org/docs/app/api-reference/components/font)). Geist and Geist_Mono are both available there ([vercel.com/font](https://vercel.com/font)).

| Option | Pros | Cons |
|---|---|---|
| `next/font/google` (`Geist`, `Geist_Mono`) | Same pattern as today's `Inter` and `JetBrains_Mono` in `src/app/layout.tsx`. No new dependency. Subset control (`latin`, `latin-ext`). | Google build may lack some OpenType features (stylistic sets for sure, `tnum` unverified). |
| `geist` npm package | Full OpenType tables per the third-party guide. Officially recommended by Vercel for Next.js (unverified on an official page). | New dependency, needs owner approval. The bundled files may not be subset by script (unverified). |

Recommendation: start with `next/font/google`, load `subsets: ["latin", "latin-ext"]`, and add a one-line test that renders `font-variant-numeric: tabular-nums` and checks the digit widths match. If `tnum` is missing, switch to the `geist` package. This is a small change either way.

Code impact in `src/app/layout.tsx`: swap `Inter` for `Geist` (`variable: "--font-sans-src"`) and `JetBrains_Mono` for `Geist_Mono`. Decide whether Fraunces stays for display. Also note that `globals.css` sets `--font-mono: var(--font-mono), ...` inside the theme while the loader also sets `--font-mono`. That is self-referential. Rename the loader variable (for example `--font-geist-mono`) during the swap. Drop the Inter-only `font-feature-settings: "cv11", "ss01", "ss03"` line in `globals.css`. Those features mean different things in Geist.

### Glyph coverage for South African languages

| Language | Characters beyond ASCII | Covered? |
|---|---|---|
| Afrikaans | ê ë è é î ï ô ö û ü á and the `'n` article (apostrophe + n) | Latin-1 vowels are in the basic `latin` subset. Guess: covered. The legacy single glyph ŉ (U+0149) is deprecated in Unicode and should not be used. Write `'n` instead. |
| isiZulu, isiXhosa | Basic Latin. Some dictionaries use tone marks (á à) | Covered by `latin` (Guess). |
| Sesotho (South Africa) | Basic Latin. Lesotho orthography and some texts use ê ô | Covered by `latin` (Guess). |
| Sepedi (Sesotho sa Leboa), Setswana | š (Sepedi), ê ô (Setswana) | š is in Latin Extended-A, so it needs the `latin-ext` subset, which Geist has ([METADATA](https://raw.githubusercontent.com/google/fonts/main/ofl/geist/METADATA.pb)). |
| Tshivenda | ḓ ḽ ṅ ṋ ṱ (dot or circumflex below) | Latin Extended Additional. Geist has the `vietnamese` subset, which covers many of these (Guess). Exact presence is (unverified). |

None of the official pages list languages by name ([vercel.com/font/geist](https://vercel.com/font/geist)). Action: add a fixture page with one pangram per official language (11 languages) and check it visually in Simple and Technical mode before launch. If a glyph is missing the browser falls back to the system font for that one character. This works but looks uneven.

### Geist next to MathJax

Today MathJax 3.2.2 `tex-svg` loads from cdnjs (`src/app/components/math-provider.tsx`). The SVG output draws glyphs as paths with MathJax's own TeX fonts, so math never uses Geist (standard MathJax SVG behaviour, not re-checked in docs today: (unverified)). Practical points:

- MathJax's TeX fonts are a serif Computer Modern style. Next to a geometric sans they look heavier. Set `font-size` on the math container to about 105% of body text in Simple (14px) and Technical (13px) mode. Guess, tune by eye.
- Use Geist Mono with `tnum` for marks, timers and table numbers. Do not use it for inline math.
- MathJax 4 is current on npm (4.1.3, Apache-2.0, [npm registry](https://registry.npmjs.org/mathjax/latest)). In v4, speech and the explorer are "included and enabled in all the combined components" ([MathJax docs](https://docs.mathjax.org/en/latest/basic/accessibility.html)). Upgrading from 3.2.2 is the cheapest accessibility win in this file.

## 2. Colour contrast (WCAG 2.2 AA)

### Method

WCAG relative luminance: convert each sRGB channel `c` (0 to 1) with `c/12.92` if `c <= 0.04045`, else `((c+0.055)/1.055)^2.4`. Then `L = 0.2126 R + 0.7152 G + 0.0722 B`. Contrast ratio = `(L_light + 0.05) / (L_dark + 0.05)`. Thresholds: 4.5:1 for body text, 3:1 for large text (24px, or 18.66px bold) and for non-text UI parts ([WCAG 1.4.11 Understanding](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).

Worked example, `#787774` on `#FFFFFF`:

- R = 0x78 = 120/255 = 0.4706 → ((0.4706+0.055)/1.055)^2.4 = 0.1878
- G = 0x77 = 119/255 = 0.4667 → 0.1845
- B = 0x74 = 116/255 = 0.4549 → 0.1746
- L = 0.2126(0.1878) + 0.7152(0.1845) + 0.0722(0.1746) = 0.0399 + 0.1320 + 0.0126 = 0.1845
- Contrast = (1.00 + 0.05) / (0.1845 + 0.05) = 1.05 / 0.2345 = **4.48**. Just under 4.5, so it fails.

Luminance values used: `#37352F` 0.0356, `#787774` 0.1845, `#FFFFFF` 1.0000, `#F7F7F5` 0.9289, `#E9E9E7` 0.8137, `#2F6FEB` 0.1797, `#C2410C` 0.1528, `#0F7B6C` 0.1535, `#CB912F` 0.3315, `#E03E3E` 0.1964. All ratios below are computed with a script (Python, same formula). Chip backgrounds are the status colour at 10% opacity over white.

### Text tokens

| Token | On #FFFFFF | On #F7F7F5 | Verdict | Fix |
|---|---|---|---|---|
| Ink `#37352F` | 12.26 | 11.43 | Pass | None |
| Muted `#787774` | **4.48** | **4.17** | Fail both | `#6F6E69`: 5.11 / 4.76. Pass |
| Accent `#2F6FEB` as text/link | 4.57 | **4.26** | Fails on panel | `#2563EB`: 5.17 / 4.82. Pass |
| White on accent `#2F6FEB` | 4.57 | n/a | Pass (narrow) | `#2563EB` gives 5.17 with more margin |
| Accent 2 `#C2410C` as text | 5.18 | 4.83 | Pass | None |
| White on `#C2410C` | 5.18 | n/a | Pass | None |

### Non-text (1.4.11, 3:1)

| Pair | Ratio | Verdict |
|---|---|---|
| Border `#E9E9E7` on white | **1.22** | Fine for dividers, card edges, table rules (decorative). Fails if it is the only thing that shows an input exists ([1.4.11 Understanding](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)). |
| Border `#E9E9E7` on `#F7F7F5` | 1.13 | Same |
| Proposed control outline `#8F8F8B` | 3.25 on white, 3.03 on `#F7F7F5` | Pass. Use for input, checkbox, radio, switch-off outlines. |
| Focus ring `#2F6FEB` on white | 4.57 | Pass. Use `#2563EB` on the `#F7F7F5` panel (4.82). |
| Focus ring `#2F6FEB` on `#E9E9E7` (selected row) | 3.76 | Pass |

### Status colours

| Status | As text on white | On `#F7F7F5` | White text on solid chip | Same-hue text on 10% chip | Verdict | Fix |
|---|---|---|---|---|---|---|
| Green `#0F7B6C` | 5.16 | 4.81 | 5.16 | 4.51 (15% tint: 4.19) | Pass, but chip is on the edge | Chip text `#0B6E60`: 5.22 on a 12% tint |
| Amber `#CB912F` | **2.75** | **2.57** | **2.75** | **2.52** | Fails everywhere | Text `#8A6116`: 5.52 / 5.15. On 12% amber chip 4.96. White on `#8A6116` 5.52. Keep `#CB912F` only for icons next to text, or for large shapes (fails 3:1 too, so pair with text) |
| Red `#E03E3E` | **4.26** | **3.97** | **4.26** | **3.72** | Fails | Text `#C53030`: 5.47 / 5.10. On 12% red chip 4.64. White on `#C53030` 5.47 |
| Accent chip `#2F6FEB` | | | | 4.03 | Fails | Chip text `#1D4ED8`: 5.75 on a 12% blue tint, 6.70 on white |
| Accent 2 chip `#C2410C` | | | | 4.48 | Fails (narrow) | Chip text `#9A3412`: 6.14 on a 12% tint |

Rule for the token file: each status has two values, a `fg` for text and icons (darker) and a `bg` tint. Never put the base hue as text on its own tint. Dark mode needs its own pass. It was not checked here.

## 3. WCAG 2.2 criteria that affect us

New in 2.2: 2.4.11, 2.4.12, 2.4.13, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8, 3.3.9. 4.1.1 Parsing was removed ([W3C What's new in 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)).

| SC | Level | What it asks | Where it bites us | Action |
|---|---|---|---|---|
| 2.5.8 Target Size (Minimum) | AA | 24x24 CSS px, or a 24px circle spacing test, with inline and equivalent exceptions ([Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)) | Technical mode rows are 28px tall, so a full-row click target passes. Icon buttons in a row (edit, delete, kebab) are often 20px. Today's shadcn `sm` button is `h-8` (32px) and `icon` is `size-9` (36px) in `src/components/ui/button.tsx`, so both pass. | Minimum icon button 24x24 in Technical mode, 32x32 in Simple. Add a lint or test that flags any `size-5` or `h-5` interactive element. Checkboxes in 28px rows: make the whole cell the label. |
| 2.4.11 Focus Not Obscured (Minimum) | AA | Focused item must not be fully hidden by author content ([What's new](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)) | A sticky header plus a 36px sticky ribbon can cover a focused row when tabbing down a long table or question list. | Set `scroll-padding-top` on `html` to header height + ribbon height (CSS variable). Same for the test runner's sticky question strip. |
| 2.4.13 Focus Appearance | AAA | Indicator area at least a 2px perimeter and 3:1 change ([Understanding 2.4.13](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)) | Not required for AA, but cheap. | Use a 2px `#2563EB` ring with 2px offset in both modes. It meets 2.4.13 on white and `#F7F7F5`. Do not drop to 1px in Technical mode. |
| 2.5.7 Dragging Movements | AA | Every drag needs a single-pointer alternative ([What's new](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)) | Legacy `src/app/dashboard/tests/components/question-input.tsx` REORDER uses native HTML5 drag only. It fails 2.5.7 and 2.1.1 (no keyboard). The new `question-renderer.tsx` REORDER uses up/down buttons and passes, but the buttons show only "↑"/"↓" with no `aria-label`. `src/components/tree-reorder-dialog.tsx` uses dnd-kit with `KeyboardSensor`. Keyboard is not a pointer alternative, so it still needs buttons or a "Move to..." menu. dnd-kit's keyboard sensor uses Space/Enter and arrows ([dnd-kit docs](https://dndkit.com/api-documentation/sensors/keyboard)). | Delete the legacy renderer or route it to the new one. Add `aria-label="Move item 2 up"`. Add Move up / Move down / Move to position to the tree reorder dialog and to lesson and question reordering in the designer. |
| 3.2.6 Consistent Help | A | Help shown on many pages appears in the same relative order ([What's new](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)) | Today help is a header icon and a nav item. The new header must keep help in one fixed slot on every page, including the test runner and parent portal. | Put help in the same header slot everywhere. If the test runner hides it, hide it on all runner pages the same way. |
| 3.3.7 Redundant Entry | A | Don't ask again for data already entered in the same process ([What's new](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)) | Multi-step flows: parent sign-up then child linking, course create then first lesson, test settings wizard. | Prefill or offer "same as above". Keep wizard state across steps. |
| 3.3.8 Accessible Authentication (Minimum) | AA | No cognitive test to log in unless there is a mechanism. Password managers and paste count. Email link login is a sufficient technique. WebAuthn device sign-in is not a cognitive test ([Understanding 3.3.8](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html)) | `src/lib/auth.ts` uses `CredentialsProvider`. Passes if the password field allows paste and autofill. No CAPTCHA was found in `src`. | Keep `autocomplete="current-password"` and never block paste. Consider email magic link as an option for parents and young students. Any future CAPTCHA must be object recognition at most. |
| 2.2.1 Timing Adjustable | A | Turn off, adjust to 10x, or warn and extend (20 s, 10 times). Exceptions: real-time, essential, over 20 hours. The Understanding page gives "granting double time on a test" as a third party adjusting the limit ([Understanding 2.2.1](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html)) | `test-runner.tsx` computes `startedAt + timeLimit*60s` and auto-submits at zero. There is no per-student extra time. Claiming "essential" is weak for most tutoring quizzes. | Add per-student time accommodation (for example 1.25x, 1.5x, 2x, or no limit) set by the tutor on the enrolment or the test assignment. Show a warning at 5 min and 1 min with `aria-live="polite"`. Don't announce every second. Lockdown (Pro) tests still honour accommodations. |
| 1.4.11 Non-text Contrast | AA | See table above | Input outlines | `#8F8F8B` outlines |
| 1.4.3 Contrast (Minimum) | AA | See tables above | Muted text, amber, red, chips | Token fixes above |

## 4. Math accessibility

| Tool | What it gives | Status here |
|---|---|---|
| MathJax 4 speech + explorer | Speech strings in `aria-label` and `aria-braillelabel`. An explorer to walk an expression term by term. Enabled in all combined components in v4. Assistive MathML is off by default in v4. NVDA users may need "Combine with Speech" for Braille ([MathJax docs](https://docs.mathjax.org/en/latest/basic/accessibility.html)). | We run 3.2.2. In v3, screen-reader support depended on assistive MathML ([same page](https://docs.mathjax.org/en/latest/basic/accessibility.html)). Upgrade to v4. Check that `better-react-mathjax` supports v4 (unverified), or load MathJax ourselves. |
| MathLive (Plus tier, visual math input) | Has keyboard editing and a virtual keyboard. Its accessibility guide URL returned 404 on 2026-11-16, so its screen-reader support is (unverified). | Spike: test with NVDA and VoiceOver before promising it to schools. Always keep a plain TeX text field as the fallback input. |
| Our markdown pipeline | TeX inside markdown, rendered by `src/app/components/markdown.tsx`. | Make sure each rendered math node is focusable only when the explorer is on, so Tab order in the test runner doesn't stop on every formula. |

Practical rules:

- Every question with an image of a formula needs alt text in TeX or words. Better: replace the image with TeX.
- NUMERIC answers: accept `,` and `.` as decimal separators (South African schools use the comma). This is a 3.3.x error-prevention issue as much as a locale issue.
- Show the student's typed TeX rendered live under the input so the student can check it. Use `aria-describedby` to link the preview.

## 5. Mode-specific checklist

| Check | Simple (14px, 8px radius) | Technical (13px, 2px radius, 28px rows) |
|---|---|---|
| Body text contrast | Ink and fixed muted tokens pass | Same tokens. 13px is not "large", so 4.5:1 applies. |
| Target size | 32px minimum controls (comfort) | 24px minimum. Row height 28px passes. |
| Focus ring | 2px ring, 2px offset | Same. Don't thin it. |
| Reflow (1.4.10) at 320px | Expected fine | Wide tables must scroll inside their own container, not the page. `dashboard-shell.tsx` already sets `min-w-0` on `main` for this. |
| Text spacing (1.4.12) | Check line-height overrides | 28px rows must not clip when users set line-height 1.5. Use `min-height`, not `height`. |

## Recommendation

**Pick:** Geist and Geist Mono via `next/font/google` with `latin` + `latin-ext`. Adopt the fixed tokens: muted `#6F6E69`, accent `#2563EB`, amber text `#8A6116`, red text `#C53030`, chip text `#0B6E60` / `#1D4ED8` / `#9A3412`, control outline `#8F8F8B`. Keep `#E9E9E7` for decorative borders only. Upgrade MathJax to v4 for built-in speech. Fix REORDER and timed-test accommodations before the revamp ships. Reasons: no new dependency, every fixed token passes AA with margin, and the two code gaps are clear A/AA failures.

**Fallback:** If `tnum` or `latin-ext` glyphs are missing in the Google build, switch to the `geist` npm package (owner approval needed for the dependency). If MathJax v4 breaks `better-react-mathjax`, stay on 3.2.2 and turn on the `a11y/assistive-mml` and `a11y/explorer` components in the config.

## Open questions for the owner

1. Is Fraunces kept as the display face next to Geist, or is the revamp Geist-only?
2. Do you accept the darker accent `#2563EB`? It looks slightly deeper than `#2F6FEB`.
3. Who grants test time accommodations: the tutor per student, per test, or both? Should parents be able to see that it is set?
4. Should lockdown tests (Pro) be allowed to claim the "essential" timing exception, or must they always honour accommodations? Recommend always honour.
5. Do we want email magic-link sign-in for minors and parents? It needs Resend (input for Agent A on cost).
6. Which of the 11 official languages must the UI chrome support at launch, not just content?

## Sources

- https://vercel.com/font (checked 2026-11-16)
- https://vercel.com/font/geist (checked 2026-11-16)
- https://github.com/vercel/geist-font (checked 2026-11-16)
- https://registry.npmjs.org/geist/latest (checked 2026-11-16)
- https://raw.githubusercontent.com/google/fonts/main/ofl/geist/METADATA.pb (checked 2026-11-16)
- https://raw.githubusercontent.com/google/fonts/main/ofl/geistmono/METADATA.pb (checked 2026-11-16)
- https://nextjs.org/docs/app/api-reference/components/font (checked 2026-11-16)
- https://lexingtonthemes-com.pages.dev/blog/geist-opentype-features (checked 2026-11-16)
- https://fontalternatives.com/blog/geist-vs-inter-vs-satoshi-product-ui/ (checked 2026-11-16)
- https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ (checked 2026-11-16)
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html (checked 2026-11-16)
- https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html (checked 2026-11-16)
- https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html (checked 2026-11-16)
- https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html (checked 2026-11-16)
- https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html (checked 2026-11-16)
- https://docs.mathjax.org/en/latest/basic/accessibility.html (checked 2026-11-16)
- https://registry.npmjs.org/mathjax/latest (checked 2026-11-16)
- https://dndkit.com/api-documentation/sensors/keyboard (checked 2026-11-16)
- https://mathlive.io/mathfield/guides/accessibility/ (returned 404, checked 2026-11-16)
