# Financial conventions

CredWise is a local teaching model. Inputs, decisions, rates and identities are synthetic. Each account uses INR. All API monetary fields and posted ledger amounts are integer paise, with 100 paise per rupee. Display conversion happens at the web boundary.

## Cash flow and financial health

Monthly income is salary plus business income plus other recurring income. Monthly spending is essential plus discretionary expenses. Disposable income is income minus spending and existing monthly instalments. Savings are a planned allocation from disposable income. Net worth is recorded assets plus emergency reserves minus outstanding debt and separate liabilities.

The monthly EMI ratio divides monthly instalments by monthly income. The stock debt-to-income measure divides outstanding debt by twelve months of income. Emergency coverage divides reserves by one month of essential spending and contractual instalments. A zero denominator gives an unavailable measure. See the exact health-index implementation in `FinancialProfile::metrics()`.

## Amortization and the price of credit

For reducing-balance principal P, monthly rate r and n monthly instalments, the level instalment before rounding is P × r ÷ (1 − (1+r)⁻ⁿ). At zero interest it is P ÷ n. A monthly schedule rounds the interest to paise, allocates the remaining instalment to principal and reconciles the last payment to exactly the outstanding balance. For a flat-interest convention the interest calculation uses the original principal. A recalculation after a floating-rate adjustment uses the remaining balance and tenure.

An annual nominal rate in basis points converts to a monthly decimal rate by dividing by 120,000. Processing fees and upfront charges reduce the proceeds available to the borrower. The effective annual cost estimates the monthly discount rate that equates those proceeds with the scheduled cash outflows, then compounds it across twelve months. Quotations disclose both the payment schedule and fees.

The recorded schedule invariants are nonnegative balances, total scheduled principal equal to the original principal, a zero closing balance, and total instalments equal to principal plus scheduled interest. Where a contract adds a prepayment charge, that charge must also be included in the stated cost.

## Simulated assessment

The credit engine uses explicit, versioned policy weights. Conventional repayment evidence and consented alternative evidence have separate strategies. The customer can inspect the reason associated with each included factor. Affordability concerns the size of a sustainable monthly payment. Financial health concerns budget resilience. Both are displayed separately from creditworthiness.

## Worked classroom example

A zero-interest ₹10,000 loan over three months can reconcile with two ₹3,333.33 payments and a final ₹3,333.34 payment. A ₹100 processing fee reduces initial net proceeds to ₹9,900 when deducted at disbursement. It changes the borrower’s effective cost even though the nominal annual interest rate is zero.
