# Feature status and evidence

A checked row requires an executed functional check. Partial coverage is recorded explicitly. The complete specification, including every subrequirement, is retained in [the brief](docs/DEVELOPMENT_BRIEF.md). Section numbers below refer to that document.

| Brief | Feature family | Status | Verification evidence |
| --- | --- | --- | --- |
| 1–5 | Local infrastructure, architecture, branding, theme, API and design system | Native/web path verified; container execution pending | Phase 1 log below |
| 6 | Public pages and role-specific customer and administrator navigation | In progress | Public information pages, sign-in, role guard and workspace navigation exercised in phase 2 |
| 7–9 | Identity, sessions, recovery, simulated KYC, profile and cash flow | Core journeys verified | API readbacks, KYC rejection/resubmission and two browser profiles in phase 2 |
| 10, 12 | Scoring, risk, alternative evidence and policy history | Verified for phase 3 | Native strategy boundaries, evidence consent and missing values, persisted score changes, policy history and role restrictions |
| 11 | Digital twin, presets, comparison and saved scenarios | Core verified; side-by-side scenario comparison pending | Six presets and custom what-if inputs run on a cloned profile through the C++ scoring engine, with factor-level before/after, persisted saved scenarios and an unchanged-profile check (API and browser). |
| 13–16 | Eight loan products, recommendations, affordability, amortization and comparison | Verified for quotations and product selection | Native schedule reconciliation, eight persisted product policies, exact-principal recommendations, product-specific charges and four-way comparison. Posted servicing transactions belong to phase 4. |
| 17–18 | Application lifecycle, underwriting, explanations, recovery and reassessment | Verified | Draft, evidence, preview token, submit, underwriting, request-information, approve, reject with recovery plan, reassessment, appeal, frozen-offer acceptance and idempotent disbursement (`tests/04a-origination.test.mjs`, `tests/browser/origination.spec.ts`, native `lifecycle_and_servicing`). |
| 19 | Loan servicing, payment allocation, penalties, idempotency and closure | Verified | Dated schedules, EMI, partial, advance, prepayment and foreclosure posting, closure certificate (`tests/browser/servicing.spec.ts`). Late penalties after the grace period, default documentation after 90 days of arrears with role checks, and concurrent payments (same key, stale quote, parallel instalments) in `tests/07-servicing-edge.test.mjs`. |
| 20–24 | Debt freedom, stress, student planning, loan safety and distress | Verified | Native `planning_engines` and `oversight_engines` suites. `tests/05-planning.test.mjs`, `tests/06-oversight.test.mjs` (safety scanner with effective-rate reconstruction, flags, checklist and validation; distress indicators, non-punitive guarantee, notification deduplication and administrator outreach). Browser: `planning.spec.ts`, `oversight.spec.ts`. |
| 25–28 | Bilingual academy, notifications, educational rewards and fraud investigation | Verified | Eleven English and Hindi lessons with server-held answers, persisted attempts and progress; points ledger and badges from learning, on-time payment, debt milestones, savings goals, score gains and saved plans, with no rule that pays for borrowing; notifications and fraud cases as before (`tests/06-oversight.test.mjs`, `tests/browser/oversight.spec.ts`). The academy offers one question per lesson. |
| 29–32 | Underwriting, portfolio, fairness and disputes | Verified | Fairness monitor: three personas, four protected-attribute variants and eight products, control changes, policy checks and persisted runs. Disputes: validation, ownership, evidence, assignment, information requests, resolution, reopening, withdrawal and reconsideration that really sends a rejected application back to underwriting (`tests/06-oversight.test.mjs`). |
| 33–34 | Reports, exports and normalized persistent records | Verified for the listed reports | CSV export on tabular reports. PDFs rendered by the C++ service for financial health, credit assessment, loan statement, closure certificate, saved planning scenarios and the portfolio. Cross-reference offsets are re-read in native and API tests and two PDFs were inspected visually. Audit and application-summary reports are not implemented. |
| 35–39 | C++ OOP, DSA, OS concepts, patterns and REST contract | Partially documented | `docs/academic-guide.md` concept map covers state machines, strategy rules, root finding, simulation, counterfactual testing and PDF serialization. `docs/openapi.json` documents 75 paths. No dedicated data-structure benchmark or OS-concept demonstration. |
| 40–43 | Security, responsive design, performance and interaction quality | Partially verified | `tests/browser/inventory.spec.ts` visits every customer and administrator route at 360, 768 and 1440 px: no page or console errors, one h1 and a main landmark, no horizontal overflow, labelled controls, named buttons and links, and visible keyboard focus on key pages. No performance measurements and no screen-reader testing. |
| 44–46 | Synthetic cohorts, automated checks and eight end-to-end scenarios | Partially verified | Four seeded demo accounts built through the real workflows (`scripts/seed-demo.mjs`). 27 API and 20 browser tests. The eight brief scenarios are not mapped one-to-one. |
| 47–50 | Academic guides, team map, checkpoints and final acceptance | Partially complete | Academic guide, data model, README and this ledger updated. No team map. |

