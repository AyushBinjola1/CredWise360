# CredWise 360 implementation roadmap

The authoritative scope is [the development brief](docs/DEVELOPMENT_BRIEF.md). Work proceeds in its eight phases. Each checkpoint requires a native build, web production build, a running API and web application, applicable tests, and a PostgreSQL readback. Record the command, observed outcome and remaining work in the feature ledger before advancing.

| Phase | Delivery | Exit evidence |
| --- | --- | --- |
| 1 · Foundation | Local and Compose topology, migrations, HTTP contract, CMake and Next.js, design tokens, CI and architecture | Native process serves database-backed health through the web origin. Migration reruns safely. |
| 2 · Identity and profile | Sessions, recovery, role guards, account controls, simulated KYC, cash flow, dashboard | Register, log in, edit, reload, review KYC with a separate administrator, deny cross-role access. |
| 3 · Assessment and marketplace | Explainable configurable scoring, trends, affordability and risk, eight product types, ranking and comparison | Change financial evidence, verify reasons and history, exercise product bounds and ranking. |
| 4 · Origination and servicing | Draft through decision, rejection and recovery, acceptance, disbursement, servicing, EMI engine, closure | Verify transitions, exact schedule sums, atomic repayments, retry/concurrency, certificate. |
| 5 · Planning | Digital twin, inclusive pathway, stress tests, debt navigator, education projections and offer safety | Check alternative evidence, cloned profile isolation, numerical invariants, saved plans and estimates. |
| 6 · Engagement and oversight | Notifications and reminders, academy, educational rewards, distress, fraud, fairness, disputes | Exercise event deduplication, investigations, quizzes, accessible explanations and ticket history. |
| 7 · Portfolio and demonstration | Executive analytics, filters, exports, synthetic histories and guided walkthroughs | Reconcile reports against ledger records and run journeys A–H against PostgreSQL. |
| 8 · Release verification | Responsive and accessible refinement, performance, security, complete academic and operational documentation | Production builds, financial and concurrency suites, browser checks at six widths, route/control inventory and limitations. |

## Architecture and decisions

Use the local monorepo requested in the brief. The Next.js server forwards same-origin API requests to a native C++ service. C++ owns validation, financial calculations and workflow transitions. PostgreSQL owns persistence, constraints and transactions. The evaluator can run this topology on Windows or with Docker Compose. Currency is Indian rupees and API monetary values use integer paise. All identities, products, assessments and disbursements are synthetic.

## Team interfaces

1. Identity and profile own authentication, account state, KYC and financial inputs.
2. Assessment owns scoring, policy, rankings and scenario engines.
3. Servicing owns the state machine, repayment ledger and planner calculations.
4. Operations own notifications, investigations, reports and administrative controls.

The modules share the same transaction boundary and REST error contract. See [architecture](docs/architecture.md), [feature evidence](FEATURE_STATUS.md) and the [acceptance matrix](docs/acceptance-matrix.md).

## Checkpoint journal

- Initial inspection on 18 November 2026 found an empty workspace and no Git repository. Created the local repository and retained the full requested scope. Foundation implementation is in progress.

- Phase 1 · Native and web foundation passed the phase gate. Identity and financial profiles are next.

- Phase 2 · Identity and financial profile integration passed. Credit assessment, product policy and marketplace are next.

- Phase 3 · Completed on 19 November 2026. Conventional and alternative assessments, versioned credit and product policies, eight-product discovery, recommendations and loan-cost comparison passed the native, PostgreSQL and browser checks recorded in the feature ledger. The next implementation phase is origination and servicing. It builds on `productAssessment`, `recordCreditInquiry` and `EMIEngine` for application decisions and repayment schedules.

- Phase 4 · Origination and servicing verified on 19 November 2026. A submission-priority pass then added the planning engines (digital twin, debt navigator, stress test, education planner), notifications, rule-based fraud review, reports and data-backed dashboards, with a one-command demo launcher and idempotent seed. Academy, rewards, fairness, disputes and distress remain unimplemented and are listed in the feature ledger.
