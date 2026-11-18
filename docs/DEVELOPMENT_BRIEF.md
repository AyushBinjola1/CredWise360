# MASTER DEVELOPMENT PROMPT — CREDWISE 360

## 1. Your role and mission

Act as an exceptional principal software architect, senior C++ engineer, full-stack developer, fintech product designer, cybersecurity engineer, database architect and QA engineer.

Build **CredWise 360 — Intelligent, Inclusive & Responsible Lending Ecosystem**.

Tagline: *Borrow wisely. Build credit. Achieve financial freedom.*

Create a complete, exceptionally polished, functional, responsive and performant fintech platform that demonstrates the entire digital lending lifecycle while promoting responsible borrowing, financial inclusion, financial literacy and debt freedom.

The application must be impressive enough to:

- Win a college-level Best OOP Project award.
- Impress experienced software engineers and fintech professionals.
- Serve as an outstanding portfolio and resume project.
- Demonstrate practical implementation of advanced C++ OOP, DSA and operating system concepts.
- Feel like a genuine, high-quality commercial fintech product.

Do not create a generic loan management application or a superficial dashboard. Build a coherent, feature-rich system in which every module meaningfully interacts with the others.

## 2. Non-negotiable development requirements

- Every button, form, calculator, filter, chart and navigation element must work.
- Implement genuine business logic, not hardcoded outputs or cosmetic simulations.
- No unfinished pages, placeholder functionality, TODO implementations or broken links.
- All changes to financial profiles, applications, repayments and transactions must persist.
- The frontend must communicate with a functional backend.
- The core financial and lending logic must be implemented in C++.
- Do not bypass the C++ backend by duplicating the authoritative business logic in JavaScript.
- Maintain clean, modular, scalable and understandable source code.
- Create a complete application that can be run locally and demonstrated without paid external services.
- Use synthetic financial and identity data for demonstration.
- Clearly distinguish simulated credit scores from actual credit bureau scores.
- Never represent deterministic rule-based logic as trained artificial intelligence.
- Prioritize financial correctness, data integrity, accessibility, security and usability.

## 3. Technology stack

Use a modern, maintainable architecture.

### Frontend

- Next.js with App Router.
- React.
- TypeScript with strict type checking.
- Tailwind CSS.
- shadcn/ui components.
- Lucide icons.
- Recharts for interactive data visualization.
- Framer Motion for purposeful, lightweight animations.
- TanStack Query for API state management.
- React Hook Form and Zod for validation.

### Core backend

- Modern C++ using C++17 or C++20.
- Drogon or another suitable C++ REST API framework.
- CMake for build management.
- JSON serialization and deserialization.
- Clear controller, service, repository and domain layers.
- Proper multithreading, synchronization and exception handling.

### Database

- PostgreSQL.
- Transaction-safe database operations.
- Database migrations.
- Synthetic seed datasets.
- Repository interfaces to support future storage implementations.

### Infrastructure

- Docker and Docker Compose.
- Environment-based configuration.
- GitHub Actions for continuous integration.
- OpenAPI documentation.
- Automated frontend and backend testing.

Use stable, mutually compatible dependencies. Select simpler alternatives when necessary for reliability without compromising the required C++ architecture.

## 4. System architecture

Implement a modular, layered architecture.

Architecture flow:

Frontend application → API gateway or HTTP layer → C++ controllers → application services → domain models and business engines → repositories → database.

Separate responsibilities into:

- Presentation layer.
- API layer.
- Application layer.
- Domain layer.
- Financial calculations layer.
- Persistence layer.
- Security layer.
- Notification layer.
- Analytics layer.
- Background processing layer.

Use dependency injection, interfaces and composition where appropriate.

Suggested repository structure:

- apps/web — Next.js frontend.
- services/core — C++ backend.
- services/core/domain — domain classes.
- services/core/services — business services.
- services/core/controllers — REST controllers.
- services/core/repositories — persistence interfaces and implementations.
- services/core/engines — credit, risk, loan and financial engines.
- services/core/security — authentication and authorization.
- services/core/workers — concurrent application processing.
- services/core/tests — C++ unit and integration tests.
- database/migrations — database schema.
- database/seeds — realistic demonstration datasets.
- docs — architecture, UML, API and implementation documentation.

Avoid unnecessary microservices and architectural complexity. Prefer a well-structured modular backend that can be deployed and demonstrated reliably.

## 5. Branding and design direction

Create a world-class visual identity inspired by the quality, simplicity and attention to detail of leading modern fintech products.

The design should feel premium, trustworthy, sophisticated, welcoming and financially empowering.

### Color system

- Primary brand: deep emerald green.
- Primary background: warm off-white.
- Main text: deep charcoal.
- Secondary text: muted slate.
- Success: emerald.
- Warning: amber.
- Error and critical risk: controlled red.
- Informational states: blue.

Provide carefully designed light and dark themes with consistent semantic colors.

### Typography

