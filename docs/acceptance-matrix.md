# CredWise 360 acceptance matrix

This matrix specifies what to demonstrate against the Next.js client, C++ service and real PostgreSQL database. Section numbers match the development brief. Record actual test results and outstanding checks in `FEATURE_STATUS.md`. A row here describes an expected outcome.

## Evidence for each phase

Record the date, commit or tested working tree, build commands and exit results, test commands and counts, and any skipped checks. Identify the environment, database migration version and synthetic fixture used. For a user-facing change, name the page, account role, action, expected result and observed result. Reference tests by path and case name so another evaluator can reproduce them.

| Phase | Boundary to exercise before proceeding |
| --- | --- |
| 1 · Foundation | Build C++ and the production web app. Apply migrations to an empty PostgreSQL database and rerun the migration command. Run both services, exercise a browser-to-C++ request and reconnect to a persisted record. Check the local setup instructions against this run. |
| 2 · Identity and profile | Register, sign in, submit synthetic KYC, review it as an administrator, update the financial profile, reload the dashboard, sign out and verify session invalidation. Check access with a second customer. |
| 3 · Assessment and products | Change a financial input, observe its effect on an assessment and product recommendation, and inspect the recorded assessment. Retrieve all eight products, test eligibility limits and explain an unsuitable result. |
| 4 · Lending and repayment | Take fixtures through approval, rejection and information requests. Settle a loan with several payment types. Compare the browser, schedule, ledger and outstanding balance after restart. Run transaction and concurrency cases below. |
| 5 · Planning and inclusion | Exercise A, C, D, E, G and H below as their dependencies become available. Compare forecasts against independent small examples. Reopen saved scenarios and compare the underlying financial profile before and after simulation. |
| 6 · Education and oversight | Complete a lesson, trigger a reminder, investigate an anomaly, resolve a dispute, test two equivalent financial profiles and inspect the visible histories. Repeat event delivery and check uniqueness. |
| 7 · Portfolio and demos | Run A–H on synthetic accounts. Reconcile filtered portfolio figures, reports and exports to source records. Reapply the seed procedure in a disposable database and check fixture relationships and totals. |
| 8 · Release | Run all phase tests and the user-surface inventory. Check six viewport widths, both themes, keyboard and reduced-motion behavior, failure states, accessibility, browser console and measured performance. Verify setup from the documented commands. |

After each phase, rebuild, run the application, exercise the integrated feature and check durable state across a fresh connection or restart. Fix regressions, rerun affected checks and record the Git checkpoint. A component test alone establishes only component behavior. A successful API test establishes only the route and business path it exercised.

## Requirements by brief section

### Product, architecture and identity

| § | Acceptance criteria and evidence |
| --- | --- |
| 1 · Mission | Demonstrate an end-to-end borrowing journey with a visible cost, explainable decision and path to repayment or recovery. Verify the public home conveys responsible credit and the requested tagline. Use identifiable C++ examples during the academic demonstration. |
| 2 · Product integrity | Each displayed control has an observable outcome. Persist financial profiles, applications, repayments and transactions across a fresh session and backend restart. Trace a changed input through the browser, C++ service and database. Confirm synthetic identity, simulated bureau-independent scores and deterministic rule descriptions are clearly labelled. |
| 3 · Stack | Build the Next.js App Router site with strict TypeScript. Verify actual use of the requested UI, chart, animation, query and form libraries. Build the C++17/20 server with CMake, exercise its JSON HTTP interface and run PostgreSQL migrations and seeds. Inspect and run the locally applicable Docker Compose, OpenAPI, CI and test commands. Record any platform-specific execution limits. |
| 4 · Layers | Trace one profile change and one repayment from presentation through controller, service, domain/engine, repository and committed database record. Show where authorization, notifications, analytics and background jobs join those paths. |
| 5 · Design | Review public, customer and admin views in both themes. Check emerald identity, semantic colors, readable tabular money, focus visibility, chart labels, dense tables, onboarding, empty states and spacing at mobile and desktop widths. |
| 6 · Site structure | Cover the public, customer and admin surface inventory below. Open each view directly and through navigation. Check protected deep links when logged out and under the wrong role. |
| 7 · Authentication | Register a unique customer, reject duplicates, authenticate, inspect session expiry, sign out and try the old session. Exercise a local password reset, expiry, single use, deactivation, reactivation, preferences, failed-login monitoring and each clearly labelled demo login. Verify persisted credential hashes with secrets excluded from evidence. |
| 8 · Simulated KYC | Enter synthetic identity, address and employment details. Check valid and invalid synthetic PAN formats, upload a permitted sample document, inspect status, request a correction with a reason, resubmit and approve as an administrator. Verify customer isolation throughout. |
| 9 · Financial profile | Save salary, business/freelance income, employment stability, essential/discretionary expenses, savings, external obligations, outstanding debt, assets, liabilities, reserves, repayment history and goals. Independently reconcile disposable income, net worth, savings ratio, debt and EMI ratios, emergency coverage, health index and cash-flow chart. Change one input and recheck dependent views. |

