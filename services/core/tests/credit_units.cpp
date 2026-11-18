#include "engines/credit.hpp"
#include <iostream>

namespace {
using cw::Json;
void check(bool condition, const char* description) {
    if (!condition) throw std::runtime_error(description);
}
Json policy() {
    return {
        {"id",1},
        {"conventional_weights",{{"repayment",35},{"utilization",20},{"obligations",10},{"history",10},
                                 {"inquiries",10},{"consistency",8},{"resilience",7}}},
        {"alternative_weights",{{"rent",25},{"utilities",20},{"cashflow",20},{"savings",20},{"commitments",15}}},
        {"thresholds",{{"min_conventional_payments",3},{"min_history_months",3},{"history_target_months",60},
                       {"inquiry_window_days",90},{"max_recent_inquiries",5},{"full_reserve_months",6},{"full_savings_pct",20},
                       {"max_debt_to_annual_pct",100},{"emi_cap_pct",40},{"cashflow_share_pct",70},
                       {"low_risk_score",740},{"moderate_risk_score",620},{"alt_min_evidence",3},
                       {"positive_factor_min",75},{"negative_factor_max",45}}}
    };
}
Json factor(const Json& result, const std::string& key) {
    for (const auto& value : result.at("factors")) if (value.at("key") == key) return value;
    throw std::runtime_error("Missing factor " + key);
}
void conventionalBoundaries() {
    auto config = policy();
    for (auto& value : config.at("conventional_weights")) value = 0;
    config["conventional_weights"]["repayment"] = 100;
    cw::validateCreditPolicy(config);
    cw::CreditScoreEngine engine(config);
    Json p = {{"credit_months",3},{"on_time",2}};
    check(engine.evaluate(p)["score"].is_null(),"Two payments are below the conventional threshold.");
    p["on_time"] = 3;
    p["credit_months"] = 2;
    check(engine.evaluate(p)["score"].is_null(),"Two months are below the conventional threshold.");
    p["credit_months"] = 3;
    auto perfect = engine.evaluate(p);
    check(perfect["score"] == 900 && perfect["strategy"] == "conventional","Both boundary thresholds admit the conventional policy.");
    p["on_time"] = 0;
    p["missed"] = 3;
    auto missed = engine.evaluate(p);
    check(missed["score"] == 300,"Observed missed repayments reach the bottom of the configured range.");
    check(missed["human_review"] == false,"Observed poor repayment is distinct from missing conventional evidence.");
    check(factor(missed,"consistency")["value"].is_null(),"Unknown consistency stays unavailable.");
}
void alternativeBoundaries() {
    cw::CreditScoreEngine engine(policy());
    Json p = {{"salary",1000000},{"consent",true}};
    auto unknown = engine.evaluate(p);
    check(unknown["score"].is_null() && unknown["evidence_count"] == 0,"A salary alone supplies no alternative repayment evidence.");
    check(unknown["stability"].is_null() && factor(unknown,"savings")["value"].is_null(),"Unreported income regularity and savings stay unknown.");
    p.update(Json{{"rent",0},{"utilities",100},{"income_regularity",100}});
    auto known = engine.evaluate(p);
    check(known["strategy"] == "alternative" && known["score"] == 669,"Explicit zero uses its policy weight at the minimum evidence threshold.");
    check(factor(known,"rent")["value"] == 0 && factor(known,"rent")["effective_weight"].get<double>() > 0,
          "A supplied zero is positive evidence of recorded behavior, with its actual factor value.");
    p["rent"] = nullptr;
    auto cleared = engine.evaluate(p);
    check(cleared["score"].is_null() && cleared["evidence_count"] == 2,"Clearing a supplied observation removes it from the evidence count.");
    check(factor(cleared,"rent")["value"].is_null(),"Cleared history is returned as null.");
    p.update(Json{{"savings",0},{"existing_emi",0}});
    auto budget = engine.evaluate(p);
    check(factor(budget,"savings")["value"] == 0 && factor(budget,"commitments")["value"] == 100,
          "Explicit zero savings and zero existing commitments are both usable, with different meanings.");
    p.update(Json{{"savings_reported",false},{"emi_reported",false}});
    check(engine.evaluate(p)["score"].is_null(),"Declining to use budget evidence excludes both amounts.");
    p["rent"] = 100;
    p["consent"] = false;
    auto privateResult = engine.evaluate(p);
    check(privateResult["factors"].empty() && privateResult["score"].is_null(),"Alternative evidence requires current consent.");
}
void policyAndHeadroom() {
    auto config = policy();
    cw::CreditScoreEngine engine(config);
    Json p = {{"salary",1000000},{"essential",550000},{"discretionary",100000},{"existing_emi",150000},
              {"on_time",6},{"credit_months",8},{"missed",1},{"utilization",50}};
    auto result = engine.evaluate(p);
    check(result["capacity"] == 140000,"Headroom follows the lower of the configured EMI limit and cash-flow limit.");
    check(factor(engine.evaluate(p,5),"inquiries")["value"] == 0,"The configured inquiry boundary is reachable.");
    p["name"] = "Synthetic alternate identity";
    p["gender"] = "Sample label";
    check(engine.evaluate(p) == result,"Irrelevant attributes do not change any assessment output.");
    p["existing_emi"] = 550000;
    check(engine.evaluate(p)["capacity"] == 0,"A cash-flow deficit gives zero new monthly capacity.");
    config["thresholds"]["low_risk_score"] = 600;
    bool invalid = false;
    try { cw::validateCreditPolicy(config); } catch (const cw::Error& error) { invalid = error.status == 422; }
    check(invalid,"A reversed risk range must fail validation.");
}
}
int main() {
    try {
        conventionalBoundaries();
        alternativeBoundaries();
        policyAndHeadroom();
        std::cout << "Credit strategy, evidence, policy and affordability boundaries passed.\n";
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
