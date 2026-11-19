# Academic guide and viva notes

## Follow one request

A browser form submits a same-origin request to the Next.js API handler. The handler forwards it to the C++ HTTP server. A controller checks the session and delegates to a service. The service loads a domain object, applies its rules, and persists the result through libpq. The browser displays the returned result.

## Concept map

| Concept | Source | Example to demonstrate |
| --- | --- | --- |
| Interface, abstraction and runtime dispatch | `services/core/repositories/database.hpp`, `Repository` and `Database` | A repository exposes parameterized reads and writes while the adapter owns the PostgreSQL connection and result handles. |
| Resource acquisition is initialization (RAII) | `Database` and `Transaction` in the same header | Connection and result objects release libpq resources. An uncommitted transaction rolls back as its scope ends. |
| Encapsulation and composition | `services/core/domain/profile.hpp`, `FinancialProfile` | Validated named inputs are encapsulated with their derived financial metrics. |
| Copy and move semantics | `FinancialProfile::adjusted` and the profile constructors | Applying changes returns a separate value. A simulation can use that value without replacing the original profile. |
| Standard collections and sorting | `services/core/repositories/database.cpp`, `migrate` | A vector holds migration paths. Sorting applies revisions deterministically in O(n log n) time. |
| Exception handling | `services/core/common.hpp`, `Error`, and `services/core/main.cpp` | Validation exceptions become HTTP errors. Database handles still release correctly when an exception unwinds the stack. |
| Concurrency and shutdown | `services/core/main.cpp` | HTTP requests run in a bounded worker pool. A signal-aware monitor stops the listener. Each database request owns its connection. |
| Strategy and polymorphism | `services/core/engines/credit.hpp`, `ScoringStrategy`, `ConventionalScoring` and `InclusiveScoring` | Follow a first-time borrower with consented evidence through `CreditScoreEngine::evaluate`. The policy version and observed factors determine the result. |
| Factory and ownership | `services/core/domain/loan.cpp`, `LoanFactory::make` | A slug selects one of eight constructors through a hash map. A smart pointer owns the resulting loan policy and virtual methods apply product-specific review rules. |
| Composition and numerical algorithms | `services/core/engines/emi.cpp`, `EMIEngine`, `AmortizationSchedule` and `Installment` | Build the month-by-month schedule, trace final-paise reconciliation and solve effective cost by bisection over the actual scheduled payments. |
| Sorting and deterministic ties | `services/core/services/market.cpp`, `recommended` | Rank eligible products and alternatives by compatibility, total borrowing cost and catalogue order. The recommendation keeps the requested principal and term. |
| State machine | `domain/application.cpp`, `LoanApplication`, and `domain/dispute.cpp`, `DisputeTicket` | A transition table in a map of sets rejects illegal moves with HTTP 409. Both the loan lifecycle and the support ticket lifecycle use the same idea. |
| Interface-based rules (Strategy) | `engines/safety.hpp`, `SafetyRule`; `engines/distress.hpp`, `DistressIndicator`; `services/learning.cpp`, `RewardRule` | Each rule is a small class behind one virtual method. The engine keeps a vector of `unique_ptr` rules and applies them in turn, so adding a rule never touches the others. |
| Root finding | `engines/safety.cpp`, `internalRate` | The effective borrowing cost is the rate at which the repayment stream discounts to the net amount received. Bisection over 200 iterations solves it, and a zero-rate offer is checked to return exactly zero. |
| Simulation and greedy allocation | `engines/planner.cpp`, `DebtNavigator::plan` | Month-by-month integer simulation. Avalanche targets the highest rate and snowball the smallest balance. A baseline run with no rollover shows interest saved, and a never-amortizing debt is detected instead of looping. |
| Counterfactual testing | `engines/fairness.cpp`, `FairnessAuditor` | Equivalent profiles differing only in protected attributes must give identical outcomes. Control changes that must move the score prove the test can detect influence. |
| Binary file format and RAII-free serialization | `engines/pdf.cpp`, `PdfDocument` | A PDF is written with byte-exact cross-reference offsets, wrapped text and paginated tables. The native test re-reads every offset. |
| Idempotency and locking | `services/servicing.cpp`, `postPayment` | A key plus the stored request body makes retries safe. Profile, application and loan rows are locked in one fixed order to avoid deadlock. |

## Questions for the viva

1. **Why use integer paise?** Repeated binary floating-point updates can accumulate error in a ledger. Integer amounts represent each posted payment exactly. Calculations must document where interest is rounded.
2. **Why use database transactions with a multithreaded service?** A mutex protects one process. Transactions and row locks also coordinate other connections and protect changes across crashes.
3. **How do UI guards and server authorization work together?** Role-appropriate navigation guides the user. Each protected API operation independently checks the session and permitted owner.
4. **How does a simulated score differ from a bureau score?** The project applies its documented deterministic education policy to synthetic inputs. There is no bureau connection or trained model.
5. **How do you reproduce a result?** Use the migrations and synthetic fixture, record the inputs, and run the same calculation through both a native test and the integrated API.
