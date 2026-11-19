#include "engines/credit.hpp"
#include <map>
#include <memory>

namespace cw {
namespace {
double bound(double value) { return std::clamp(value,0.0,100.0); }
double rounded(double value) { return std::round(value * 100) / 100.0; }
Json scoreRatio(double numerator, double denominator) {
    if (denominator <= 0) return nullptr;
    return rounded(bound(100 * numerator / denominator));
}
Json inverseRatio(double numerator, double denominator) {
    if (denominator <= 0) return nullptr;
    return rounded(bound(100 * (1 - numerator / denominator)));
}
Json factor(const Json& weights, const std::string& key, const std::string& name, const Json& value,
            const std::string& reason, const std::string& action) {
    return {{"key",key},{"code",key},{"name",name},{"weight",weights.at(key)},{"value",value},
            {"reason",value.is_null() ? "No usable evidence was supplied for this factor." : reason},{"action",action}};
}
std::string riskCategory(const Json& score, Money capacity, const Json& thresholds) {
    if (score.is_null()) return "human_review";
    if (capacity == 0 || score < thresholds.at("moderate_risk_score")) return "high";
    return score >= thresholds.at("low_risk_score") ? "low" : "moderate";
}
}

Json ConventionalScoring::factors(const FinancialProfile& financial, const Json& policy, int recent) const {
    const auto& p = financial.values();
    const auto& w = policy.at("conventional_weights");
    const auto& t = policy.at("thresholds");
    const auto m = financial.metrics();
    auto value = [&](const char* name){ return p.at(name).get<double>(); };
    return Json::array({
        factor(w,"repayment","Repayment history",scoreRatio(value("on_time"),value("on_time")+value("missed")),
               "Uses the proportion of recorded repayments made on time.","Prioritize upcoming due dates and address missed payments."),
        factor(w,"utilization","Credit utilization",100-value("utilization"),
               "Measures the unused share of the reported credit limit.","Test a lower utilization level in your digital twin."),
        factor(w,"obligations","Outstanding debt",m["dti"].is_null() ? Json(nullptr) :
               inverseRatio(m["dti"].get<double>(),t["max_debt_to_annual_pct"].get<double>()),
               "Compares outstanding debt with annual income.","Review the effect of a manageable principal prepayment."),
        factor(w,"history","Credit history length",scoreRatio(value("credit_months"),t["history_target_months"].get<double>()),
               "Measures months of observed credit history against the policy reference.","Keep existing repayment records accurate."),
        factor(w,"inquiries","Recent applications",inverseRatio(recent,t["max_recent_inquiries"].get<double>()),
               "Counts distinct recently submitted applications in the policy window.","Compare costs before submitting another application."),
        factor(w,"consistency","Income consistency",p.at("income_regularity"),
               "Uses reported regularity of income rather than salary size.","Maintain a record of recurring income."),
        factor(w,"resilience","Emergency reserves",m["coverage"].is_null() ? Json(nullptr) :
               scoreRatio(m["coverage"].get<double>(),t["full_reserve_months"].get<double>()),
               "Compares reserves with essential spending and existing EMI.","Test an affordable emergency-savings contribution.")
    });
}

Json InclusiveScoring::factors(const FinancialProfile& financial, const Json& policy, int) const {
    const auto& p = financial.values();
    const auto& w = policy.at("alternative_weights");
    const auto& t = policy.at("thresholds");
    auto m = financial.metrics();
    return Json::array({
        factor(w,"rent","Rent payment consistency",p.at("rent"),
               "Uses voluntarily supplied evidence of regular rent payments.","Add synthetic rent payment records where available."),
        factor(w,"utilities","Utility payments",p.at("utilities"),
               "Uses voluntarily supplied evidence of on-time household bills.","Review your synthetic utility payment record."),
        factor(w,"cashflow","Income and business cash flow",p.at("income_regularity"),
               "Recognizes regular earnings from employment, a business or informal work.","Record earnings across several months."),
        factor(w,"savings","Savings behavior",!p.at("savings_reported").get<bool>() || m["savings_rate"].is_null() ? Json(nullptr) :
               scoreRatio(m["savings_rate"].get<double>(),t["full_savings_pct"].get<double>()),
               "Compares the share of income saved with the policy reference.","Choose a savings amount that leaves essential expenses covered."),
        factor(w,"commitments","Existing commitments",!p.at("emi_reported").get<bool>() || m["emi_ratio"].is_null() ? Json(nullptr) :
               inverseRatio(m["emi_ratio"].get<double>(),t["emi_cap_pct"].get<double>()),
               "Measures remaining room after existing monthly debt payments.","Review commitments before choosing a new EMI.")
    });
}

Json CreditScoreEngine::evaluate(const Json& fullProfile, int recent) const {
    require(fullProfile.is_object() && recent >= 0, "Check the financial evidence.");
    FinancialProfile defaults;
    Json financialFields = Json::object();
    // Identity and demographic fields never enter a scoring strategy.
    for (const auto& [name,value] : defaults.values().items())
        if (fullProfile.contains(name)) financialFields[name] = fullProfile.at(name);
    return evaluate(defaults.adjusted(financialFields),recent);
}

Json CreditScoreEngine::evaluate(const FinancialProfile& financial, int recent) const {
    const auto& p = financial.values();
    auto metrics = financial.metrics();
    const auto& t = policy_.at("thresholds");
    auto T = [&](const char* key){ return t.at(key).get<int>(); };
    const auto income = metrics.at("income").get<Money>();
    const auto emi = p.at("existing_emi").get<Money>();
    const auto disposable = metrics.at("disposable").get<Money>();
    const Money emiLimit = income * T("emi_cap_pct") / 100;
    const Money capacity = std::max<Money>(0,std::min(emiLimit - emi,disposable * T("cashflow_share_pct") / 100));
    const Money payments = p.at("on_time").get<Money>() + p.at("missed").get<Money>();
    bool conventional = payments >= T("min_conventional_payments") && p.at("credit_months").get<int>() >= T("min_history_months");
    bool consent = p.at("consent").get<bool>();
    std::unique_ptr<ScoringStrategy> strategy;
    if (conventional) strategy = std::make_unique<ConventionalScoring>();
    else if (consent) strategy = std::make_unique<InclusiveScoring>();
    Json factors = strategy ? strategy->factors(financial,policy_,recent) : Json::array();
    double weighted = 0, weight = 0;
    int evidence = 0;
    Json positive=Json::array(),negative=Json::array(),suggestions=Json::array(),codes=Json::array(),reasons=Json::array();
    for (const auto& item : factors) {
        if (item.at("value").is_null()) continue;
        const int w = item.at("weight").get<int>();
        if (w == 0) continue;
        const double v = item.at("value").get<double>();
        ++evidence;
        weighted += w * v;
        weight += w;
        if (v >= T("positive_factor_min")) positive.push_back(item.at("name"));
        else if (v <= T("negative_factor_max")) {
            negative.push_back(item.at("name"));
            codes.push_back("review_" + item.at("key").get<std::string>());
            reasons.push_back(item.at("reason"));
            suggestions.push_back(item.at("action"));
        }
    }
    bool sufficient = weight > 0 && (conventional || (consent && evidence >= T("alt_min_evidence")));
    for (auto& item : factors) {
        const double share = sufficient && !item.at("value").is_null() ? item.at("weight").get<double>() / weight : 0;
        item["effective_weight"] = rounded(share * 100);
    }
    Json score = sufficient ? Json(std::lround(300 + 6 * weighted / weight)) : Json(nullptr);
    const std::string mode = sufficient ? (conventional ? "conventional" : "alternative") : "insufficient";
    if (!sufficient) {
        codes.push_back("insufficient_evidence");
        reasons.push_back("Evidence is limited. A person should review the application before a decision.");
        suggestions.push_back(consent ? "Add any available rent, utility or earnings evidence." :
                               "You can choose a human review or consent to an alternative assessment.");
    } else if (reasons.empty()) {
        codes.push_back("balanced_factors");
        reasons.push_back("Recorded factors meet the policy reference levels for this simulated assessment.");
    }
    if (capacity == 0) {
        codes.push_back("no_monthly_headroom");
        reasons.push_back("Current income, expenses and commitments leave no additional monthly EMI capacity.");
    }
    if (suggestions.empty()) suggestions.push_back("Continue monitoring due dates and compare any borrowing need with your budget.");
    return {
        {"score",score},{"strategy",mode},{"risk",riskCategory(score,capacity,t)},{"human_review",!sufficient},
        {"capacity",capacity},{"affordability",scoreRatio(capacity,emiLimit)},{"health",metrics.at("health")},
        {"stability",p.at("income_regularity")},
        {"evidence_count",evidence},{"recent_applications",recent},
        {"factors",factors},{"positive_factors",positive},{"negative_factors",negative},
        {"reasons",reasons},{"reason_codes",codes},{"suggestions",suggestions},{"policy_version",policy_.at("id")}
    };
}

void validateCreditPolicy(const Json& policy) {
    const std::map<std::string,std::vector<std::string>> weights = {
        {"conventional_weights",{"repayment","utilization","obligations","history","inquiries","consistency","resilience"}},
        {"alternative_weights",{"rent","utilities","cashflow","savings","commitments"}}
    };
    for (const auto& [group, keys] : weights) {
        const auto& values = policy.at(group);
        require(values.is_object() && values.size() == keys.size(),"Use the supported factor weights.");
        Money total = 0;
        for (const auto& key : keys) total += integer(values,key,0,100);
        require(total == 100,"Each strategy's factor weights must total 100.");
    }
    const std::map<std::string,std::pair<int,int>> limits = {
        {"min_conventional_payments",{1,240}},{"min_history_months",{1,120}},{"history_target_months",{1,600}},
        {"inquiry_window_days",{1,730}},{"max_recent_inquiries",{1,100}},{"full_reserve_months",{1,60}},
        {"full_savings_pct",{1,100}},{"max_debt_to_annual_pct",{1,1000}},{"emi_cap_pct",{1,90}},
        {"cashflow_share_pct",{1,100}},{"low_risk_score",{300,900}},{"moderate_risk_score",{300,900}},
        {"alt_min_evidence",{1,5}},{"positive_factor_min",{1,100}},{"negative_factor_max",{0,99}}
    };
    const auto& thresholds = policy.at("thresholds");
    require(thresholds.is_object() && thresholds.size() == limits.size(),"Use the supported policy thresholds.");
    for (const auto& [name,range] : limits) integer(thresholds,name,range.first,range.second);
    require(thresholds.at("low_risk_score") > thresholds.at("moderate_risk_score"),"Order the risk score thresholds.");
    require(thresholds.at("positive_factor_min") > thresholds.at("negative_factor_max"),"Order the factor thresholds.");
    require(thresholds.at("history_target_months") >= thresholds.at("min_history_months"),"Check the credit history thresholds.");
}
}