Use a refined, modern sans-serif font such as Geist or Inter. Financial figures should use tabular numerals for alignment and readability.

Create a clear visual hierarchy using typography, whitespace and grouping.

### Visual design principles

- Elegant editorial layouts.
- Consistent spacing and alignment.
- Purposeful, restrained use of shadows.
- Refined borders.
- Modern financial charts.
- Excellent information density without clutter.
- Beautiful but functional data tables.
- Clear typography hierarchy.
- Professional empty states.
- Responsive interactive cards.
- High-quality onboarding flows.
- Thoughtful animations and microinteractions.

Avoid excessive gradients, glassmorphism, oversized headings, unnecessary decorations and generic AI-generated dashboard aesthetics.

Do not make every component a rounded card. Use layouts, typography, dividers and white space intelligently.

Every screen should feel intentionally designed rather than assembled from default components.

## 6. Website structure

Create a complete public-facing website and authenticated web application.

### Public website

- Landing page.
- About CredWise.
- How it works.
- Features.
- Loan products.
- Financial literacy resources.
- Public loan calculator.
- Loan comparison tool.
- Frequently asked questions.
- Login and registration.
- Privacy information.
- Terms of use.
- Simulation disclaimer.

The homepage must immediately communicate the platform's mission: helping people access responsible credit and achieve financial freedom.

### Customer application

- Overview dashboard.
- Financial profile.
- Credit health.
- Credit score digital twin.
- Loan marketplace.
- Loan applications.
- Loan details.
- Active loans.
- Repayment management.
- Debt freedom planner.
- Financial stress testing.
- Education loan planner.
- Loan safety checker.
- Financial recovery roadmap.
- Financial literacy academy.
- Notifications.
- Reports and statements.
- Support and disputes.
- Settings and security.

### Admin application

- Executive overview.
- Customer management.
- Application processing.
- Underwriting workspace.
- Active loan portfolio.
- Repayment monitoring.
- Risk analytics.
- Fraud monitoring.
- Fairness monitoring.
- Distressed borrower management.
- Dispute resolution.
- Product configuration.
- Audit logs.
- Reports.
- System health.

Implement role-based navigation and route protection.

## 7. Authentication and user management

Implement:

- Registration.
- Secure login.
- Logout.
- Session management.
- Password hashing using a trusted implementation.
- Password reset workflow suitable for local demonstration.
- Customer and administrator roles.
- Profile management.
- Account activation and deactivation.
- User preferences.
- Notification preferences.
- Input validation.
- Failed login monitoring.
- Account recovery.

Never store passwords in plain text.

Include clearly marked customer and admin demo accounts for seamless project evaluation.

## 8. Digital KYC module

Implement a simulated digital KYC process.

Features:

- Personal information.
- Address details.
- Employment verification.
- PAN-format validation using synthetic values.
- Simulated identity verification.
- Document upload interface.
- KYC status tracking.
- Verification workflow.
- Document rejection reasons.
- Resubmission.
- Admin review.

Do not request real Aadhaar numbers, sensitive banking credentials or unnecessary identity information.

Use synthetic documents and clearly identify verification as simulated.

## 9. Comprehensive financial profile

Create a complete financial profile containing:

- Income sources.
- Employment type.
- Employment stability.
- Salary.
- Business or freelance income.
- Essential expenses.
- Discretionary expenses.
- Monthly savings.
- Existing loans.
- Existing EMI obligations.
- Outstanding debt.
- Assets.
- Liabilities.
- Emergency savings.
- Repayment history.
- Financial goals.

Automatically calculate:

- Monthly disposable income.
- Net worth.
- Savings ratio.
- Debt-to-income ratio.
- EMI-to-income ratio.
- Emergency fund coverage.
- Financial health index.

Display a clear monthly cash-flow visualization.

Financial profile changes must automatically update relevant credit, affordability and risk calculations.

## 10. Intelligent credit scoring engine

Implement an explainable, configurable simulated credit scoring engine in C++.

Use transparent factors such as:

- Repayment history.
- Credit utilization.
- Outstanding debt obligations.
- Credit history length.
- Recent loan applications.
- Income consistency.
- Financial resilience.

Generate a simulated score within a documented 300–900 range.

Maintain separate calculations for:

- Simulated creditworthiness.
- Affordability.
- Income stability.
- Overall financial health.
- Repayment risk.

Do not conflate income or wealth with actual bureau credit scores.

Provide:

- Score breakdown.
- Positive factors.
- Negative factors.
- Factor weights.
- Credit score history.
- Score improvement suggestions.
- Risk category.
- Reason codes.
- Comparison with prior assessments.

Use Strategy Pattern interfaces to allow different scoring policies.

All weights and thresholds must be configurable and testable.

Do not use protected characteristics such as religion, caste, gender or ethnicity to determine creditworthiness.

## 11. Flagship feature: Credit Score Digital Twin

Build an exceptional interactive financial simulation environment.

Allow customers to clone their current financial profile into a temporary simulated scenario.