### Credit, borrowing and planning

| § | Acceptance criteria and evidence |
| --- | --- |
| 10 · Simulated credit | Test the 300–900 range, policy weights/thresholds, repayment history, utilization, obligations, history length, recent applications, income consistency and resilience. Record score, factor contributions, positive/negative reasons, suggestions, risk band, policy version, dated history and prior-score comparison. Distinguish creditworthiness, affordability, stability, health and repayment risk in the response and UI. |
| 11 · Digital twin | Adjust income, expenses, debt paid, hypothetical borrowing, a missed payment, savings, reserves and utilization. Exercise events, presets, sliders, reset and save/reload. Compare current and simulated score, health, capacity, debt ratio, risk and resilience. Explain the changed factors. Compare durable baseline profile, assessment history and loan balances before and after the forecast. |
| 12 · Inclusive assessment | Exercise conventional-history and thin-file paths with consent granted, declined and limited evidence. Test voluntary rent, utilities, business cash flow, income regularity, savings and commitments. Review the explanation and human referral for insufficient evidence. Include student, first-time, small-business, self-employed, freelance and informal-income examples. |
| 13 · Products | Open details for personal, education, home, vehicle, business, gold, emergency and microfinance loans. Check independent principal and tenure limits, interest policy, fees, documentation, collateral, eligibility, repayment and risk rules. Verify the demo-rate label and product-specific behavior through the C++ factory. |
| 14 · Recommendations | Vary purpose, requested amount, tenure, obligations and repayment capacity. Assert ranked eligibility, compatibility, estimated EMI, interest, total cost, reasons, limitations, warnings and alternatives. Test an empty eligible set. Verify that recommended principal respects the requested need. |
| 15 · Affordability and EMI | Test reducing-balance, zero interest, fixed rate or configured fixed-interest convention, floating changes, fees, upfront charges, partial/full prepayment and foreclosure. Reconcile each schedule's principal, interest, total cost and final balance. Verify estimates in the public calculator match the C++ response. |
| 16 · Comparison | Compare one through four products and exercise the limit, removal and replacement. Show principal, rate, EMI, term, fees, interest, repayment, effective cost, eligibility and prepayment terms. Test independent ties for lowest cost, smallest EMI and shortest term. Match chart and table values to quotes. |
| 17 · Application lifecycle | Save and reopen a draft, choose product/purpose/amount/tenure, review profile, run eligibility, inspect cost and amortization, attach synthetic documents, confirm and obtain a tracking ID. Exercise submitted, under review, requires information, approved, rejected, accepted, disbursed, active, closed, defaulted and withdrawn states on suitable fixtures. Check actor, time and permitted predecessor on each transition. |
| 18 · Rejection and recovery | Reject with a reason code, plain explanation and relevant affordability input. Show a measurable improvement, recovery milestone, suitable alternatives where available and reassessment conditions. Follow a recovery action into the twin, save an actual profile change separately, request reassessment and retain both decisions. Exercise human review through a dispute. |
| 19 · Servicing | Compare original and outstanding principal, rate, installment, repaid amount, next due date, remaining tenure, progress, interest, schedule and history. Post regular, partial, advance, late and extra payments, then foreclose. Verify configured penalty timing/allocation, recalculated schedules, atomic records, replay behavior, closure and downloadable certificate. |
| 20 · Debt freedom | Use two loans where the smallest balance and highest rate belong to different loans. Compare avalanche, snowball, minimum-only baseline and chosen priorities. Trace monthly minimums and extra allocation, interest saved, balances, closure dates, milestones and debt-free date. Test zero extra, equal priorities, a close-out month and product prepayment rules. |
| 21 · Stress | Run unemployment, salary loss, business-income loss, one-off expense, rate rise and cost-of-living rise independently and together. Verify changed cash flow, shortfall, emergency runway, repayment burden/risk and actionable resilience steps. Compare the forecast to the persisted baseline. |
| 22 · Education | Enter semester tuition, hostel/living costs, scholarship/subsidy and contribution, course length, staggered disbursements, moratorium and voluntary interest. Change expected salary, floating rate and prepayment. Reconcile total cost, amount borrowed, accrued interest, graduation balance, repayment EMI, total borrowing cost and timeline across strategies. |
| 23 · Safety checker | Enter advertised rate, fees/mandatory charges, net proceeds, installment, frequency, penalties and prepayment conditions. Show the calculated effective-cost estimate, cash amounts and reason for each relevant fee, burden, discrepancy or unclear-term flag. Exercise the safer-borrowing checklist and verify the language leaves fraud determinations to investigation. |
| 24 · Distress | Exercise rising debt, consecutive missed dues, falling savings/disposable income, upcoming large dues and a cash shortfall. Verify dated reasons, customer budget/restructuring/support options and compassionate admin prioritization. Check that recording a warning leaves account access and contractual terms intact. |