## Phase verification log

Record the tested behavior and the command here. A source file or planned test alone is insufficient.

### Phase 1

Verified on Windows using node scripts/check-phase.mjs. GCC 16.2 compiled the C++20 API, CTest passed 1/1, the Next.js production build succeeded, the real API passed its integration test through the Next.js origin, and Chromium passed the landing, image, theme persistence and overflow test at all six requested widths. PostgreSQL 18.7 retained one initialization across three migration passes. Docker Compose and hosted CI are supplied but have not been executed here.

### Phase 2

The production Next.js and GCC builds passed, CTest passed 1/1, 2 API integration tests passed, and 4 Chromium tests passed. Browser journeys verified registration, profile persistence and ₹37,500 disposable income after sign-out/sign-in at 390px and 1440px. API checks verified actual uploaded document bytes, admin rejection and resubmission, settings, password recovery, session invalidation, account deactivation/reactivation and borrower authorization. Eight public information routes and the six-width landing-page check passed.

### Phase 3

Verified on 19 November 2026. The focused CTest financial and credit suites passed. The final `node scripts/check-phase.mjs` run passed the C++ build, Next.js production build, all 3 native test suites, all 10 PostgreSQL-backed API tests and all 10 Chromium tests.

- Reconciled 120 principal, rate and tenure combinations in integer paise. Separate tests covered flat interest, zero interest, floating-rate changes, partial prepayment, product-specific charges and the final instalment.
- Verified conventional and alternative score boundaries, absent and explicitly zero evidence, consent, human review, policy revision conflicts, and persisted score history after profile edits.
- Verified all eight products, exact requested principal in recommendations, empty results for unaffordable requests, authorized product-policy changes and comparison of up to four terms. The signed-in browser submitted a ₹50,000 request and displayed the match returned by C++.
- Verified two independent browser roles completing a synthetic KYC review after fixing the decision control’s accessible label. Six phase 3 routes passed 36 viewport checks from 360 to 1920 px without horizontal overflow or browser page errors.
- Reapplied migrations and independently read the eight stored products, policy versions, assessment history and product change records from PostgreSQL. The final demo health check reported five applied migrations and one initialization. Container execution remains pending.

### Phase 4

Verified on 19 November 2026 with `node scripts/check-phase.mjs`. The origination lifecycle, rejection and recovery, reassessment, escalation, concurrent headroom use and duplicate-disbursement tests passed, along with the servicing browser journey (receipt recovery, settlement and closure certificate). Native `lifecycle_and_servicing` covers the application state machine and calendar anniversaries.

### Phase 5–7 (submission scope)

Verified on 19 November 2026 from a clean verification schema with `node scripts/check-phase.mjs`: 5 of 5 native CTest suites (including `planning_engines`), 17 of 17 PostgreSQL-backed API tests and 13 of 13 Chromium tests passed.

- Planning engines (`engines/planner.cpp`): avalanche versus snowball with a never-amortizing baseline detected, stress shocks with reserve depletion, education tranches with moratorium accrual. The twin reuses `CreditScoreEngine` unchanged.
- Notifications are created from application and payment events and from due-date reminders, each with a deduplication key. Reloading did not duplicate them.
- Fraud screening runs four rules over persisted records. Cases keep their review status across rescans.
- Reports and both dashboards read persisted data. Browser checks covered 390 px and 1440 px with no horizontal overflow.
- `scripts/start-demo.ps1` was run against the real database and `scripts/seed-demo.mjs` was run twice (second run made no changes).

