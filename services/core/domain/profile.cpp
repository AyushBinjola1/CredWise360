#include "domain/profile.hpp"
#include <set>

namespace cw {
const std::vector<std::string>& FinancialProfile::moneyFields() {
    static const std::vector<std::string> fields = {
        "salary", "business_income", "other_income", "essential", "discretionary", "savings",
        "existing_emi", "debt", "assets", "liabilities", "reserves"
    };
    return fields;
}

FinancialProfile::FinancialProfile() {
    values_ = {{"employment","Not specified"},{"goal",""},{"consent",false},
               {"rent",nullptr},{"utilities",nullptr},{"income_regularity",nullptr},
               {"savings_reported",false},{"emi_reported",false}};
    for (const auto& key : moneyFields()) values_[key] = 0;
    for (const auto key : {"goal_amount","stability_months","credit_months","utilization","on_time","missed"}) values_[key] = 0;
}

FinancialProfile FinancialProfile::adjusted(const Json& changes) const {
    require(changes.is_object(), "Enter a financial profile.");
    FinancialProfile result(*this);
    for (const auto& [key, value] : changes.items()) {
        require(values_.contains(key), "Unknown financial profile field: " + key + ".");
        if (key == "consent" || key == "savings_reported" || key == "emi_reported")
            require(value.is_boolean(), "Choose whether evidence is available.");
        else if (value.is_null() && (key == "rent" || key == "utilities" || key == "income_regularity")) {
            result.values_[key] = nullptr;
            continue;
        }
        else if (key == "employment") field(changes, key, 80);
        else if (key == "goal") field(changes, key, 240, true);
        else {
            Money maximum = maxMoney;
            if (key == "stability_months" || key == "credit_months") maximum = 1200;
            else if (key == "on_time" || key == "missed") maximum = 12000;
            else if (key == "rent" || key == "utilities" || key == "income_regularity" || key == "utilization") maximum = 100;
            integer(changes, key, 0, maximum);
        }
        result.values_[key] = value;
    }
    if (changes.contains("savings") && !changes.contains("savings_reported")) result.values_["savings_reported"] = true;
    if (changes.contains("existing_emi") && !changes.contains("emi_reported")) result.values_["emi_reported"] = true;
    return result;
}

FinancialProfile FinancialProfile::withPortfolio(const Json& commitments) const {
    FinancialProfile combined(*this);
    for (const auto* key : {"debt","existing_emi","on_time","missed"}) {
        Money declared = values_.at(key);
        Money posted = integer(commitments,key,0,9'007'199'254'740'991LL-declared);
        combined.values_[key] = declared + posted;
    }
    combined.values_["credit_months"] = std::max(values_.at("credit_months").get<int>(),
                                                  commitments.value("credit_months",0));
    if (commitments.at("existing_emi") > 0) combined.values_["emi_reported"] = true;
    return combined;
}

Json FinancialProfile::metrics() const {
    auto money = [&](const char* key) { return values_.at(key).get<Money>(); };
    const Money income = money("salary") + money("business_income") + money("other_income");
    const Money expenses = money("essential") + money("discretionary");
    const Money commitments = money("essential") + money("existing_emi");
    const Money disposable = income - expenses - money("existing_emi");
    auto ratio = [](Money value, Money base, double scale) -> Json {
        if (base == 0) return nullptr;
        return std::round((double(value) / double(base)) * scale * 100) / 100;
    };
    Json health = nullptr;
    if (income > 0) {
        auto bounded = [](double value) { return std::clamp(value, 0.0, 1.0); };
        const double margin = bounded(double(disposable) / (0.35 * income));
        const double saving = bounded(double(money("savings")) / (0.2 * income));
        const double buffer = commitments ? bounded(double(money("reserves")) / (6.0 * commitments)) : 0.0;
        const double emiRoom = bounded(1 - double(money("existing_emi")) / (0.6 * income));
        health = std::lround(100 * (0.35 * margin + 0.25 * saving + 0.20 * buffer + 0.20 * emiRoom));
    }
    return {
        {"income",income},{"expenses",expenses},{"disposable",disposable},
        {"net_worth",money("assets") + money("reserves") - money("debt") - money("liabilities")},
        {"savings_rate",ratio(money("savings"),income,100)},
        {"dti",ratio(money("debt"),12 * income,100)},{"emi_ratio",ratio(money("existing_emi"),income,100)},
        {"coverage",ratio(money("reserves"),commitments,1)},{"health",health}
    };
}
}