### Operations, education and data

| § | Acceptance criteria and evidence |
| --- | --- |
| 25 · Academy | Complete lessons covering credit scores, rates, EMI, simple/compound interest, affordability, utilization, debt management, responsible borrowing, fraud awareness, emergency funds and education loans. Interact with examples, submit right/wrong quiz answers, read explanations, reload progress and earn completion recognition. Check the supported English/Hindi experience. |
| 26 · Notifications | Trigger submission, updates, approval/rejection, documentation requests, due and overdue reminders, payment, distress, recovery, closure and security events. Check owner, preference, filtering, unread count, read-all, restart and duplicate delivery. Run the reminder job twice over the same eligible due item. |
| 27 · Rewards | Complete a lesson, create a plan, maintain on-time payments, meet a savings goal and cross a debt-reduction milestone. Check persisted, non-duplicated educational rewards. Confirm borrowing by itself does not earn a reward and any simulated discount can be reconciled to its product rule. |
| 28 · Anomalies | Exercise synthetic identity duplicates, multiple/sudden applications, inconsistent inputs, failed logins, transaction-key conflicts and unusual repayment events. Check rule, severity, evidence, timestamp, assignee, status and resolution. Verify investigation can conclude with a benign explanation. |
| 29 · Underwriting | Search, filter and sort the configured queue. Inspect profile, KYC, documents, history, affordability, score, risk, fraud evidence and recommendation. Exercise approval, reasoned rejection, information request and escalation. Reconcile each decision, actor and note to the timeline and audit log. |
| 30 · Admin analytics | Independently aggregate customer/borrower counts, application statuses/rates, disbursed/outstanding principal, collections, overdue figures, risk/default rates, mean simulated score and interest/fee income. Reconcile score distribution, funnel, originations, products, repayments, delinquency, risk, growth and portfolio quality. Combine date/product/risk filters, search, sort, paginate, drill down, export and print. |
| 31 · Fairness | Pair equivalent financial inputs with different irrelevant display attributes. Check identical financial outcomes under the same policy. Change one legitimate factor and verify its contribution. Inspect score/eligibility explanations, weights, policy versions, human-review rates and rejection-reason counts. |
| 32 · Disputes | File record-correction, reconsideration and score disputes with synthetic evidence. Assign, respond, request information and resolve. Verify both actors see the correct dated history and a second borrower cannot access it. |
| 33 · Reports | Generate financial health, simulated credit, eligibility, amortization, repayment statement, transaction history, closure certificate, debt plan, stress test, education projection, application summary, portfolio and audit outputs. Reconcile amounts, selected filters, owner and dates. Check print/PDF layout and applicable CSV headers/rows. |
| 34 · Database | Trace role/user/session, personal and financial profile, income/expense/asset/liability, goals, KYC/document, score/policy/history, product/application/decision, loan/schedule/transaction/penalty, simulation, fraud, notification, dispute, learning and audit records. Test key constraints, relations, indexes, status/timestamps, minor-unit storage, migration replay and atomic rollback. |

