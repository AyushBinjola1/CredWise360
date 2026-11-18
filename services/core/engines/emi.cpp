#include "engines/emi.hpp"

namespace cw {
namespace {
Money divideRounded(Money numerator, Money denominator) {
    return (numerator + denominator / 2) / denominator;
}

Money optionalInteger(const Json& terms, const std::string& key, Money low, Money high, Money fallback = 0) {
    return terms.contains(key) ? integer(terms, key, low, high) : fallback;
}

double annualizedCost(Money proceeds, const AmortizationSchedule& schedule) {
    if (proceeds == schedule.totalRepayment) return 0;
    long double low = 0;
    long double high = static_cast<long double>(schedule.totalRepayment) / proceeds;
    for (int iteration = 0; iteration < 108; ++iteration) {
        const long double monthlyRate = (low + high) / 2;
        long double discount = 1;
        long double presentValue = 0;
        for (const auto& row : schedule.rows) {
            discount /= 1 + monthlyRate;
            presentValue += row.payment * discount;
        }
        if (presentValue > proceeds) low = monthlyRate;
        else high = monthlyRate;
    }
    return static_cast<double>(100 * std::expm1(12 * std::log1p((low + high) / 2)));
}
}

Money EMIEngine::basisPoints(Money amount, int rateBps) {
    return divideRounded(amount * rateBps, 10000);
}
Money EMIEngine::monthlyInterest(Money balance, int annualRateBps) {
    return divideRounded(balance * annualRateBps, 120000);
}
Money EMIEngine::regularPayment(Money principal, int months, int annualRateBps) {
    require(principal > 0 && principal <= maxMoney && months > 0 && months <= 600 &&
            annualRateBps >= 0 && annualRateBps <= 6000, "Check the loan amount, tenure and interest rate.");
    if (!annualRateBps) return std::max<Money>(1, divideRounded(principal, months));
    const long double rate = static_cast<long double>(annualRateBps) / 120000;
    const auto factor = -std::expm1(-months * std::log1p(rate));
    return std::max<Money>(1, std::llround(principal * rate / factor));
}

void AmortizationSchedule::append(Installment row) {
    totalInterest += row.interest;
    totalRepayment += row.payment;
    prepaymentFees += row.prepaymentFee;
    rows.push_back(row);
}
Json AmortizationSchedule::json() const {
    Json result = Json::array();
    for (const auto& row : rows) {
        result.push_back({{"month",row.month},{"payment",row.payment},{"interest",row.interest},
                          {"principal",row.principal},{"balance",row.balance},{"prepayment",row.prepayment},
                          {"prepayment_fee",row.prepaymentFee},{"rate_bps",row.rateBps}});
    }
    return result;
}

Json EMIEngine::calculate(const Json& terms, const RepaymentPricing& pricing) {
    const Money principal = integer(terms, "principal", 1, maxMoney);
    const int months = static_cast<int>(integer(terms, "months", 1, 600));
    int rate = static_cast<int>(integer(terms, "rate_bps", 0, 6000));
    const auto feeRate = static_cast<int>(optionalInteger(terms, "fee_bps", 0, 5000));
    const Money fee = pricing.processingFee.value_or(basisPoints(principal, feeRate));
    const Money upfront = optionalInteger(terms, "upfront", 0, maxMoney);
    require(fee + upfront < principal, "Fees and upfront charges must leave positive net proceeds.");
    const Money extra = optionalInteger(terms, "prepayment", 0, maxMoney);
    const auto extraMonth = optionalInteger(terms, "prepay_month", 1, months);
    require(!extra || extraMonth >= pricing.prepaymentFromMonth,
            "Choose a prepayment month permitted by the repayment terms.");
    const bool changed = terms.contains("next_rate_bps");
    require(changed == terms.contains("rate_month"), "Enter both a replacement rate and its effective month.");
    const auto newRate = optionalInteger(terms, "next_rate_bps", 0, 6000);
    const auto rateMonth = optionalInteger(terms, "rate_month", 1, months);
    auto method = terms.contains("method") ? field(terms, "method", 16) : "reducing";
    if (method == "fixed") method = "reducing";
    require(method == "reducing" || method == "flat" || method == "floating", "Choose a supported interest method.");
    require(!changed || method != "flat", "A flat-interest quote uses one rate.");
    require(method != "floating" || changed, "Choose the new rate and month for a floating scenario.");
    if (changed) method = "floating";

    const bool flat = method == "flat";
    const Money flatPrincipal = std::max<Money>(1, divideRounded(principal, months));
    Money regular = flat ? flatPrincipal + monthlyInterest(principal, rate) : regularPayment(principal, months, rate);
    Money firstEmi = regular;
    Money balance = principal;
    AmortizationSchedule schedule;
    schedule.rows.reserve(months);
    for (int month = 1; month <= months && balance > 0; ++month) {
        if (month == rateMonth) {
            rate = static_cast<int>(newRate);
            regular = regularPayment(balance, months - month + 1, rate);
            if (month == 1) firstEmi = regular;
        }
        // Cumulative rounding allocates fractional paise of flat interest exactly once.
        const Money interest = flat
            ? divideRounded(principal * rate * month, 120000) - divideRounded(principal * rate * (month-1), 120000)
            : monthlyInterest(balance, rate);
        Money scheduled = flat ? flatPrincipal : std::max<Money>(0, regular - interest);
        scheduled = month == months ? balance : std::min(balance, scheduled);
        const Money prepayment = month == extraMonth ? std::min(extra, balance - scheduled) : 0;
        const Money prepaymentFee = basisPoints(prepayment, pricing.prepaymentFeeBps);
        const Money repaid = scheduled + prepayment;
        balance -= repaid;
        schedule.append({month,repaid + interest + prepaymentFee,interest,repaid,balance,prepayment,prepaymentFee,rate});
    }
    const Money proceeds = principal - fee - upfront;
    const Money cost = schedule.totalRepayment + fee + upfront;
    return {{"principal",principal},{"months",months},{"actual_months",schedule.rows.size()},
            {"method",method},{"emi",firstEmi},{"total_interest",schedule.totalInterest},
            {"total_repayment",schedule.totalRepayment},{"fee",fee},{"upfront",upfront},
            {"prepayment_fees",schedule.prepaymentFees},{"net_proceeds",proceeds},{"total_cost",cost},
            {"borrowing_cost",cost-principal},{"effective_rate",annualizedCost(proceeds,schedule)},
            {"schedule",schedule.json()}};
}

Json quote(const Json& terms) { return EMIEngine::calculate(terms); }
}