They should be able to:

- Increase or decrease income.
- Modify expenses.
- Repay outstanding debt.
- Add a hypothetical loan.
- Simulate a missed repayment.
- Change monthly savings.
- Increase emergency reserves.
- Modify credit utilization.
- Simulate financial events.

Immediately calculate:

- Potential change in simulated credit score.
- Change in financial health.
- Change in borrowing capacity.
- Change in debt-to-income ratio.
- Change in repayment risk.
- Financial resilience.

Display current and simulated profiles side by side.

Include:

- Interactive sliders.
- Before-and-after score visualization.
- Financial impact charts.
- Scenario presets.
- Scenario saving.
- Reset functionality.
- Explainable impact analysis.

The simulation must never modify the customer's actual persisted financial profile unless explicitly requested through a valid profile update.

Demonstrate C++ copy constructors, encapsulation, composition and polymorphism through this module.

## 12. Inclusive and alternative credit scoring

Create an alternative assessment pathway for people without conventional credit histories.

Support:

- Students.
- First-time borrowers.
- Small business owners.
- Self-employed individuals.
- Freelancers.
- Informal workers.

With user consent, consider synthetic or voluntarily provided information such as:

- Rent repayment history.
- Utility bill payment consistency.
- Business cash flow.
- Income regularity.
- Savings behaviour.
- Existing financial commitments.

Distinguish between insufficient evidence and poor financial behaviour.

Provide human-review recommendations when evidence is limited.

Explain every assessment factor.

The system must not automatically penalize users simply because they have no conventional credit history.

This module is a major social-impact differentiator.

## 13. Loan product marketplace

Implement multiple configurable loan products:

- Personal loan.
- Education loan.
- Home loan.
- Vehicle loan.
- Business loan.
- Gold loan.
- Emergency loan.
- Microfinance loan.

Each product must have independent:

- Eligibility rules.
- Principal limits.
- Interest calculation policy.
- Minimum and maximum tenure.
- Processing fees.
- Documentation requirements.
- Collateral requirements where applicable.
- Repayment rules.
- Risk policy.

Use an abstract Loan base class and derived loan classes.

Implement polymorphic functions for eligibility, fee calculation, validation and repayment behaviour.

Display products as elegant, readable marketplace cards with detailed product pages.

Clearly label interest rates and products as demonstration data.

## 14. Smart loan recommendation engine

Build a recommendation engine that matches suitable loan products to customer requirements.

Evaluate:

- Loan purpose.
- Requested principal.
- Financial profile.
- Existing debt.
- Repayment capacity.
- Creditworthiness.
- Available tenure.
- Financial risk.
- Product eligibility.

Rank suitable products using explainable criteria.

Show:

- Recommended product.
- Compatibility score.
- Estimated monthly EMI.
- Estimated total interest.
- Total borrowing cost.
- Reason for recommendation.
- Limitations and risk warnings.

Provide alternative options.

Never recommend a larger loan merely because a borrower appears eligible for it.

Prioritize affordability and the customer's stated needs.

## 15. Advanced loan affordability engine

Develop an accurate C++ financial calculation engine.

Support:

- Reducing-balance EMI calculation.
- Zero-interest loans.
- Total repayment.
- Total interest.
- Processing fees.
- Upfront charges.
- Amortization schedules.
- Fixed interest calculations.
- Floating-rate scenarios.
- Partial prepayment.
- Full prepayment.
- Loan foreclosure.
- Effective borrowing cost estimates.

Use safe monetary representations such as integer minor currency units and carefully controlled rounding.

Ensure the final repayment reconciles the outstanding principal correctly.

Handle invalid input and numerical edge cases.

Use the backend as the authoritative source for financial calculations.

Create an interactive calculator with instantly understandable visualizations, responsive controls and monthly repayment breakdowns.

## 16. Smart loan comparison

Allow users to compare up to four loan products simultaneously.

Compare:

- Principal.
- Interest rate.
- Monthly EMI.
- Repayment tenure.
- Processing charges.
- Total interest.
- Total repayment.
- Estimated effective borrowing cost.
- Eligibility requirements.
- Prepayment conditions.

Highlight:

- Lowest total cost.
- Lowest monthly EMI.
- Shortest repayment duration.
- Suitable borrowing conditions.

Do not label an option as universally best based only on a low EMI.

Use comparison tables and meaningful charts.

## 17. Complete loan application workflow

Implement a multi-step application process:

1. Select loan product.
2. Specify purpose, amount and tenure.
3. Review financial profile.
4. Run eligibility checks.
5. Review amortization and total cost.
6. Submit required synthetic documentation.
7. Confirm application.
8. Receive application tracking ID.
9. Automated assessment.
10. Underwriting or human review.
11. Simulated approval, rejection or request for information.
12. Acceptance of simulated terms.
13. Simulated disbursement.
14. Active loan creation.

Application statuses must follow a validated state machine.

Include:

- Draft.
- Submitted.
- Under review.
- Requires information.
- Approved.
- Rejected.
- Accepted.
- Disbursed.
- Active.
- Closed.
- Defaulted.
- Withdrawn.

Prevent invalid status transitions.

Maintain a complete timestamped application activity timeline.

## 18. Explainable loan rejection and financial recovery

This is a flagship feature.

Never show a rejection without a meaningful explanation.

Generate:

- Reason codes.
- Plain-language explanations.
- Relevant affordability factors.
- Specific simulated improvements.
- Alternative products where appropriate.
- Personalized recovery milestones.
- Reassessment eligibility.

Allow users to test improvements in the Credit Score Digital Twin.

Allow eligible rejected applications to be reassessed using updated information.

Include a dispute and human-review workflow.

Never guarantee that completing a recovery plan will result in approval.

## 19. Complete loan management system

Implement end-to-end management of active loans.

Display:

- Original principal.
- Outstanding principal.
- Current interest rate.
- Monthly EMI.
- Amount repaid.
- Next repayment date.
- Remaining tenure.
- Loan progress.
- Interest paid.
- Loan amortization schedule.
- Payment history.

Support:

- Simulated EMI payments.
- Partial payments.
- Advance payments.
- Prepayments.
- Foreclosure.
- Late repayment handling.
- Penalty calculation using configured rules.
- Updated amortization.
- Loan closure.
- Downloadable closure certificate.

Simulated payments must create transaction records and update balances atomically.

Prevent duplicate transactions.

Maintain permanent repayment history.

## 20. Debt Freedom Navigator

Build a personal debt optimization engine.

Allow users to manage several loans together.

Implement:

- Debt avalanche algorithm.
- Debt snowball algorithm.
- Individual loan prioritization.
- Extra monthly repayment allocation.
- Simulated interest savings.
- Estimated debt-free date.
- Repayment schedule comparison.
- Progress tracking.

Use suitable greedy algorithms and priority queues in C++.

Let users select their preferred strategy and monthly extra repayment budget.

Visualize:

- Debt reduction over time.
- Monthly repayment allocation.
- Interest savings.
- Individual loan closure dates.
- Debt-free milestones.

Ensure all projections follow the configured interest and prepayment rules.

## 21. Financial stress testing

Create a scenario-based financial resilience tool.

Support:

- Temporary unemployment.
- Salary reduction.
- Business income reduction.
- Unexpected expenses.
- Increase in interest rates.
- Increase in essential living expenses.
- Simultaneous financial shocks.

Calculate:

- Remaining disposable income.
- Emergency fund survival duration.
- Change in repayment burden.
- Cash-flow shortfalls.
- Potential repayment difficulty.

Show risk indicators, charts and plain-language explanations.

Provide a structured financial resilience roadmap without presenting simulated predictions as guaranteed outcomes.

## 22. Education Loan Planner

Create a dedicated education loan planning experience.

Support:

- Course duration.
- Semester-wise tuition fees.
- Hostel and living expenses.
- Scholarships.
- Personal contributions.
- Multiple loan disbursements.
- Moratorium period.
- Interest accumulation during studies.
- Voluntary interest payment during education.
- Expected salary scenarios.
- Repayment after graduation.
- Floating interest scenarios.
- Partial prepayments.

Display:

- Total educational cost.
- Total amount borrowed.
- Outstanding amount at graduation.
- Interest accrued during education.
- Estimated repayment EMI.
- Total loan cost.
- Debt-free timeline.

Compare repayment strategies.

Include optional scholarship and subsidy configuration without making unverified eligibility claims.

Make this module visually exceptional and useful for university students.

## 23. Predatory Loan Protector

Develop a consumer protection module.

Allow users to enter details of an external hypothetical loan offer.

Analyze:

- Advertised interest.
- Processing fees.
- Mandatory charges.
- Net disbursed amount.
- repayment amount.
- Penalties.
- Repayment frequency.
- Prepayment restrictions.

Calculate estimated actual borrowing cost.

Highlight:

- Potential hidden fees.
- Excessive repayment burden.
- Suspicious terms.
- Unclear charging structures.
- Discrepancies between advertised and calculated cost.

Explain each warning.

Include a safe-borrowing checklist.

Clearly state that flags do not establish that a lender is fraudulent.

## 24. Financial distress early warning system

Monitor simulated repayment and cash-flow indicators.

Detect:

- Increasing debt burden.
- Repeated missed payments.
- Falling savings.
- Declining disposable income.
- Upcoming large repayments.
- Emerging cash-flow shortages.

Generate explainable alerts.

Suggest simulated mitigation options:

- Review budget.
- Explore eligible repayment restructuring.
- Adjust optional expenses.
- Make manageable repayments.
- Seek human support.

Allow admins to prioritize cases requiring compassionate intervention.

Do not automatically penalize or blacklist users solely based on predicted difficulty.

## 25. Financial literacy academy

Create a complete educational module.

Include short interactive lessons on:

- Credit scores.
- Interest rates.
- EMIs.
- Simple and compound interest.
- Loan affordability.
- Credit utilization.
- Debt management.
- Responsible borrowing.
- Loan fraud awareness.
- Emergency funds.
- Education loans.

Include:

- Interactive examples.
- Mini quizzes.
- Correct-answer explanations.
- Learning progress.
- Completion badges.
- Hindi and English support where practical.

Provide accessible and simple explanations for first-time borrowers.

## 26. Notifications and reminders

Implement a persistent notification system.

Support:

- Application submission.
- Application updates.
- Approval and rejection.
- Required documentation.
- EMI reminders.
- Successful payments.
- Late payments.
- Financial distress warnings.
- Recovery milestones.
- Loan closure.
- Security alerts.

Include:

- In-app notification center.
- Read and unread states.
- Mark-all-read.
- Filtering.
- Notification preferences.
- Background reminder generation.
- Duplicate-event prevention.

Use Observer Pattern or a reliable event-driven design.

## 27. Responsible rewards system

Implement optional educational rewards for responsible financial behaviour.

Reward:

- Completing financial literacy lessons.
- Creating repayment plans.
- Consistent on-time payments.
- Meeting savings goals.
- Reaching debt-reduction milestones.

Do not reward users for taking unnecessary loans or increasing their debt.

Make rewards educational and motivational.

All simulated discounts must follow documented product rules.

## 28. Fraud and anomaly detection

Implement an explainable rule-based fraud monitoring system.

Flag:

- Duplicate synthetic identities.
- Multiple suspicious applications.
- Rapid repeated application attempts.
- Inconsistent declared financial information.
- Repeated failed login attempts.
- Suspicious transaction duplication.
- Unusual repayment events.

Use hash maps, sets, sliding-window counters and graph relationships where appropriate.

Each alert must contain:

- Risk severity.
- Triggered rules.
- Relevant evidence.
- Timestamp.
- Investigation status.
- Assigned administrator.
- Resolution.

Do not automatically classify flagged customers as fraudsters.

Require administrator investigation.

## 29. Admin underwriting workspace

Build a professional loan underwriting interface.

Features:

- Application queue.
- Search and advanced filters.
- Application priority.
- Applicant financial profile.
- KYC status.
- Credit analysis.
- Affordability analysis.
- Risk factors.
- Fraud alerts.
- Document review.
- Application history.
- Approval recommendation.
- Decision notes.
- Approve.
- Reject with reason.
- Request additional information.
- Escalate for review.

Require appropriate role permissions.

Use fair, configurable queue prioritization rather than arbitrary preferential treatment.

Every decision must create an audit event.

## 30. Admin analytics and portfolio management

Create a beautiful executive dashboard.

Display:

- Total customers.
- Active borrowers.
- Total loan applications.
- Approval rate.
- Rejection rate.
- Pending applications.
- Disbursed principal.
- Outstanding principal.
- Repayment collections.
- Overdue repayments.
- Portfolio risk.
- Default rate.
- Average simulated credit score.
- Income from interest and configured fees.

Include interactive visualizations:

- Credit score distribution.
- Application funnel.
- Monthly originations.
- Loan product distribution.
- Repayment trends.
- Delinquency trends.
- Risk distribution.
- Customer growth.
- Portfolio quality.

Provide:

- Date-range filtering.
- Loan-type filters.
- Risk filters.
- Search.
- Pagination.
- Sorting.
- Drill-down views.
- CSV export.
- Printable reports.

All metrics must derive from actual persisted or seeded records.

Do not invent dashboard values.

## 31. Lending fairness and transparency

Implement a fairness monitoring module.

Test credit and eligibility policies using equivalent synthetic financial profiles.

Identify whether irrelevant profile attributes affect outcomes.

Include:

- Scoring-policy explanations.
- Configurable factor weights.
- Consistency testing.
- Counterfactual assessments.
- Human-review rates.
- Rejection reason distribution.
- Policy change history.

Exclude protected personal characteristics from creditworthiness calculations.

Demonstrate how transparent rules improve accountability.

## 32. Dispute resolution and customer support

Allow customers to:

- Raise disputes.
- Report incorrect financial records.
- Request application reconsideration.
- Challenge incorrect simulated assessments.
- Submit supporting synthetic evidence.
- Track ticket status.
- View administrator responses.

Allow administrators to:

- Assign tickets.
- Review evidence.
- Respond.
- Resolve tickets.
- Request further information.
- Maintain resolution history.

Implement a complete ticket lifecycle.

## 33. Reports and exports

Generate:

- Financial health reports.
- Simulated credit score reports.
- Loan eligibility reports.
- Loan amortization schedules.
- Repayment statements.
- Transaction histories.
- Loan closure certificates.
- Debt freedom plans.
- Stress-test reports.
- Education loan projections.
- Application summaries.
- Portfolio reports.
- Audit reports.

Support PDF or print-ready reports and CSV export where applicable.