### Engineering and release

| § | Acceptance criteria and evidence |
| --- | --- |
| 35 · OOP | Check exact C++ file and class references in the academic guide. Demonstrate the constructs and domain responsibilities listed below through a real call path and behavior test. |
| 36 · DSA | Connect each requested structure/algorithm to a real operation, order/tie rules, runtime complexity and database durability. Explain optional graph use only if implemented. |
| 37 · OS concepts | Exercise background and concurrent processing, bounded shutdown, wakeup/drain, idempotent job retry, race-free database updates and resource cleanup. Identify the worker/pool, queue, condition-variable and mutex code paths. |
| 38 · Patterns | Locate runtime use of loan factory, scoring/eligibility/repayment strategies, notifications/observers, repositories/adapters, application state validation and controlled admin commands. Verify at least one business action through each applicable pattern. |
| 39 · REST | Inventory method, path, roles, object ownership, input, response, failure status and OpenAPI operation for every endpoint. Exercise auth, profiles/KYC, credit/twin, products/comparison, applications/underwriting, loans/EMI/payments, all planners, notifications, reports/analytics, fraud and disputes. Test list ordering, filters, pagination and payment idempotency. |
| 40 · Security and privacy | Verify hashing, authorization, rate limits, expiry/invalidation, session-cookie flags, cross-site request protections, parameterized DB calls, output encoding, upload restrictions, least privilege, sensitive-log redaction and admin audit records. Keep synthetic data and simulated funds clearly marked. See isolation checks below. |
| 41 · Responsive | At widths 360, 390, 768, 1024, 1440 and 1920 px, exercise menus, sidebar, form entry, tables, chart inspection and dialogs. Use long names, large money values and keyboard input. Check document overflow separately from intentional localized table scrolling. |
| 42 · Performance | Measure a production build with a reproducible browser, route and viewport. Inspect transferred assets, font/image optimization, code-split chart loading, cache behavior, pagination, search debounce and stale-request cancellation. Record Lighthouse performance, accessibility, best practices and public SEO results where available and retest observed bottlenecks. |
| 43 · UX | Test guided onboarding, contextual next steps, field hints, inline validation, saved drafts, loading/skeleton, empty, error, retry, confirmation and success states. Verify breadcrumbs, search, visible focus, keyboard operability, return focus, reduced motion and plain-language definitions of DTI, utilization, moratorium and amortization. Review actual costs and risk disclosure before confirmation. |
| 44 · Demo data | Use the synthetic personas below, differing statuses, credit histories, active/closed/overdue loans, resolved disputes and pending investigations. Exercise a guided scenario entry with minimal typing. Compare dashboard claims to persisted records. |
| 45 · Testing | Execute C++ financial/scoring/lifecycle/error tests, real database integration and concurrency tests, browser/component interaction and accessibility tests, and the A–H workflows on desktop/mobile. Record commands and observed results, including unavailable platforms or checks. |
| 46 · Acceptance scenarios | Use the independent A–H walkthroughs below and keep a record of the two user roles, fixture and durable results for each. |
| 47 · Handover | Reproduce from README, installation/local/Docker guides and test instructions. Check architecture, UML, use case, ER and state diagrams against actual code. Review API/schema, formulas, security, exact academic mappings, limitations, demo and viva explanations with a second-year engineering reader in mind. |
| 48 · Team boundaries | Document ownership of identity/KYC/profile/security, credit/risk/inclusion/simulation/recommendations, loan/payment/planning/safety and administration/fraud/analytics/reports/events/support. Trace shared inputs and events with an integration test across these boundaries. |
| 49 · Delivery | Keep the roadmap, architecture map and feature checklist in source control. Preserve per-phase build, run, test, integration, persistence and fix evidence with Git checkpoints. |
| 50 · Final QA | Verify every inventoried screen, route, control, form, calculator and API role. Inspect loading/empty/error states, logs/console, migrations, builds, test results, mobile/desktop, accessibility, performance and documentation. Report runnable setup, demo credentials, architecture, technologies, important files, academic mappings, observed results and outstanding limitations. |

