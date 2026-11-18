# Demonstration walkthrough

Use the two buttons on the sign-in screen to fill the demo credentials. **Borrower** opens Aarav Mehta’s synthetic financial profile and **Administrator** opens Meera Rao’s operations workspace. Use separate browser profiles to keep both sessions open. The customer and administrator share a local PostgreSQL database.

## Identity and profile

1. Create a fictional account. Save the one-time recovery code displayed after registration.
2. Open **Financial profile**. Enter a monthly salary of ₹62,500.25, essential spending of ₹17,000.25, discretionary spending of ₹5,500 and existing instalments of ₹2,500. Save each section. The overview shows ₹37,500 available before planned savings.
3. Submit a synthetic KYC document. In the administrator workspace, request a correction with a plain-language reason. Resubmit as the borrower and approve the updated evidence from the review queue.
4. Sign out and back in. The saved inputs and KYC status are recovered from PostgreSQL.
5. Use the recovery code on **Recover your account** to set a new password. Save the replacement code. The previous sessions expire.

## Market and credit

Review the borrower’s credit health and inspect the weighted factors. Change a financial input and view the assessment history. Use the public calculator to compare a zero-interest loan with a positive-rate loan. Inspect the final balance and the total fees as well as the monthly instalment.

The [acceptance matrix](acceptance-matrix.md) describes all eight evaluation journeys and their evidence requirements. The [verification ledger](../FEATURE_STATUS.md) records the checks executed in this checkout.