Reports must be well-formatted, accurate, printable and derived from current application data.

## 34. Database design

Create a normalized and well-indexed relational schema.

Include appropriate entities for:

- Users.
- Roles.
- Sessions.
- Customer profiles.
- Financial profiles.
- Income sources.
- Expenses.
- Assets.
- Liabilities.
- KYC records.
- Synthetic documents.
- Credit assessments.
- Credit score history.
- Scoring policies.
- Loan products.
- Loan applications.
- Application decisions.
- Loans.
- Repayment schedules.
- Transactions.
- Penalties.
- Simulation scenarios.
- Financial goals.
- Fraud alerts.
- Notifications.
- Disputes.
- Learning progress.
- Audit events.

Use:

- Foreign keys.
- Unique constraints.
- Database transactions.
- Indexes.
- Explicit status fields.
- Created and updated timestamps.
- Appropriate monetary data types.

Ensure financial data consistency and safe concurrent modification.

## 35. C++ OOP implementation

The C++ backend is a major academic requirement.

Create meaningful domain classes, including:

- User.
- Customer.
- Administrator.
- FinancialProfile.
- IncomeSource.
- Expense.
- CreditProfile.
- CreditScoreEngine.
- RiskAnalyzer.
- ScoringStrategy.
- EligibilityPolicy.
- Loan.
- PersonalLoan.
- EducationLoan.
- HomeLoan.
- VehicleLoan.
- BusinessLoan.
- GoldLoan.
- MicrofinanceLoan.
- LoanFactory.
- LoanApplication.
- LoanApplicationManager.
- EMIEngine.
- AmortizationSchedule.
- Repayment.
- Transaction.
- DebtOptimizer.
- FinancialDigitalTwin.
- StressTestEngine.
- FraudDetector.
- NotificationService.
- ReportGenerator.
- AuditLogger.

Demonstrate genuine implementation of:

- Classes and objects.
- Constructors and destructors.
- Encapsulation.
- Abstraction.
- Inheritance.
- Runtime polymorphism.
- Virtual functions.
- Virtual destructors.
- Function overloading.
- Operator overloading where meaningful.
- Copy and move semantics.
- Templates.
- Composition.
- Aggregation.
- Association.
- STL.
- Exception handling.
- File handling.
- RAII.
- Smart pointers.

Do not artificially add unnecessary classes just to demonstrate academic concepts.

Document exactly where each OOP concept is used.

## 36. Data structures and algorithms

Use appropriate data structures for real functionality.

- Vectors: collections of loans, transactions and customers.
- Unordered maps: indexed customer and transaction lookup.
- Maps: ordered financial records where required.
- Sets: duplicate detection.
- Queues: sequential application workflow.
- Priority queues: underwriting and repayment reminder scheduling.
- Stacks: reversible non-financial UI or administrative actions.
- Graphs: optional synthetic borrower-guarantor relationships.
- Greedy algorithms: debt repayment optimization.
- Sorting and searching: records and product rankings.
- Sliding windows: suspicious activity detection.

Use the database for persistent querying and indexing.

Do not use in-memory structures as an unsafe substitute for durable financial records.

Document algorithmic complexity and design choices.

## 37. Operating system concepts

Demonstrate practical operating system concepts through backend infrastructure.

Implement:

- Multithreading.
- Thread pools.
- Concurrent loan application processing.
- Producer-consumer queues.
- Mutexes and locks where necessary.
- Condition variables.
- Background notifications.
- Scheduled analytics jobs.
- Thread-safe repositories or service operations.
- Graceful shutdown.
- Resource management.

Ensure:

- No data races.
- No avoidable deadlocks.
- No duplicate processing.
- No inconsistent balances.
- No unsafe shared mutable state.

Use automated concurrency tests.

## 38. Design patterns

Use appropriate patterns, including:

- Factory Pattern: construction of different loan types.
- Strategy Pattern: credit scoring, eligibility and repayment policies.
- Observer Pattern: notifications and domain events.
- Repository Pattern: persistence.
- State Pattern or validated state machine: loan application lifecycle.
- Command Pattern: controlled administrative actions.
- Adapter Pattern: database and external integration boundaries.

Prefer interfaces and dependency injection over unnecessary global state or singletons.

## 39. API requirements

Create a complete REST API.

Include endpoints for:

- Authentication.
- Customer profiles.
- Financial profiles.
- KYC.
- Credit assessments.
- Credit simulations.
- Loan products.
- Loan comparisons.
- Loan applications.
- Underwriting decisions.
- Active loans.
- EMI calculations.
- Repayments.
- Debt optimization.
- Financial stress tests.
- Education loan planning.
- Loan safety analysis.
- Notifications.
- Reports.
- Analytics.
- Fraud investigations.
- Disputes.

Implement:

- Consistent response formats.
- Input validation.
- Error responses.
- Correct HTTP status codes.
- Pagination.
- Filtering.
- Sorting.
- Authentication middleware.
- Authorization middleware.
- Request logging.
- Idempotency for payment-like operations.

