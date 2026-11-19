# UX, accessibility and performance audit

This records what was audited, what was found, what was fixed and what was measured. All numbers are local measurements from this repository's own tooling. They are not Lighthouse scores, and the hosted site on Render's free plan was not measured.

## How it was audited

| Tool | What it covers |
| --- | --- |
| `scripts/audit-ui.mjs` | Signs in with the demo accounts and visits every public, customer and administrator route (59 routes) in light and dark themes. Records console and server errors, horizontal overflow, clipped elements, touch targets under 24 px, heading and landmark structure, and axe-core results for WCAG 2.0/2.1/2.2 A and AA. Run with `--fast` and `AUDIT_WIDTHS=...` to choose widths. |
| `scripts/measure-perf.mjs` | Loads seven representative pages three times each on desktop and on a phone profile with a 4× CPU slowdown, and reports TTFB, FCP, LCP, layout shift, blocking time, JavaScript and total transfer, and request counts. |
| `tests/browser/ux.spec.ts` | Part of the regression gate. Runs axe on 20 key pages in both themes and fails on any critical or serious violation. |
| `tests/browser/inventory.spec.ts` | Part of the regression gate. Visits every route at three widths for errors, overflow, labels and focus. |

Widths audited: 320, 360, 375, 390, 414, 480, 640, 768, 1024, 1280, 1440, 1920 and 2560 px in the light theme, and 320, 390, 768, 1280, 1440 and 2560 px in the dark theme.

## Checklist and outcome

| Area | Finding | Result |
| --- | --- | --- |
| Console and server errors | None on any route or width | Pass |
| Horizontal overflow and clipping | One overflow: dashboard KPI cards at 320 px | Fixed |
| Headings and landmarks | One `h1` and a `main` on every route | Pass |
| Accessible names | A link whose accessible name omitted its visible text (WCAG 2.5.3) | Fixed |
| Keyboard access | Scrollable tables could not be reached with the keyboard | Fixed (focusable, labelled regions) |
| Colour contrast | Language toggle, locked badges, fairness status and a call-to-action paragraph failed in one or both themes | Fixed (theme tokens throughout) |
| Target size (WCAG 2.2) | Footer and inline text links, range sliders, checkboxes and radios under 24 px on narrow screens | Fixed |
| Theme | The OS preference was ignored and the page could flash the wrong theme | Fixed (inline bootstrap, follows the OS until a choice is made) |
| Unused dependency | `framer-motion` was installed but never imported | Removed |
| Layout shift | Footer jumped on public tools; skeletons shorter than their content on dashboards | Fixed (see below) |
| Dashboard weight | The charting library (about 127 KB gzipped) loaded to draw five bars | Replaced with accessible CSS bars |
| Shared demo | A visitor could change the shared accounts' password, deactivate them, or reconfigure policy and products for everyone | Fixed (`DEMO_PROTECT`) |
| Reports | No audit export or application summary | Added (audit trail page with CSV and PDF, application summary PDF) |
| Notification badge | Reminders appeared only after opening the notification list | Fixed (generated when the dashboard loads) |
| Database latency | Every API request opened a new TLS connection, costly with Neon | Fixed (one validated connection per worker thread) |

## Measurements (local, idle machine, median of three runs)

Phone rows use a 4× CPU slowdown with no network throttling. Transfer sizes are compressed bytes.

| Page | Profile | TTFB ms | FCP ms | LCP ms | CLS | Blocking ms | JS KB | Total KB | Requests |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Landing | desktop | 5 | 160 | 160 | 0.001 | 0 | 343 | 833 | 49 |
| Landing | phone, 4x CPU slowdown | 5 | 536 | 536 | 0.056 | 322 | 341 | 780 | 40 |
| Sign in | desktop | 3 | 124 | 124 | 0.000 | 0 | 204 | 504 | 33 |
| Sign in | phone, 4x CPU slowdown | 3 | 272 | 536 | 0.000 | 186 | 204 | 504 | 33 |
| Loan calculator | desktop | 3 | 92 | 252 | 0.000 | 0 | 343 | 678 | 52 |
| Loan calculator | phone, 4x CPU slowdown | 3 | 228 | 996 | 0.000 | 564 | 343 | 677 | 47 |
| Borrower dashboard | desktop | 15 | 144 | 212 | 0.002 | 0 | 393 | 745 | 56 |
| Borrower dashboard | phone, 4x CPU slowdown | 14 | 340 | 1332 | 0.007 | 449 | 393 | 486 | 38 |
| Digital twin | desktop | 12 | 128 | 320 | 0.028 | 0 | 393 | 742 | 56 |
| Digital twin | phone, 4x CPU slowdown | 11 | 256 | 1204 | 0.060 | 461 | 393 | 481 | 36 |
| Loan account | desktop | 13 | 116 | 336 | 0.047 | 0 | 393 | 744 | 55 |
| Loan account | phone, 4x CPU slowdown | 14 | 236 | 1204 | 0.060 | 497 | 393 | 483 | 35 |
| Admin overview | desktop | 12 | 132 | 200 | 0.001 | 0 | 393 | 738 | 51 |
| Admin overview | phone, 4x CPU slowdown | 12 | 260 | 508 | 0.000 | 349 | 393 | 484 | 37 |

Server memory while serving the demo: the C++ API about 13 MB and the Next.js server about 165 MB, well inside a 512 MB instance.

Reading the table: first paint is fast everywhere. Largest contentful paint on the throttled phone profile is about one second for signed-in pages. Total blocking time on that profile is 150 to 500 ms, caused mainly by React hydration, so JavaScript size is the main remaining lever. Layout shift is 0.06 or lower on every measured page after the fixes (the calculator on a phone started at 0.277 and the admin overview at 0.171). JavaScript transfer is 200 to 390 KB compressed per page, which is the main cost to address next.

## Limitations

- Lighthouse was not run, and no hosted-site measurements were taken.
- Screen-reader behaviour was checked through automated tests and keyboard review, not with NVDA, JAWS or VoiceOver.
- Axe finds roughly a third of accessibility problems. A manual audit would still be valuable.
- Font swapping on slow connections causes a small shift on the landing page on phones (0.056 measured with throttling).