## User-surface inventory

Use the visible page name and actual URL in browser results. Several related public items may be clearly navigable sections. Record each protected view separately and cover direct navigation, back/reload and role checks.

| Audience | Views and actions to locate |
| --- | --- |
| Public | Home, about, how it works, features, loan products, literacy resources, public calculator, comparison, FAQ, login, registration, privacy, terms and simulation disclaimer. |
| Customer | Overview, financial profile, KYC, credit health, digital twin, marketplace and product details, applications, loan detail, active loans, repayments, debt freedom, stress testing, education planner, safety checker, recovery, academy, notifications, reports/statements, support/disputes and settings/security. |
| Administrator | Executive overview, customer management, application processing, underwriting, active portfolio, repayment monitoring, risk analytics, fraud, fairness, distressed borrowers, disputes, product configuration, audit, reports and system health. |

## A–H walkthroughs

Each walkthrough starts from an identified synthetic fixture or fresh registration. Use normal browser controls, keep the C++ service running, retrieve the resulting records through an independent session and compare them to the UI. Repeat the critical action path at a mobile width. Simulations should preserve the baseline profile and loan ledger.

| ID | Actions | Independent evidence |
| --- | --- | --- |
| A · First-time borrower | Register, add income and expenses, provide consent for selected alternative evidence, view suitability and reasons, select an affordable product, submit required documents, review as admin, then sign back in as the customer. | The chosen product, principal, evidence/consent, tracking ID, timeline and resulting decision refer to the same applicant. A limited-evidence run routes to human review with an explanation. |
| B · Responsible borrower | Submit and approve an eligible request, accept terms, disburse, view the active loan, pay an EMI, make an extra principal payment and settle the remaining amount. | One disbursement, an atomic transaction per distinct payment, correct allocated interest/principal, a revised remaining schedule, zero closing balance, closed state and printable/downloadable certificate. |
| C · Rejected borrower | Open a rejected request, inspect reasons, choose a recovery milestone, preview an improvement in the twin, reload the original profile, then make an explicit profile update and request reassessment. | Original decision and policy history persist. The forecast leaves the baseline intact. The reassessment references current inputs and retains an independently explainable result. |
| D · Student | Enter at least two staggered semesters, tuition/living costs, scholarship/contribution, moratorium and expected salary. Compare capitalized interest and voluntary study-period interest. | Verify each net draw, accrual start, graduation and post-moratorium balances, repayment EMI, total paid and debt-free date. A later draw accrues over fewer months. |
| E · Financial distress | Open a synthetic income-loss case, examine an early warning, simulate temporary salary reduction and higher expenses together, inspect runway, and save or revisit the recovery steps. | Confirm the warning inputs/date, estimated monthly deficit, reserve coverage and support options. Customer and admin views agree about the warning. |
| F · Fraud investigation | Use a fixture meeting a configured application/identity anomaly rule, open the resulting alert, assign an administrator, inspect evidence and resolve with a note. | Rule, severity, evidence, timestamps, investigator, status and resolution survive reload. Application adjudication and investigation have independently traceable records. |
| G · Debt freedom | Open two distinct active debts, inspect minimum-only plan, compare avalanche/snowball at the same extra budget and change the budget. | Months with affordable minimums cover each minimum; extra allocation follows the selected priority and never exceeds the balance. Dates, per-loan closures and total interest reconcile. |
| H · Consumer protection | Enter a hypothetical external offer with fees, short payment frequency and a prepayment restriction. Inspect net proceeds, aggregate cash paid, effective-cost estimate, flags and safer-borrowing checklist. | Reconcile the estimate to the stated proceeds, timing and payments. Lower a fee, repeat the assessment and check which flags change. Confirm the offer has no active-loan or ledger side effect. |

