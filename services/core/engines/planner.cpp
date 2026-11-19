#include "engines/planner.hpp"
#include "engines/emi.hpp"

namespace cw {
namespace {
struct Debt { std::string name; Money balance, minimum; int rateBps; int paidOffMonth = 0; };

struct Outcome { int months = 0; Money interest = 0; bool finished = false; Json order = Json::array(), series = Json::array(); };

std::vector<Debt> readDebts(const Json& debts) {
    require(debts.is_array() && !debts.empty() && debts.size() <= 12, "Choose between one and twelve debts.");
    std::vector<Debt> result;
    for (const auto& item : debts) {
        require(item.is_object(), "Describe each debt with a name, balance, rate and minimum payment.");
        result.push_back({field(item, "name", 80), integer(item, "balance", 1, maxMoney), integer(item, "minimum", 1, maxMoney),
                          static_cast<int>(integer(item, "rate_bps", 0, 6000))});
    }
    return result;
}

Outcome simulate(std::vector<Debt> debts, Money budget, const std::string& strategy, bool rollover) {
    Outcome out;
    constexpr int horizon = 600;
    Money remaining = 0;
    for (const auto& d : debts) remaining += d.balance;
    for (int month = 1; month <= horizon && remaining > 0; ++month) {
        for (auto& d : debts) if (d.balance > 0) {
            const Money interest = EMIEngine::monthlyInterest(d.balance, d.rateBps);
            d.balance += interest;
            out.interest += interest;
        }
        Money pool = rollover ? budget : 0;
        for (auto& d : debts) if (d.balance > 0) {
            const Money pay = std::min(d.balance, d.minimum);
            d.balance -= pay;
            if (rollover) pool -= pay;
        }
        // Freed minimums and the extra budget move to the target debt.
        while (rollover && pool > 0) {
            Debt* target = nullptr;
            for (auto& d : debts) if (d.balance > 0) {
                if (!target) target = &d;
                else if (strategy == "snowball" ? d.balance < target->balance : d.rateBps > target->rateBps) target = &d;
            }
            if (!target) break;
            const Money pay = std::min(pool, target->balance);
            target->balance -= pay;
            pool -= pay;
        }
        remaining = 0;
        for (auto& d : debts) {
            if (d.balance == 0 && !d.paidOffMonth) { d.paidOffMonth = month; out.order.push_back({{"name", d.name}, {"month", month}}); }
            remaining += d.balance;
        }
        out.months = month;
        if (month <= 120 || remaining == 0) out.series.push_back({{"month", month}, {"balance", remaining}});
    }
    out.finished = remaining == 0;
    return out;
}
}

Json DebtNavigator::plan(const Json& debtInput, Money budget, const std::string& strategy) {
    require(strategy == "avalanche" || strategy == "snowball", "Choose the avalanche or snowball strategy.");
    auto debts = readDebts(debtInput);
    Money minimums = 0, total = 0;
    for (const auto& d : debts) { minimums += d.minimum; total += d.balance; }
    require(budget >= minimums, "The monthly budget must cover every minimum payment.");
    const auto baseline = simulate(debts, minimums, strategy, false);
    const auto chosen = simulate(debts, budget, strategy, true);
    require(chosen.finished, "These payments do not clear the debts within fifty years. Increase the monthly budget.");
    return {
        {"strategy", strategy}, {"total_debt", total}, {"monthly_budget", budget}, {"minimum_total", minimums},
        {"months", chosen.months}, {"total_interest", chosen.interest}, {"payoff_order", chosen.order}, {"series", chosen.series},
        {"baseline", {{"months", baseline.finished ? Json(baseline.months) : Json(nullptr)}, {"total_interest", baseline.interest},
                      {"finished", baseline.finished}}},
        {"months_saved", baseline.finished ? Json(baseline.months - chosen.months) : Json(nullptr)},
        {"interest_saved", baseline.finished ? Json(baseline.interest - chosen.interest) : Json(nullptr)}
    };
}

Json StressTester::run(const FinancialProfile& base, const Json& shocks) {
    require(shocks.is_object(), "Describe the stress scenario.");
    auto pct = [&](const char* key, int high) { return shocks.contains(key) ? static_cast<int>(integer(shocks, key, 0, high)) : 0; };
    const int incomeDrop = pct("income_drop_pct", 100), expenseRise = pct("expense_rise_pct", 200), emiRise = pct("emi_rise_pct", 200);
    const int duration = shocks.contains("duration_months") ? static_cast<int>(integer(shocks, "duration_months", 1, 60)) : 6;
    const auto& v = base.values();
    auto money = [&](const char* k) { return v.at(k).get<Money>(); };
    auto scaled = [](Money amount, int percent) { return amount * (100 + percent) / 100; };
    const Money income = money("salary") + money("business_income") + money("other_income");
    const Money stressedIncome = income * (100 - incomeDrop) / 100;
    const Money essential = scaled(money("essential"), expenseRise), optional = money("discretionary");
    const Money emi = scaled(money("existing_emi"), emiRise);
    const Money normalSurplus = income - money("essential") - optional - money("existing_emi");
    const Money stressedSurplus = stressedIncome - essential - optional - emi;
    const Money reserves = money("reserves");
    Money balance = reserves;
    int depleted = 0;
    Json timeline = Json::array();
    for (int month = 1; month <= std::max(duration, 12); ++month) {
        if (month <= duration) balance += stressedSurplus;
        if (balance < 0) { balance = 0; if (!depleted) depleted = month; }
        timeline.push_back({{"month", month}, {"reserves", balance}});
    }
    const bool shortfall = stressedSurplus < 0;
    const Money monthlyGap = shortfall ? -stressedSurplus : 0;
    Json runway = shortfall ? Json(std::round(100.0 * reserves / monthlyGap) / 100.0) : Json(nullptr);
    const std::string level = !shortfall ? "stable" : (depleted ? "critical" : "strained");
    Json actions = Json::array();
    if (shortfall) {
        actions.push_back("Prepare to reduce optional spending by up to " + std::to_string(std::min<Money>(optional, monthlyGap) / 100) + " rupees per month.");
        if (money("existing_emi") > 0) actions.push_back("Ask a lender about a temporary instalment concession before a payment is missed.");
        actions.push_back("Hold reserves for essentials and instalments first.");
    } else actions.push_back("Recorded income and reserves cover this scenario. Keep emergency savings current.");
    if (depleted) actions.push_back("Reserves run out in month " + std::to_string(depleted) + ". Build reserves or reduce commitments before borrowing more.");
    return {
        {"shocks", {{"income_drop_pct", incomeDrop}, {"expense_rise_pct", expenseRise}, {"emi_rise_pct", emiRise}, {"duration_months", duration}}},
        {"normal", {{"income", income}, {"surplus", normalSurplus}}},
        {"stressed", {{"income", stressedIncome}, {"essential", essential}, {"optional", optional}, {"emi", emi}, {"surplus", stressedSurplus},
                      {"emi_ratio", stressedIncome > 0 ? Json(std::round(10000.0 * emi / stressedIncome) / 100.0) : Json(nullptr)}}},
        {"reserves", reserves}, {"monthly_shortfall", monthlyGap}, {"runway_months", runway},
        {"depleted_in_month", depleted ? Json(depleted) : Json(nullptr)}, {"level", level},
        {"timeline", timeline}, {"actions", actions}
    };
}

Json EducationPlanner::project(const Json& in) {
    const Money cost = integer(in, "total_cost", 1, maxMoney);
    const Money family = in.contains("family_contribution") ? integer(in, "family_contribution", 0, maxMoney) : 0;
    const Money scholarship = in.contains("scholarship") ? integer(in, "scholarship", 0, maxMoney) : 0;
    const int years = static_cast<int>(integer(in, "study_years", 1, 8));
    const int grace = in.contains("grace_months") ? static_cast<int>(integer(in, "grace_months", 0, 24)) : 6;
    const int rate = static_cast<int>(integer(in, "rate_bps", 0, 6000));
    const int tenure = static_cast<int>(integer(in, "repayment_months", 6, 240));
    const Money salary = in.contains("expected_salary") ? integer(in, "expected_salary", 0, maxMoney) : 0;
    const bool payInterest = in.value("pay_interest_during_study", false);
    require(family + scholarship < cost, "Family funds and scholarships already cover the full cost. No loan is needed.");
    const Money principal = cost - family - scholarship;
    const int studyMonths = years * 12;
    Money disbursed = 0, accrued = 0, interestPaid = 0;
    Json tranches = Json::array();
    for (int month = 0; month < studyMonths + grace; ++month) {
        if (month < studyMonths && month % 12 == 0) {
            const Money tranche = month == 0 ? principal - (principal / years) * (years - 1) : principal / years;
            disbursed += tranche;
            tranches.push_back({{"month", month + 1}, {"amount", tranche}});
        }
        const Money interest = EMIEngine::monthlyInterest(disbursed + (payInterest ? 0 : accrued), rate);
        if (payInterest) interestPaid += interest; else accrued += interest;
    }
    const Money balance = disbursed + accrued;
    const Money emi = EMIEngine::regularPayment(balance, tenure, rate);
    Json options = Json::array();
    for (int months : {60, 84, 120, 180}) {
        const Money payment = EMIEngine::regularPayment(balance, months, rate);
        options.push_back({{"months", months}, {"emi", payment}, {"total_interest", payment * months - balance},
                           {"salary_share_pct", salary > 0 ? Json(std::round(10000.0 * payment / salary) / 100.0) : Json(nullptr)}});
    }
    std::string verdict = "needs_salary";
    Json share = nullptr;
    if (salary > 0) {
        const double pct = 100.0 * emi / salary;
        share = std::round(pct * 100) / 100.0;
        verdict = pct <= 30 ? "comfortable" : pct <= 50 ? "stretched" : "risky";
    }
    return {
        {"loan_principal", principal}, {"tranches", tranches}, {"moratorium_months", studyMonths + grace},
        {"interest_accrued", accrued}, {"interest_paid_during_study", interestPaid}, {"repayment_start_balance", balance},
        {"emi", emi}, {"repayment_months", tenure}, {"total_repayment", emi * tenure},
        {"lifetime_interest", emi * tenure - balance + accrued + interestPaid},
        {"salary_share_pct", share}, {"verdict", verdict}, {"tenure_options", options}
    };
}
}
