# Feature status and evidence

A checked row requires an executed functional check. Partial coverage is recorded explicitly. The complete specification, including every subrequirement, is retained in [the brief](docs/DEVELOPMENT_BRIEF.md). Section numbers below refer to that document.

| Brief | Feature family | Status | Verification evidence |
| --- | --- | --- | --- |
| 1–5 | Local infrastructure, architecture, branding, theme, API and design system | Native/web path verified; container execution pending | Phase 1 log below |
| 6 | Public pages and role-specific customer and administrator navigation | In progress | Public information pages, sign-in, role guard and workspace navigation exercised in phase 2 |
| 7–9 | Identity, sessions, recovery, simulated KYC, profile and cash flow | Core journeys verified | API readbacks, KYC rejection/resubmission and two browser profiles in phase 2 |
| 10, 12 | Scoring, risk, alternative evidence and policy history | Pending | |
| 11 | Digital twin, presets, comparison and saved scenarios | Pending | |
| 13–16 | Eight loan products, recommendations, affordability, amortization and comparison | Pending | |
| 17–18 | Application lifecycle, underwriting, explanations, recovery and reassessment | Pending | |
| 19 | Loan servicing, payment allocation, penalties, idempotency and closure | Pending | |
| 20–24 | Debt freedom, stress, student planning, loan safety and distress | Pending | |
| 25–28 | Bilingual academy, notifications, educational rewards and fraud investigation | Pending | |
| 29–32 | Underwriting, portfolio, fairness and disputes | Pending | |
| 33–34 | Reports, exports and normalized persistent records | Pending | |
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
