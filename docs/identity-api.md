# Identity and financial profile API

Responses place the fields below in `data`. Errors carry `error.code` and `error.message`. All writes accept JSON and the `X-CredWise-Action: 1` header. Money is integer paise. Session credentials travel in the HTTP-only `cw` cookie.

| Method and path | Request | Successful data |
| --- | --- | --- |
| POST /auth/register | name, email, password | 201 · user, recovery_code |
| POST /auth/login | email, password | user |
| GET /auth/me | — | user |
| POST /auth/logout | {} | logged_out |
| POST /auth/recover | email, recovery_code, new_password | recovery_code (rotated) |
| GET /profile | — | profile, metrics |
| PUT /profile | Any subset of the profile fields below | profile, metrics |
| GET /settings | — | user, preferences |
| PUT /settings | Any of name, preferences, new_password, active | user, preferences |
| GET /kyc | — | kyc (null before submission) |
| POST /kyc | legal_name, address, employment, pan, document | 201 · kyc |
| GET /kyc/document | — | name, mime, content_base64 |
| GET /admin/kyc | status, page, page_size query parameters | items, total, page, page_size |
| POST /admin/kyc/{user_id} | status, reason | kyc |
| GET /admin/kyc/{user_id}/document | — | name, mime, content_base64 |
| GET /admin/users | q, page, page_size query parameters | items, total, page, page_size |
| POST /admin/users/{id} | active | user |

Public user fields are `id` (integer), `name`, `email`, `role`, `active` and `created_at`. The role is `customer` or `admin`. Administrators may activate or deactivate customers. Passwords contain 12–128 bytes. A password change or self-deactivation also requires `current_password`. Resetting a password revokes all sessions and rotates the recovery code. Changing a password in Settings revokes existing sessions and issues a fresh cookie to the current browser.

Preferences have `theme` (system, light, dark), `language` (en, hi), and a `notifications` object with Boolean applications, payments, learning and distress switches. Each settings write may include a partial preferences object.

## Profile and metrics

| Fields | Type and range |
| --- | --- |
| salary, business_income, other_income, essential, discretionary, savings, existing_emi, debt, assets, liabilities, reserves, goal_amount | Integer paise, 0–100,000,000,000 per field |
| employment | Nonblank text, up to 80 UTF-8 bytes |
| stability_months, credit_months | Integers, 0–1,200 |
| utilization | Integer percentage, 0–100 |
| income_regularity, rent, utilities | Nullable percentages, 0–100. A blank records missing evidence. An explicit zero records observed performance. |
| savings_reported, emi_reported | Boolean evidence flags. Updating an amount records it as reported. Setting its flag to false withdraws it from the alternative assessment. |
| on_time, missed | Repayment counts, 0–12,000 |
| consent | Boolean for optional alternative evidence |
| goal | Text, up to 240 UTF-8 bytes |

`income` totals the three monthly income sources. `expenses` totals essential and discretionary expenses. `disposable` subtracts expenses and existing EMI from income, before allocation to savings. `net_worth` adds assets and emergency reserves, then subtracts outstanding debt and other liabilities. Enter these categories separately to avoid double counting. `savings_rate` divides monthly savings by income. `dti` divides outstanding debt by 12 months of income, while `emi_ratio` measures the monthly EMI burden. `coverage` divides emergency reserves by one month of essential expenses and existing EMI. Ratios with missing denominators are null. Financial `health` combines cash-flow margin, savings, coverage and EMI burden into a 0–100 index, with null for missing income.

## Synthetic KYC

The document schema is `{name,mime,content_base64}`. Plain text must be valid UTF-8 beginning with `CREDWISE-SYNTHETIC`. PDF must start with `%PDF-` and contain that marker. A file may contain at most 256 KiB. The simulated PAN follows the reserved demo convention, for example `DEMOX1234Q`. Identifiers are synthetic and never checked against an external identity provider.

A KYC record contains `id,user_id,legal_name,address,employment,pan,status,reason,created_at,updated_at` and `document:{id,name,mime,size,sha256}`. The administrator queue additionally returns the account's `name,email`. A fresh submission is pending. A reviewer chooses verified or rejected and must provide a reason for a rejection. A rejected submission can be revised with a new document. Both customers and administrators retrieve authorized documents through the API. Downloads contain the same bytes originally submitted.

Admin user list entries contain public user fields plus `kyc_status` (not_started, pending, rejected or verified). Page numbers start at 1 and page size defaults to 25 with a maximum of 100.
