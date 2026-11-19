#pragma once
#include "domain/profile.hpp"

namespace cw {
// Debt Freedom Navigator: simulates month-by-month repayment of several debts in integer paise.
class DebtNavigator {
public:
    static Json plan(const Json& debts, Money monthlyBudget, const std::string& strategy);
};
// Financial Stress Test: applies income, expense and instalment shocks to a profile and measures resilience.
class StressTester {
public:
    static Json run(const FinancialProfile& baseline, const Json& shocks);
};
// Education Loan Planner: tranche disbursement, moratorium interest and repayment projection.
class EducationPlanner {
public:
    static Json project(const Json& input);
};
}