## Monetary and transaction checks

These fixture amounts are independent test inputs in INR. Store monetary results as integer paise. Record the actual rounding, accrual period, fee treatment, due-date and allocation policy alongside expected results.

- For a one-month reducing-balance loan of ₹1,000.00 at a nominal 12% annually with monthly periods and no fees, interest is ₹10.00, payment is ₹1,010.00 and closing principal is zero.
- For ₹100.00 at zero interest over three months using a nearest-paise regular installment, payments of ₹33.33, ₹33.33 and ₹33.34 sum to the original 10,000 paise. A different documented rounding allocation must reconcile to the same principal and zero interest.
- For the one-month ₹1,000.00 example with a ₹10.00 fee withheld, net proceeds are ₹990.00, the scheduled payment remains ₹1,010.00 and the difference is ₹20.00. Test fee-on-top, waived or prepaid rules only where the quote offers them. Label periodic and annualized estimates with their assumptions.
- Sum scheduled principal to amount financed, interest to disclosed interest and payments to scheduled principal plus interest and any amounts charged through installments. Each opening balance equals the previous closing balance. Accrued interest, fees and penalties each have a single place in the cash-flow reconciliation.
- Cover the smallest allowed amount/tenure, boundary rates and principals, zero/negative or excessive inputs, zero-income ratios, exhausted emergency funds, shortfall, fully scholarship-funded semesters and affordability below the minimum. Undefined ratios need a meaningful UI state. Assert finite values wherever an estimate is defined.
- Compare two schedules identical until a floating-rate change. Confirm the original rate through the effective date and the new rate thereafter. Exercise late/partial payments across a period boundary and verify a repeated job cannot charge the same overdue item twice.
- Send the same payment intent twice, including concurrently, and verify one ledger effect. Reuse its identifier with a different amount or loan and verify a clear error. Race two distinct close-out attempts, check outstanding principal for underflow and compare both ledger outcomes.
- Induce a transaction failure in an isolated test database between recording payment and completing related updates. Verify balance, ledger, schedule and dependent state resolve together. Restart workers mid-job and check replay produces the intended single outcome.

## Isolation and user experience checks

