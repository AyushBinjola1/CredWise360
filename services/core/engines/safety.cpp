#include "engines/safety.hpp"
#include "engines/emi.hpp"
#include <memory>

namespace cw {
namespace {
double rounded(double v) { return std::round(v * 100) / 100.0; }
double pct(Money part, Money whole) { return whole > 0 ? 100.0 * double(part) / double(whole) : 0.0; }

int periodsPerYear(const std::string& frequency) {
    if (frequency == "monthly") return 12;
    if (frequency == "biweekly") return 26;
    if (frequency == "weekly") return 52;
    if (frequency == "daily") return 365;
    throw Error(422, "validation", "Choose monthly, biweekly, weekly or daily repayments.");
}
// Per-period rate at which the repayment stream discounts to the net amount received.
double internalRate(Money net, Money payment, int periods) {
    if (payment * periods <= net) return 0;
    long double low = 0, high = 5;
    for (int i = 0; i < 200; ++i) {
        const long double mid = (low + high) / 2;
        long double present = payment * (1 - std::pow(1 + mid, -periods)) / mid;
        (present > net ? low : high) = mid;
    }
    return static_cast<double>((low + high) / 2);
}

struct HighEffectiveRate final : SafetyRule {
    void apply(const Json& f, Json& flags) const override {
        const double gap = f.at("effective_annual_pct").get<double>() - f.at("advertised_rate_pct").get<double>();
        if (gap >= 15) raise(flags, "rate_gap", "high", "Real cost far above the advertised rate",
            "The effective annual cost is " + std::to_string(int(std::round(f.at("effective_annual_pct").get<double>()))) +
            "% against an advertised " + std::to_string(int(std::round(f.at("advertised_rate_pct").get<double>()))) +
            "%. Fees, charges or the interest method add the difference.");
        else if (gap >= 5) raise(flags, "rate_gap", "warn", "Real cost above the advertised rate",
            "Fees and the way interest is charged lift the effective cost by about " + std::to_string(int(std::round(gap))) + " percentage points.");
        if (f.at("basis") == "flat" && f.at("advertised_rate_pct").get<double>() > 0)
            raise(flags, "flat_rate", "warn", "Flat-rate interest",
                  "Flat interest is charged on the original amount for the whole term even as you repay it, so the effective rate is usually well above the quoted one.");
        if (f.at("effective_annual_pct").get<double>() > 60)
            raise(flags, "rate_ceiling", "high", "Extremely high effective rate", "The effective annual cost exceeds 60%.");
        else if (f.at("effective_annual_pct").get<double>() > 36)
            raise(flags, "rate_ceiling", "warn", "Effective rate above 36%", "This is above the 36% level many consumer-protection guidelines treat as a ceiling for small loans.");
    }
};
struct UpfrontDeductions final : SafetyRule {
    void apply(const Json& f, Json& flags) const override {
        const double share = f.at("upfront_share_pct").get<double>();
        if (share > 8) raise(flags, "upfront_deductions", "high", "Large amount deducted before you receive the loan",
            "Fees and charges remove " + std::to_string(int(std::round(share))) + "% of the amount, yet repayments are calculated on the full loan.");
        else if (share > 3) raise(flags, "upfront_deductions", "warn", "Noticeable upfront deductions",
            "Fees and charges remove " + std::to_string(int(std::round(share))) + "% before disbursement. Compare the net amount you receive.");
        if (f.at("mandatory_charges").get<Money>() > 0)
            raise(flags, "bundled_charges", "warn", "Mandatory add-on charges",
                  "Insurance or other required charges are bundled into the loan. Ask for each charge in writing and whether it is optional.");
    }
};
struct PaymentMismatch final : SafetyRule {
    void apply(const Json& f, Json& flags) const override {
        if (f.at("stated_payment").is_null()) return;
        const double gap = f.at("payment_mismatch_pct").get<double>();
        if (gap > 10) raise(flags, "payment_mismatch", "high", "Stated payment is far above the calculated payment",
            "The lender's payment is " + std::to_string(int(std::round(gap))) + "% higher than the advertised rate and term imply. Unexplained charges may be included.");
        else if (gap > 2) raise(flags, "payment_mismatch", "warn", "Stated payment differs from the calculated payment",
            "The lender's payment is " + std::to_string(int(std::round(gap))) + "% above what the advertised terms produce. Ask for the breakdown.");
        else if (gap < -2) raise(flags, "payment_mismatch", "warn", "Stated payment is below the calculated payment",
            "The lender's payment is lower than the advertised terms imply. Check for a balloon payment or a longer term.");
    }
};
struct RepaymentStructure final : SafetyRule {
    void apply(const Json& f, Json& flags) const override {
        if (f.at("payments_per_year").get<int>() >= 52)
            raise(flags, "frequent_payments", "warn", "Very frequent repayments",
                  "Weekly or daily collections make the total cost hard to track and can hide a high effective rate.");
        const Money late = f.at("late_fee").is_null() ? 0 : f.at("late_fee").get<Money>();
        if (late > 0 && pct(late, f.at("payment").get<Money>()) > 25)
            raise(flags, "late_fee", "high", "Heavy late fee", "A single late fee exceeds a quarter of one repayment.");
        else if (late > 0 && pct(late, f.at("payment").get<Money>()) > 10)
            raise(flags, "late_fee", "warn", "Notable late fee", "A single late fee exceeds a tenth of one repayment.");
        if (!f.at("prepayment_penalty_bps").is_null()) {
            const int bps = f.at("prepayment_penalty_bps");
            if (bps >= 500) raise(flags, "prepayment", "high", "High prepayment penalty", "Repaying early costs 5% or more of the amount prepaid, which locks you in.");
            else if (bps >= 300) raise(flags, "prepayment", "warn", "Prepayment penalty", "Repaying early costs 3% or more of the amount prepaid.");
        }
        if (!f.at("lock_in_months").is_null() && f.at("lock_in_months").get<int>() > 12)
            raise(flags, "lock_in", "warn", "Long lock-in period", "You cannot repay early without a penalty for over a year.");
        std::vector<std::string> unknown;
        for (const auto* key : {"late_fee", "prepayment_penalty_bps", "lock_in_months"})
            if (f.at(key).is_null()) unknown.push_back(key);
        if (!unknown.empty())
            raise(flags, "unclear_terms", "info", "Some terms are not stated",
                  "Late fees, prepayment penalties or lock-in rules were left blank. Ask the lender to put every charge in writing before you sign.");
    }
};
struct RepaymentBurden final : SafetyRule {
    void apply(const Json& f, Json& flags) const override {
        if (f.at("income_share_pct").is_null()) return;
        const double share = f.at("income_share_pct");
        if (share > 60) raise(flags, "burden", "high", "Repayments take most of your income", "Monthly repayments would use " + std::to_string(int(std::round(share))) + "% of your income.");
        else if (share > 40) raise(flags, "burden", "warn", "Heavy repayment burden", "Monthly repayments would use " + std::to_string(int(std::round(share))) + "% of your income. A common guideline is 40% or less for all loans together.");
    }
};
}

void SafetyRule::raise(Json& flags, const std::string& code, const std::string& severity,
                       const std::string& title, const std::string& detail) {
    flags.push_back({{"code", code}, {"severity", severity}, {"title", title}, {"detail", detail}});
}

Json LoanSafetyScanner::scan(const Json& offer, Money monthlyIncome) {
    for (const auto& [key, value] : offer.items()) {
        static const std::vector<std::string> known = {"principal","months","advertised_rate_bps","basis","frequency","processing_fee",
            "mandatory_charges","stated_payment","late_fee","prepayment_penalty_bps","lock_in_months"};
        require(std::find(known.begin(), known.end(), key) != known.end(), "Unknown offer field: " + key + ".");
    }
    const Money principal = integer(offer, "principal", 1, maxMoney);
    const int months = static_cast<int>(integer(offer, "months", 1, 600));
    const int rateBps = static_cast<int>(integer(offer, "advertised_rate_bps", 0, 30000));
    const std::string basis = offer.contains("basis") ? field(offer, "basis", 10) : "reducing";
    require(basis == "reducing" || basis == "flat", "Choose reducing or flat interest.");
    const int ppy = periodsPerYear(offer.contains("frequency") ? field(offer, "frequency", 10) : "monthly");
    const Money fee = offer.contains("processing_fee") ? integer(offer, "processing_fee", 0, maxMoney) : 0;
    const Money charges = offer.contains("mandatory_charges") ? integer(offer, "mandatory_charges", 0, maxMoney) : 0;
    require(fee + charges < principal, "Fees and charges must be smaller than the loan amount.");
    auto optional = [&](const char* key, Money high) -> Json { return offer.contains(key) && !offer.at(key).is_null() ? Json(integer(offer, key, 0, high)) : Json(nullptr); };
    const Json stated = optional("stated_payment", maxMoney), late = optional("late_fee", maxMoney);
    const Json prepay = optional("prepayment_penalty_bps", 5000), lockIn = optional("lock_in_months", 600);
    const int periods = std::max(1, static_cast<int>(std::lround(double(months) * ppy / 12.0)));
    const Money net = principal - fee - charges;

    Money computed;
    if (basis == "flat") {
        const long double interest = static_cast<long double>(principal) * rateBps / 10000.0L * months / 12.0L;
        computed = std::max<Money>(1, std::llround((principal + interest) / periods));
    } else if (rateBps == 0) computed = std::max<Money>(1, std::llround(double(principal) / periods));
    else {
        const long double i = static_cast<long double>(rateBps) / 10000.0L / ppy;
        computed = std::max<Money>(1, std::llround(principal * i / (1 - std::pow(1 + i, -periods))));
    }
    const Money payment = stated.is_null() ? computed : stated.get<Money>();
    require(payment > 0, "The repayment amount must be positive.");
    const Money total = payment * periods;
    const double periodRate = internalRate(net, payment, periods);
    const double effective = 100 * (std::pow(1 + periodRate, ppy) - 1), nominal = 100 * periodRate * ppy;
    const Money monthlyEquivalent = std::llround(double(payment) * ppy / 12.0);
    Json facts = {
        {"principal", principal}, {"months", months}, {"basis", basis}, {"payments_per_year", ppy}, {"periods", periods},
        {"advertised_rate_pct", rateBps / 100.0}, {"processing_fee", fee}, {"mandatory_charges", charges},
        {"stated_payment", stated}, {"payment", payment}, {"calculated_payment", computed},
        {"payment_mismatch_pct", rounded(100.0 * double(payment - computed) / double(computed))},
        {"late_fee", late}, {"prepayment_penalty_bps", prepay}, {"lock_in_months", lockIn},
        {"net_disbursed", net}, {"upfront_share_pct", rounded(pct(fee + charges, principal))},
        {"total_repayment", total}, {"total_cost", total - net}, {"interest_and_fees", total - principal + fee + charges},
        {"effective_annual_pct", rounded(effective)}, {"nominal_annual_pct", rounded(nominal)},
        {"monthly_equivalent", monthlyEquivalent},
        {"income_share_pct", monthlyIncome > 0 ? Json(rounded(pct(monthlyEquivalent, monthlyIncome))) : Json(nullptr)}
    };
    std::vector<std::unique_ptr<SafetyRule>> rules;
    rules.push_back(std::make_unique<HighEffectiveRate>());
    rules.push_back(std::make_unique<UpfrontDeductions>());
    rules.push_back(std::make_unique<PaymentMismatch>());
    rules.push_back(std::make_unique<RepaymentStructure>());
    rules.push_back(std::make_unique<RepaymentBurden>());
    Json flags = Json::array();
    for (const auto& rule : rules) rule->apply(facts, flags);
    std::string verdict = "no_major_concerns";
    for (const auto& flag : flags) {
        if (flag.at("severity") == "high") { verdict = "high_concern"; break; }
        if (flag.at("severity") == "warn") verdict = "caution";
    }
    auto check = [](const std::string& item, const std::string& status, const std::string& detail) {
        return Json{{"item", item}, {"status", status}, {"detail", detail}};
    };
    auto has = [&](const char* code) { return std::any_of(flags.begin(), flags.end(), [&](const Json& f) { return f.at("code") == code; }); };
    const Json checklist = Json::array({
        check("The effective cost is close to the advertised rate", has("rate_gap") ? "fail" : "pass", "Effective " + std::to_string(rounded(effective)).substr(0, 5) + "% per year including fees."),
        check("Most of the loan reaches you", facts.at("upfront_share_pct") > 3 ? "fail" : "pass", "You receive " + std::to_string(int(std::round(100 - facts.at("upfront_share_pct").get<double>()))) + "% of the amount."),
        check("The stated payment matches the advertised terms", stated.is_null() ? "unknown" : (has("payment_mismatch") ? "fail" : "pass"), stated.is_null() ? "No payment was entered to compare." : "Compared with the calculated payment."),
        check("Repayments fit your income", facts.at("income_share_pct").is_null() ? "unknown" : (has("burden") ? "fail" : "pass"), facts.at("income_share_pct").is_null() ? "Add income to your financial profile to test this." : "Measured against your recorded income."),
        check("You can repay early without a heavy penalty", prepay.is_null() ? "unknown" : (has("prepayment") || has("lock_in") ? "fail" : "pass"), "Ask for prepayment rules in writing."),
        check("Every fee is stated in writing", has("unclear_terms") ? "unknown" : "pass", "Late fees, prepayment and lock-in terms must be disclosed.")
    });
    return {{"facts", facts}, {"flags", flags}, {"verdict", verdict}, {"checklist", checklist},
            {"advice", Json::array({"Ask for a written key facts statement showing the total amount you will repay.",
                                    "Never pay a fee to receive a loan before the money is disbursed.",
                                    "Compare the effective annual cost, not just the advertised rate.",
                                    "Take time to decide. Pressure to sign today is itself a warning sign."})},
            {"disclaimer", "These flags are educational estimates and do not establish that a lender is fraudulent or acting unlawfully."}};
}
}