Generate and maintain OpenAPI documentation.

## 40. Security and privacy

Implement security throughout the system.

Requirements:

- Secure password hashing.
- Server-side authorization.
- Protected administrative endpoints.
- Rate limiting.
- Safe session handling.
- Input validation.
- Parameterized database queries.
- Protection against SQL injection.
- XSS protection.
- Appropriate CSRF protection.
- Secure file upload handling.
- Environment-based secrets.
- Redaction of sensitive values from logs.
- Audit logging.
- Least-privilege access.

Never expose database credentials or secrets in frontend code.

Never treat hidden frontend components as an authorization mechanism.

Do not collect real identity or financial credentials during the demo.

Do not implement real payment processing or disbursement.

All simulated financial transactions must remain clearly separated from actual financial services.

## 41. Responsive design

Design every page for:

- Small mobile screens.
- Large mobile screens.
- Tablets.
- Laptops.
- Full HD desktop monitors.
- Large desktop displays.

Use mobile-first responsive layouts.

Requirements:

- Responsive sidebar.
- Mobile-friendly navigation.
- Proper touch targets.
- Responsive forms.
- Tables with mobile-friendly presentation or scrolling.
- Responsive charts.
- No accidental horizontal overflow.
- Accessible dialogs.
- Correct handling of long names and large financial values.

Test at 360px, 390px, 768px, 1024px, 1440px and 1920px viewport widths.

Never sacrifice functionality on mobile devices.

## 42. Frontend performance

The website must feel exceptionally fast and smooth.

Implement:

- Server rendering where beneficial.
- Client components only where necessary.
- Route-level code splitting.
- Lazy loading of heavy visualizations.
- Optimized assets and fonts.
- Efficient caching.
- API response pagination.
- Debounced searching.
- Request cancellation.
- Efficient state management.
- Prefetching of important routes.
- Skeleton loading states.
- Optimistic updates only where safe.
- Avoidance of unnecessary re-renders.

Minimize dependency size and avoid performance-heavy visual effects.

Aim for excellent Lighthouse performance, accessibility, best-practices and SEO results on applicable pages.

Measure actual performance and fix bottlenecks.

## 43. Exceptional user experience

Every interaction should be thoughtfully designed.

Provide:

- Progressive onboarding.
- Clear next-step recommendations.
- Helpful field descriptions.
- Inline validation.
- Loading indicators.
- Skeletons.
- Empty states.
- Confirmation dialogs.
- Toast notifications.
- Error recovery.
- Success states.
- Breadcrumbs.
- Search.
- Keyboard navigation.
- Accessible focus states.
- Contextual help.
- Saved form drafts.
- Clear financial disclaimers.

Use understandable language.

Explain terms such as DTI, credit utilization, moratorium and amortization when users encounter them.

Avoid misleading interface patterns.

Never hide important loan costs or risks.

Support reduced-motion preferences.

Target WCAG 2.2 AA accessibility practices.

## 44. Realistic demonstration data

Create a rich synthetic seed dataset.

Include diverse fictional financial profiles:

- College student.
- Salaried professional.
- Freelancer.
- Small shopkeeper.
- First-time borrower.
- Borrower with high existing debt.
- Borrower with irregular income.
- Borrower with excellent repayment history.
- Borrower experiencing temporary financial distress.

Create applications across various statuses.

Include active loans with realistic repayment history, completed loans, overdue loans, resolved disputes, pending investigations and credit score histories.

Generate consistent dashboard statistics from these records.

Provide a guided demo mode containing predefined scenarios.

Evaluators must be able to experience the entire application without filling dozens of forms.

## 45. Automated testing

Implement thorough automated tests.

### C++ unit tests

Test:

- EMI calculations.
- Zero-interest calculations.
- Amortization schedules.
- Monetary rounding.
- Credit scoring.
- Scoring boundaries.
- Eligibility rules.
- Risk classification.
- Prepayment handling.
- Debt optimization.
- Alternative credit assessment.
- Stress testing.
- Education loan calculations.
- Fraud detection.
- Invalid state transitions.
- Exception handling.

### Integration tests

Test:

- Registration and authentication.
- Financial profile modification.
- Application submission.
- Underwriting.
- Loan approval and rejection.
- Simulated disbursement.
- Repayments.
- Loan closure.
- Notifications.
- Reports.
- Database persistence.
- Duplicate transaction prevention.
- Concurrent processing.
- Authorization enforcement.

### Frontend tests

Use suitable component and end-to-end testing tools.

Test all critical workflows across desktop and mobile viewports.

Include:

- Form validation.
- Navigation.
- Interactive charts.
- Calculators.
- Loading states.
- Error handling.
- Accessibility.
- Role restrictions.
- Responsive layouts.

Never claim tests pass unless they have actually been executed successfully.

## 46. End-to-end acceptance scenarios

The completed platform must successfully demonstrate these workflows:

### Scenario A: First-time borrower