- Exercise every protected route with a logged-out user, the owning customer, another customer and the administrator where permitted. Include documents, statements, simulation details, exports, notifications, disputes, actions and list totals. A rejected request must leave persisted state intact.
- Check login and recovery responses for account enumeration, expired/used tokens, logout invalidation and deactivation. Inspect browser bundles and sanitized logs for credentials, raw session tokens, reset secrets and unnecessary identity data.
- Validate schema, content length and media type for document uploads. Test a disallowed type, an over-limit file and safe filename handling with benign synthetic inputs. Serve documents only to authorized users. Test state-changing requests with missing or incorrect anti-forgery information where cookie authentication is used.
- Submit ordinary text containing punctuation, Unicode and HTML-significant characters and verify it displays as text. Check printable and CSV outputs for correct field quoting and safe handling of spreadsheet-formula prefixes in user-provided fields.
- Exercise a slow response, a failed request with retry, empty accounts and completed actions. Check double submissions, rapid filter changes and refresh/back behavior. A financial balance may be presented as settled only after the C++ service commits the change.
- Use keyboard alone for the main flows and return from dialogs to the triggering control. Check labels, errors, focus, non-color status cues, chart summaries, zoom/reflow, dark theme and reduced motion. Keep browser console and failed-request evidence with relevant viewport tests.

## Synthetic seed coverage

| Persona or fixture | Required differences and data relationships |
| --- | --- |
| New borrower and college student | At least one borrower without conventional history, consented alternative evidence, a separate insufficient-evidence path, and education semesters with staggered funding. |
| Salaried professional and on-time borrower | Stable income, verified synthetic KYC, several due periods with on-time ledger history and enough documented capacity for Scenario B. |
| Freelancer, informal worker, small shopkeeper | Irregular income or business cash flow with transparent source and expense records. Preserve meaningful differences in the inclusive assessment. |
| High-debt and temporarily distressed borrowers | Distinguishable excess-obligation and temporary-income-loss cases, reasoned rejection, recovery actions, overdue dues and a support case. |
| Multi-loan and completed-loan borrowers | Different loan balances/rates with opposite avalanche and snowball priorities, an active schedule, settled transactions, a closed loan and certificate source data. |
| Administrator and review queues | Pending and reviewed KYC, submitted/review/info-request/approved/rejected applications, pending investigation, resolved dispute, versioned score history, timestamped decisions and audit events. |

Use fictional names, synthetic files and reserved example email domains. Record the reference date used by time-dependent fixtures. Derive aggregates from these entities and test an empty filtered result as well as the populated dashboard.

## Academic evidence

For each demonstration, record the actual source path, class or function, calling path, test name and observable effect. The suggested responsibilities below identify what to search for during that review.

| Area | Evidence to connect to implementation |
| --- | --- |
| Domain model | User/customer/admin behavior or permissions; financial profile composed of income and expenses; credit profile/engine/strategy, risk and eligibility; abstract loan and its eight concrete product policies/factory; application manager/state; EMI engine/schedule; repayment and transaction values; debt optimizer, digital twin, stress, fraud, notifications, reports and audit. |
| C++ language | Constructors/destructors and resource lifetime, encapsulated invariants, abstraction, inheritance, virtual dispatch/destruction, meaningful overloads, copy/move behavior in simulations or ownership, templates, composition, aggregation, association, STL use, exceptions, file handling, RAII and smart pointers. Demonstrate a clone changing independently and rollback during an exception. |
| Data structures | Vector iteration, unordered lookup, ordered records, duplicate-detection sets, sequential queue, priority queue, reversible non-financial stack, greedy allocation, sorting/search and sliding time windows. Show input sizes and expected complexity. If a synthetic relationship graph exists, explain its vertices, edges and traversal. |
| Operating systems | HTTP/worker thread pool, producer-consumer queue, mutex protection, condition-variable wakeups, concurrent applications, scheduled reminders/analytics, connection/resource lifetimes and graceful shutdown. Tie each guarantee to a concurrency test or observed recovery run. |
| Patterns | Show the loan factory selecting a concrete product, changing a scoring/eligibility/repayment strategy, a committed event reaching a notification observer, the database adapter behind a repository interface, enforcement of a workflow transition and execution/auditing of an admin command. |
