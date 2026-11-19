#pragma once
#include "common.hpp"

namespace cw {
// One measurable early-warning signal. Indicators explain themselves and never penalize the borrower.
class DistressIndicator {
public:
    virtual ~DistressIndicator() = default;
    // Returns null when the indicator has no data, otherwise {key,title,level,detail,action}.
    virtual Json evaluate(const Json& facts) const = 0;
protected:
    static Json result(const std::string& key, const std::string& title, const std::string& level,
                       const std::string& detail, const std::string& action);
};

class DistressMonitor {
public:
    // facts: income, disposable, emi_ratio, dti, coverage, missed, overdue_count, overdue_amount, due_30d, trends.
    static Json assess(const Json& facts);
};
}
