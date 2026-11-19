#pragma once
#include "common.hpp"

namespace cw {
class FinancialProfile {
    Json values_;
public:
    FinancialProfile();
    FinancialProfile(const FinancialProfile&) = default;
    FinancialProfile(FinancialProfile&&) = default;
    FinancialProfile adjusted(const Json& changes) const;
    FinancialProfile withPortfolio(const Json& commitments) const;
    const Json& values() const { return values_; }
    Json metrics() const;
    static const std::vector<std::string>& moneyFields();
};
}
