# Demonstration walkthrough

Use the two buttons on the sign-in screen to fill the demo credentials. **Borrower** opens Ayush’s synthetic financial profile and **Administrator** opens Ayush Binjola’s operations workspace. Use separate browser profiles to keep both sessions open. The customer and administrator share a local PostgreSQL database.

## Identity and profile

1. Create a fictional account. Save the one-time recovery code displayed after registration.
2. Open **Financial profile**. Enter a monthly salary of ₹62,500.25, essential spending of ₹17,000.25, discretionary spending of ₹5,500 and existing instalments of ₹2,500. Save each section. The overview shows ₹37,500 available before planned savings.
3. Submit a synthetic KYC document. In the administrator workspace, request a correction with a plain-language reason. Resubmit as the borrower and approve the updated evidence from the review queue.
4. Sign out and back in. The saved inputs and KYC status are recovered from PostgreSQL.
5. Use the recovery code on **Recover your account** to set a new password. Save the replacement code. The previous sessions expire.

## Market and credit

Review the borrower’s credit health and inspect the weighted factors. Change a financial input and view the assessment history. Use the public calculator to compare a zero-interest loan with a positive-rate loan. Inspect the final balance and the total fees as well as the monthly instalment.

The [acceptance matrix](acceptance-matrix.md) describes all eight evaluation journeys and their evidence requirements. The [verification ledger](../FEATURE_STATUS.md) records the checks executed in this checkout.

## Lending, planning and oversight

1. As the borrower, open **Loan applications** to see the funded personal loan and the education application in underwriting. Open **My loans** for the schedule, then make a simulated EMI payment. The receipt, ledger, notification and dashboard all update.
2. As the administrator, open **Underwriting queue**, review the education application with its synthetic documents and approve or reject it. The borrower receives a notification. Open **Fraud review** and **Portfolio reports** to see figures calculated from the same ledger.
3. As the borrower, open **Credit score twin**, run a preset such as *Lower credit utilization* and compare factor scores. Your saved profile does not change. Then run **Stress test** (Job loss), **Debt freedom** (compare avalanche and snowball for the funded loan plus an added card) and **Education planner**. Save any scenario and reload to confirm it persists.
4. Sign in as `diya.nair@credwise.test` to see a rejection with a recovery roadmap and reassessment path.

## Protection, support, learning and fairness

1. As the borrower, open **Loan safety scanner**, choose **Load an example offer** and scan it. The effective annual cost is far above the advertised rate, each warning explains itself, and the checklist shows what to ask the lender. Nothing is saved.
2. Open **Wellbeing check** for plain-language indicators and a link to support. It never changes the score.
3. Open **Financial academy**, switch to हिन्दी, answer a quiz and read the explanation. Progress and points persist in **Rewards**. Taking or applying for a loan earns nothing.
4. Sign in as `diya.nair@credwise.test` and open **Support & disputes**. The reconsideration ticket is waiting for her reply. As the administrator, open **Support tickets** to see the same history, respond and resolve. Resolving with reconsideration sends the rejected application back to underwriting.
5. As the administrator, open **Fairness monitor** and run the test. Equivalent profiles that differ only in protected attributes give identical outcomes, while the control changes move the score.
6. Open **My reports** and download the financial health PDF, a loan statement, or a closure certificate after settling a loan. Administrators can download the portfolio PDF from **Portfolio reports**.
