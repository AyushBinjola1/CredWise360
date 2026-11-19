#pragma once
#include "domain/profile.hpp"

namespace cw {
class ScoringStrategy {
public:
    virtual ~ScoringStrategy() = default;
    virtual Json factors(const FinancialProfile&, const Json& policy, int recent) const = 0;
};
class ConventionalScoring final : public ScoringStrategy {
public:
    Json factors(const FinancialProfile&, const Json&, int recent) const override;
};
class InclusiveScoring final : public ScoringStrategy {
public:
    Json factors(const FinancialProfile&, const Json&, int recent) const override;
};
class CreditScoreEngine {
    Json policy_;
public:
    explicit CreditScoreEngine(Json policy) : policy_(std::move(policy)) {}
    Json evaluate(const Json& fullProfile, int recent = 0) const;
    Json evaluate(const FinancialProfile& financial, int recent) const;
};
void validateCreditPolicy(const Json&);
}
