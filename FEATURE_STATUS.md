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
| 19 | Loan servicing, payment allocation, penalties, idempotency and closure | Verified for the browser journey and native schedule rules | Dated schedules, EMI/partial/advance/prepayment/foreclosure posting, idempotent retries, closure certificate (`tests/browser/servicing.spec.ts`, native lifecycle suite). Dedicated API tests for penalties, default documentation and concurrent payments are not yet written. |
| 20–24 | Debt freedom, stress, student planning, loan safety and distress | Debt navigator, stress test and education planner verified; loan safety and distress pending | Native `planning_engines` suite, `tests/05-planning.test.mjs` and `tests/browser/planning.spec.ts`. |
| 25–28 | Bilingual academy, notifications, educational rewards and fraud investigation | Notifications and fraud investigation verified; academy and rewards pending | Application-decision, payment and due/overdue reminder notifications with deduplication; four fraud rules with investigator decisions and audit entries (`tests/05-planning.test.mjs`). |
| 29–32 | Underwriting, portfolio, fairness and disputes | Underwriting queue and portfolio verified; fairness and disputes pending | Underwriting queue and decisions (phase 4 tests); portfolio overview and reports reconcile to ledger records (`tests/05-planning.test.mjs`). |
| 33–34 | Reports, exports and normalized persistent records | Partially verified | Borrower and administrator reports with CSV export and print. Report totals checked against persisted records in the API test. No PDF export. |
| 35–39 | C++ OOP, DSA, OS concepts, patterns and REST contract | Pending | |
| 40–43 | Security, responsive design, performance and interaction quality | Pending | |
| 44–46 | Synthetic cohorts, automated checks and eight end-to-end scenarios | Pending | |
| 47–50 | Academic guides, team map, checkpoints and final acceptance | Pending | |

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

### Not implemented or not verified

Bilingual academy, educational rewards, fairness testing, disputes, distress detection, loan-safety scanner, PDF exports, Docker Compose execution, hosted CI, and the full route and accessibility audit are not done. Docker Compose files and CI are supplied but have not been executed here. There is no dedicated audit of keyboard and screen-reader behaviour beyond label-based selectors used in the browser tests.
