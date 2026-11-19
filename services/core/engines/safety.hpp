#pragma once
#include "common.hpp"

namespace cw {
// One explainable warning rule. Each rule inspects the computed offer facts and may raise a flag.
class SafetyRule {
public:
    virtual ~SafetyRule() = default;
    virtual void apply(const Json& facts, Json& flags) const = 0;
protected:
    static void raise(Json& flags, const std::string& code, const std::string& severity,
                      const std::string& title, const std::string& detail);
};

// Predatory Loan Protector: reconstructs the true cost of a hypothetical external offer.
class LoanSafetyScanner {
public:
    // monthlyIncome of zero means the borrower's income is unknown, so burden checks are skipped.
    static Json scan(const Json& offer, Money monthlyIncome);
};
}
