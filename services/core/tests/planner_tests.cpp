#include "engines/planner.hpp"
#include <functional>
#include <iostream>

namespace {
void check(bool valid, const char* message) {
    if (!valid) throw std::runtime_error(message);
}
bool rejects(const std::function<void()>& action) {
    try { action(); } catch (const cw::Error&) { return true; }
    return false;
}
void debts() {
    using namespace cw;
    // A zero-rate debt repaid at its minimum has no interest and takes balance/minimum months.
    auto free = DebtNavigator::plan(Json::array({{{"name","Friend"},{"balance",120000},{"minimum",10000},{"rate_bps",0}}}),10000,"avalanche");
    check(free.at("months") == 12 && free.at("total_interest") == 0,"Zero-rate debt should clear in twelve months");
    const Json mixed = Json::array({
        {{"name","Card"},{"balance",5000000},{"minimum",200000},{"rate_bps",3600}},
        {{"name","Phone"},{"balance",1200000},{"minimum",60000},{"rate_bps",1200}}});
    auto avalanche = DebtNavigator::plan(mixed,400000,"avalanche");
    auto snowball = DebtNavigator::plan(mixed,400000,"snowball");
    check(avalanche.at("total_interest").get<Money>() <= snowball.at("total_interest").get<Money>(),"Avalanche must not cost more interest");
    check(avalanche.at("total_interest").get<Money>() < avalanche.at("baseline").at("total_interest").get<Money>(),"Extra payments must save interest");
    check(avalanche.at("series").back().at("balance") == 0,"Series must end at zero");
    check(avalanche.at("payoff_order").size() == 2,"Both debts should pay off");
    check(rejects([&]{ DebtNavigator::plan(mixed,100000,"avalanche"); }),"Budget below minimums accepted");
    check(rejects([&]{ DebtNavigator::plan(mixed,400000,"random"); }),"Unknown strategy accepted");
    // Interest-only minimum never clears; the baseline reports that instead of looping forever.
    auto stuck = DebtNavigator::plan(Json::array({{{"name","Card"},{"balance",5000000},{"minimum",150000},{"rate_bps",3600}}}),400000,"avalanche");
    check(!stuck.at("baseline").at("finished").get<bool>(),"Interest-only baseline should not finish");
}
void stress() {
    using namespace cw;
    auto profile = FinancialProfile().adjusted({{"salary",8000000},{"essential",3000000},{"discretionary",1000000},
                                                {"existing_emi",500000},{"reserves",6000000}});
    auto calm = StressTester::run(profile,{{"income_drop_pct",0}});
    check(calm.at("level") == "stable" && calm.at("monthly_shortfall") == 0,"No shock should be stable");
    auto job = StressTester::run(profile,{{"income_drop_pct",100},{"duration_months",12}});
    check(job.at("stressed").at("surplus") == -4500000,"Surplus must equal minus total outgoings");
    check(job.at("depleted_in_month") == 2 && job.at("level") == "critical","Reserves of 60k cover 1.33 months of 45k");
    check(job.at("timeline").back().at("reserves") == 0,"Reserves cannot go negative");
    auto rise = StressTester::run(profile,{{"emi_rise_pct",100}});
    check(rise.at("stressed").at("emi") == 1000000,"EMI shock should double instalments");
    check(rejects([&]{ StressTester::run(profile,{{"income_drop_pct",150}}); }),"Out-of-range shock accepted");
}
void education() {
    using namespace cw;
    const Json plan = {{"total_cost",120000000},{"family_contribution",20000000},{"scholarship",10000000},{"study_years",3},
                       {"grace_months",6},{"rate_bps",1000},{"repayment_months",60},{"expected_salary",5000000}};
    auto result = EducationPlanner::project(plan);
    Money tranches = 0;
    for (const auto& t : result.at("tranches")) tranches += t.at("amount").get<Money>();
    check(result.at("loan_principal") == 90000000 && tranches == 90000000,"Tranches must sum to the principal");
    check(result.at("repayment_start_balance").get<Money>() == 90000000 + result.at("interest_accrued").get<Money>(),"Balance reconciliation");
    check(result.at("interest_accrued").get<Money>() > 0,"Moratorium interest should accrue");
    auto paying = plan; paying["pay_interest_during_study"] = true;
    auto serviced = EducationPlanner::project(paying);
    check(serviced.at("interest_accrued") == 0 && serviced.at("emi").get<Money>() < result.at("emi").get<Money>(),"Paying interest lowers the EMI");
    auto zero = plan; zero["rate_bps"] = 0;
    auto flat = EducationPlanner::project(zero);
    check(flat.at("interest_accrued") == 0 && flat.at("lifetime_interest").get<Money>() >= 0 && flat.at("lifetime_interest").get<Money>() < 60,"Zero rate has only rounding");
    auto covered = plan; covered["family_contribution"] = 120000000;
    check(rejects([&]{ EducationPlanner::project(covered); }),"Fully funded study accepted a loan");
}
}
int main() {
    try { debts(); stress(); education(); }
    catch (const std::exception& e) { std::cerr << e.what() << '\n'; return 1; }
    std::cout << "Planner tests passed\n";
}