Registration → financial profile → alternative credit assessment → appropriate loan recommendations → application submission → review → simulated decision.

### Scenario B: Responsible borrower

Application → approval → simulated disbursement → active loan → successful EMI → amortization update → extra repayment → loan closure certificate.

### Scenario C: Rejected borrower

Rejected application → explainable reasons → recovery roadmap → digital twin simulation → revised financial profile → reassessment.

### Scenario D: Student

Education expenses → semester-wise disbursement planning → moratorium simulation → graduation debt estimate → repayment strategy comparison.

### Scenario E: Financial distress

Income reduction scenario → early warning → financial stress analysis → simulated recovery plan.

### Scenario F: Fraud investigation

Suspicious application → rule-based alert → administrator investigation → documented resolution.

### Scenario G: Debt freedom

Multiple existing loans → avalanche and snowball comparison → extra-payment allocation → debt-free timeline.

### Scenario H: Consumer protection

External hypothetical loan offer → total cost analysis → warning explanations → safer-borrowing checklist.

All scenarios must work against the actual backend and persistent data.

## 47. Documentation and academic presentation

Deliver:

- Comprehensive README.
- Installation guide.
- Local setup instructions.
- Docker setup.
- Project architecture explanation.
- UML class diagrams.
- Use-case diagrams.
- ER diagram.
- API documentation.
- Application state machine.
- OOP concept mapping.
- DSA concept mapping.
- Operating system concept mapping.
- Design pattern explanations.
- Database schema documentation.
- Security considerations.
- Financial formula documentation.
- Testing instructions.
- Known limitations.
- Demo walkthrough.
- Viva preparation guide.

Include a table identifying the exact C++ classes and files that demonstrate every major academic concept.

The project must be understandable and explainable by second-year engineering students.

## 48. Four-member team distribution

Organize implementation responsibilities into four coherent modules.

Member 1:

- Authentication.
- User management.
- KYC.
- Financial profiles.
- Security.

Member 2:

- Credit scoring.
- Risk and eligibility.
- Digital twin.
- Inclusive credit.
- Financial stress testing.
- Loan recommendation.

Member 3:

- Loan lifecycle.
- EMI engine.
- Repayment management.
- Debt freedom.
- Education loan planner.
- Loan safety checker.

Member 4:

- Administration.
- Fraud detection.
- Analytics.
- Reports.
- Notifications.
- Dispute management.

Maintain shared interfaces and integration tests so modules function as one coherent system.

## 49. Development execution strategy

Do not attempt to generate a superficial version of every feature simultaneously.

First inspect the existing repository and identify constraints.

Create an implementation plan, architecture map and feature completion checklist.

Then execute in phases.

Phase 1: Project foundation, C++ backend, database, API contracts and design system.

Phase 2: Authentication, KYC, financial profile and core dashboard.

Phase 3: Credit scoring, eligibility, loan products and loan recommendation.

Phase 4: Loan application lifecycle, underwriting, EMI engine and repayments.

Phase 5: Credit digital twin, debt optimization, inclusive assessment, stress testing, education loan planning and consumer protection.

Phase 6: Notifications, financial literacy, fraud detection, disputes and fairness monitoring.

Phase 7: Admin analytics, reports, exports and demonstration data.

Phase 8: Responsive design refinement, accessibility, performance optimization, security hardening and comprehensive testing.

At the end of every phase:

- Build and run the application.
- Execute relevant tests.
- Fix errors.
- Validate frontend-backend integration.
- Verify persistence.
- Update documentation.
- Update the feature completion checklist.

Do not stop after writing a plan or building a landing page.

Continue implementing until the complete requested scope is achieved or a genuine technical blocker requires a user decision.

## 50. Final quality assurance

Before declaring completion:

- Verify every page.
- Verify every route.
- Verify every button.
- Verify every form.
- Verify every calculator.
- Verify every API endpoint.
- Verify database persistence.
- Verify every role restriction.
- Verify all major financial workflows.
- Verify error states.
- Verify loading states.
- Verify empty states.
- Verify desktop and mobile responsiveness.
- Review visual consistency.
- Check browser console errors.
- Run frontend builds.
- Run C++ builds.
- Run automated tests.
- Check database migrations.
- Review security issues.
- Check performance.
- Review documentation.

Fix discovered defects instead of merely listing them.

Provide a final completion report containing:

- Implemented features.
- Architecture summary.
- Technology stack.
- Test results.
- Setup commands.
- Demo credentials.
- Important source files.
- Academic concept mapping.
- Remaining limitations, if any.

Do not claim perfection or completion for features that have not been verified.

## Final instruction

Build CredWise 360 with exceptional attention to detail.

The result must be a cohesive, premium, feature-rich, reliable, accessible and visually stunning fintech platform with a genuine C++ OOP foundation.

Make every visual and technical decision in service of the user.

The platform should empower people to understand their finances, access responsible borrowing opportunities, avoid harmful debt and work towards financial independence.

Start building now.