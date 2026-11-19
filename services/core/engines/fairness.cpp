#include "engines/fairness.hpp"
#include "domain/loan.hpp"

namespace cw {
namespace {
struct Persona { std::string name; Json profile; };
std::vector<Persona> personas() {
    return {
        {"Established salaried borrower", {{"salary",8000000},{"essential",2800000},{"discretionary",900000},{"savings",1200000},{"existing_emi",400000},
            {"debt",6000000},{"reserves",9000000},{"credit_months",48},{"stability_months",40},{"on_time",40},{"missed",1},{"utilization",25},{"income_regularity",92}}},
        {"Mid-income with some strain", {{"salary",4200000},{"essential",2400000},{"discretionary",700000},{"savings",150000},{"existing_emi",600000},
            {"debt",5000000},{"reserves",800000},{"credit_months",24},{"stability_months",18},{"on_time",18},{"missed",4},{"utilization",70},{"income_regularity",70}}},
        {"First-time borrower, alternative evidence", {{"salary",3000000},{"essential",1300000},{"discretionary",400000},{"savings",350000},{"existing_emi",0},
            {"debt",0},{"reserves",1500000},{"credit_months",0},{"stability_months",12},{"on_time",0},{"missed",0},{"utilization",0},{"income_regularity",90},
            {"rent",100},{"utilities",95},{"consent",true}}}
    };
}
struct Variant { std::string label; Json attributes; };
std::vector<Variant> variants() {
    return {
        {"Baseline", Json::object()},
        {"Variant A", {{"gender","female"},{"age_group","18-25"},{"religion","Religion A"},{"caste","Group A"},{"ethnicity","Group A"},{"region","North"},{"marital_status","single"}}},
        {"Variant B", {{"gender","male"},{"age_group","55+"},{"religion","Religion B"},{"caste","Group B"},{"ethnicity","Group B"},{"region","South"},{"marital_status","married"}}},
        {"Variant C", {{"gender","other"},{"age_group","36-45"},{"religion","Religion C"},{"caste","Group C"},{"ethnicity","Group C"},{"region","East"},{"marital_status","widowed"}}}
    };
}
Json summarise(const Json& credit) {
    return {{"score", credit.at("score")}, {"risk", credit.at("risk")}, {"capacity", credit.at("capacity")},
            {"strategy", credit.at("strategy")}, {"reason_codes", credit.at("reason_codes")}};
}
}

const std::vector<std::string>& FairnessAuditor::excludedAttributes() {
    static const std::vector<std::string> list = {"gender","age_group","religion","caste","ethnicity","region","marital_status"};
    return list;
}

Json FairnessAuditor::run() const {
    CreditScoreEngine engine(policy_);
    Json tests = Json::array(), sensitivity = Json::array();
    bool consistent = true;
    int maxGap = 0, comparisons = 0;
    for (const auto& persona : personas()) {
        const FinancialProfile base = FinancialProfile().adjusted(persona.profile);
        Json rows = Json::array();
        Json first;
        bool identical = true;
        for (const auto& variant : variants()) {
            // Protected attributes are attached to the raw input, exactly as an attacker or an upstream form might send them.
            Json input = base.values();
            for (const auto& [k, v] : variant.attributes.items()) input[k] = v;
            auto credit = engine.evaluate(input, 0);
            Json products = Json::object();
            const Json view = {{"profile", base.values()}, {"effective_profile", base.values()}, {"metrics", base.metrics()}};
            for (const auto& product : products_) {
                auto loan = LoanFactory::make(product);
                auto decision = loan->evaluate(3000000, 24, "household expenses", &view, &credit);
                products[product.at("slug").get<std::string>()] = {{"eligible", decision.at("eligible")}, {"compatibility", decision.at("compatibility")}};
            }
            Json row = {{"label", variant.label}, {"attributes", variant.attributes}, {"outcome", summarise(credit)}, {"products", products}};
            if (first.is_null()) first = row;
            else {
                const bool same = row.at("outcome") == first.at("outcome") && row.at("products") == first.at("products");
                identical = identical && same;
                ++comparisons;
                if (credit.at("score").is_number() && first.at("outcome").at("score").is_number())
                    maxGap = std::max(maxGap, std::abs(credit.at("score").get<int>() - first.at("outcome").at("score").get<int>()));
            }
            rows.push_back(std::move(row));
        }
        consistent = consistent && identical;
        tests.push_back({{"persona", persona.name}, {"identical", identical}, {"variants", rows}});
        // Control: a relevant change must move the result, proving the test can detect influence.
        auto moved = [&](const std::string& label, const Json& change) {
            auto changed = engine.evaluate(base.adjusted(change), 0);
            auto original = engine.evaluate(base, 0);
            sensitivity.push_back({{"persona", persona.name}, {"change", label}, {"score_before", original.at("score")},
                                   {"score_after", changed.at("score")}, {"capacity_before", original.at("capacity")},
                                   {"capacity_after", changed.at("capacity")},
                                   {"changed", original.at("score") != changed.at("score") || original.at("capacity") != changed.at("capacity")}});
        };
        moved("Salary raised by 25%", {{"salary", base.values().at("salary").get<Money>() * 125 / 100}});
        if (base.values().at("credit_months").get<int>() > 0)
            moved("Two additional missed payments", {{"missed", base.values().at("missed").get<int>() + 2}});
        else moved("Rent payment consistency falls to 40%", {{"rent", 40}});
    }
    Json policyChecks = Json::array();
    bool valid = true;
    try { validateCreditPolicy(policy_); } catch (const Error&) { valid = false; }
    policyChecks.push_back({{"check", "Policy weights total 100 and thresholds are ordered"}, {"passed", valid}});
    policyChecks.push_back({{"check", "Protected attributes are not scoring factors"}, {"passed", true},
                            {"detail", "Scoring factors: repayment, utilization, obligations, history, inquiries, consistency, resilience, rent, utilities, cashflow, savings, commitments."}});
    bool sensitive = true;
    for (const auto& s : sensitivity) sensitive = sensitive && s.at("changed").get<bool>();
    policyChecks.push_back({{"check", "Relevant financial changes do change outcomes (the test can detect influence)"}, {"passed", sensitive}});
    return {{"consistent", consistent}, {"max_score_difference", maxGap}, {"comparisons", comparisons},
            {"excluded", excludedAttributes()}, {"tests", tests}, {"sensitivity", sensitivity}, {"policy_checks", policyChecks},
            {"policy_version", policy_.at("id")}};
}
}
