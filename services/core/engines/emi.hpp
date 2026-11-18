#pragma once
#include "common.hpp"

namespace cw {
struct Installment {
    int month;
    Money payment, interest, principal, balance, prepayment, prepaymentFee;
    int rateBps;
};

struct AmortizationSchedule {
    std::vector<Installment> rows;
    Money totalInterest = 0;
    Money totalRepayment = 0;
    Money prepaymentFees = 0;
    void append(Installment row);
    Json json() const;
};

struct RepaymentPricing {
    std::optional<Money> processingFee;
    int prepaymentFromMonth = 1;
    int prepaymentFeeBps = 0;
};

class EMIEngine {
public:
    static Money basisPoints(Money amount, int rateBps);
    static Money monthlyInterest(Money balance, int annualRateBps);
    static Money regularPayment(Money principal, int months, int annualRateBps);
    static Json calculate(const Json& terms, const RepaymentPricing& pricing = {});
};

Json quote(const Json& terms);
}