### Phase 8 (remaining scope)

Verified on 19 November 2026 from a clean verification schema with `node scripts/check-phase.mjs`: 6 of 6 native CTest suites (`core_units`, `financial_invariants`, `credit_policy_boundaries`, `lifecycle_and_servicing`, `planning_engines`, `oversight_engines`), 27 of 27 PostgreSQL-backed API tests and 15 of 15 Chromium tests (20 of 20 after the brand identity work).

- Predatory Loan Protector (`engines/safety.cpp`): effective annual cost by bisection over the repayment stream; flags for rate gap, flat interest, upfront deductions, bundled charges, payment mismatch, frequency, late fee, prepayment, lock-in, undisclosed terms and income burden; checklist and disclaimer. A 12% reducing monthly loan reproduces 12.68%.
- Distress early warning (`engines/distress.cpp`): nine indicators, explainable levels, recommendations, supportive administrator outreach. It never feeds scoring and the score was asserted unchanged.
- Disputes (`domain/dispute.cpp`, `services/support.cpp`): full lifecycle, evidence, history and reconsideration.
- Fairness monitor (`engines/fairness.cpp`), academy and rewards (`services/learning.cpp`), PDF writer (`engines/pdf.cpp`, `services/documents.cpp`).
- Servicing edge cases, route and accessibility inventory and an extended OpenAPI contract.
- Defects found and fixed during this phase: the PDF writer grouped lakhs incorrectly (caught by `tests/06-oversight.test.mjs`); the admin distress view rescanned every customer on every visit and has been made incremental; a renamed certificate button broke an existing test and was restored.

### Not implemented or not verified

- Docker is not installed in this environment, so `compose.yaml` and the two Dockerfiles were reviewed by reading only (the database folder that holds the academy seed is copied into the image) and never built or run. The CI workflow was read but not executed on a hosted runner.
- No screen-reader testing, no colour-contrast measurement and no performance profiling. Keyboard checks cover the first six tab stops of selected pages.
- Audit and application-summary reports, debt-reduction discounts and any monetary reward value are not implemented. Rewards are recognition only.
- Academy lessons have one question each. The Hindi text has not been reviewed by a native speaker.
- Fairness testing uses synthetic personas. It shows the policy ignores the listed attributes, not that real-world outcomes are free of proxy effects.
- Distress levels are recomputed when a customer or administrator opens the view (administrator view at most once a minute per customer), not by a background worker.
- Notification preferences, email or SMS delivery and background reminder jobs are not implemented. Reminders are generated when the notification list is read.

### Deployment preparation

`DATABASE_URL` accepts URI or keyword form with optional `DATABASE_SSLMODE` and `DATABASE_CONNECT_TIMEOUT`, startup retries a sleeping database, and `TRUST_PROXY` enables per-visitor throttling behind a proxy. Unit tests in `core_units` cover the connection-string rules. The container entrypoint was run locally against an SSL-only PostgreSQL: migrations, demo seeding, TLS 1.3 connections (from the server log), refusal of plaintext, origin checks and error exits were observed. The Render image build, Render itself and Neon were not run in this environment. Details: `docs/deployment.md`.

### Brand identity

The approved logo artwork was traced to six transparent SVGs (`apps/web/public/brand`), exported to PNG, and applied through a reusable `Logo` component with automatic light and dark selection. It appears in the public header and footer, sign-in and registration, both workspaces (sidebar, mobile top bar and menu), the loading state, error and not-found pages, and the PDF report header. Favicons (SVG and ICO), Apple touch and 192/512 application icons, a web manifest and Open Graph and Twitter metadata were added. `tests/browser/brand.spec.ts` checks the assets, theme switching without box movement or layout-shift sources on the logo, icon-only compact layouts, placement across pages and the published icons and metadata. The PDF test checks the header colours. The HTML closure certificate download still uses a text header, and there is no collapsed-sidebar mode in the app, so the icon-only logo is used in the mobile top bar and compact public header instead. The logo is a trace of raster artwork, so very fine edge detail follows the source rather than a hand-drawn original.

