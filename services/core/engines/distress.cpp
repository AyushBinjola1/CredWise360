#include "engines/distress.hpp"
#include <memory>

namespace cw {
namespace {
std::string whole(double v) { return std::to_string(static_cast<long long>(std::llround(v))); }
std::string rupees(Money paise) { return "INR " + std::to_string(paise / 100); }
double number(const Json& facts, const char* key, double fallback = 0) {
    return facts.contains(key) && facts.at(key).is_number() ? facts.at(key).get<double>() : fallback;
}
// Percentage change from the first to the last of a trend, or null when fewer than two points exist.
Json change(const Json& trend) {
    if (!trend.is_array() || trend.size() < 2 || trend.front().get<double>() <= 0) return nullptr;
    return 100.0 * (trend.back().get<double>() - trend.front().get<double>()) / trend.front().get<double>();
}

struct InstalmentBurden final : DistressIndicator {
    Json evaluate(const Json& f) const override {
        if (f.at("emi_ratio").is_null()) return nullptr;
        const double r = f.at("emi_ratio");
        const char* level = r > 50 ? "alert" : r > 35 ? "watch" : "ok";
        return result("emi_burden", "Instalments compared with income", level,
                      "Monthly instalments use " + whole(r) + "% of income. A common guideline is 35% or less.",
                      "Explore eligible repayment restructuring before taking on new credit.");
    }
};
struct DebtLoad final : DistressIndicator {
    Json evaluate(const Json& f) const override {
        if (f.at("dti").is_null()) return nullptr;
        const double r = f.at("dti");
        return result("debt_burden", "Total debt compared with yearly income", r > 100 ? "alert" : r > 60 ? "watch" : "ok",
                      "Outstanding debt equals " + whole(r) + "% of a year's income.",
                      "Direct spare cash to the highest-interest debt using the Debt freedom planner.");
    }
};
struct MissedPayments final : DistressIndicator {
    Json evaluate(const Json& f) const override {
        const int missed = static_cast<int>(number(f, "missed")), overdue = static_cast<int>(number(f, "overdue_count"));
        const char* level = (missed >= 3 || overdue >= 2) ? "alert" : (missed >= 1 || overdue >= 1) ? "watch" : "ok";
        return result("missed_payments", "Missed or late payments", level,
                      std::to_string(missed) + " missed or late payment(s) on record and " + std::to_string(overdue) + " instalment(s) overdue now.",
                      "Pay overdue instalments first. Contact support early if you cannot.");
    }
};
struct OverdueAmount final : DistressIndicator {
    Json evaluate(const Json& f) const override {
        const Money overdue = static_cast<Money>(number(f, "overdue_amount"));
        if (overdue <= 0) return result("overdue_amount", "Overdue balance", "ok", "No overdue instalments.", "");
        return result("overdue_amount", "Overdue balance", "alert", rupees(overdue) + " is overdue and may attract late charges.",
                      "Make a manageable payment now to stop charges building up.");
    }
};
struct Reserves final : DistressIndicator {
    Json evaluate(const Json& f) const override {
        if (f.at("coverage").is_null()) return nullptr;
        const double c = f.at("coverage");
        return result("reserves", "Emergency savings", c < 1 ? "alert" : c < 3 ? "watch" : "ok",
                      "Savings cover about " + std::to_string(std::round(c * 10) / 10).substr(0, 4) + " months of essential costs and instalments. Three months is a common target.",
                      "Set aside a small fixed amount each month before spending on optional items.");
    }
};
struct Cashflow final : DistressIndicator {
    Json evaluate(const Json& f) const override {
        const double income = number(f, "income");
        if (income <= 0) return nullptr;
        const double d = number(f, "disposable");
        return result("cashflow", "Monthly cash left over", d < 0 ? "alert" : d < 0.1 * income ? "watch" : "ok",
                      d < 0 ? "Spending and instalments exceed income by " + rupees(static_cast<Money>(-d)) + " a month."
                            : "About " + rupees(static_cast<Money>(d)) + " is left each month after spending and instalments.",
                      "Review your budget and adjust optional expenses.");
    }
};
struct FallingSavings final : DistressIndicator {
    Json evaluate(const Json& f) const override {
        auto c = change(f.value("reserves_trend", Json::array()));
        if (c.is_null()) return nullptr;
        const double v = c;
        return result("falling_savings", "Savings trend", v < -30 ? "alert" : v < -10 ? "watch" : "ok",
                      "Emergency savings changed by " + whole(v) + "% across your recent profile updates.",
                      "Pause optional spending until savings stabilise.");
    }
};
struct FallingIncome final : DistressIndicator {
    Json evaluate(const Json& f) const override {
        auto c = change(f.value("disposable_trend", Json::array()));
        if (c.is_null()) return nullptr;
        const double v = c;
        return result("declining_disposable", "Cash-flow trend", v < -30 ? "alert" : v < -15 ? "watch" : "ok",
                      "Monthly cash left over changed by " + whole(v) + "% across your recent profile updates.",
                      "Check whether income dropped or spending rose, and update your profile.");
    }
};
struct UpcomingPayments final : DistressIndicator {
    Json evaluate(const Json& f) const override {
        const Money due = static_cast<Money>(number(f, "due_30d"));
        if (due <= 0) return nullptr;
        const double room = number(f, "disposable") + number(f, "emi_in_profile");
        const char* level = room <= 0 || due > room ? "alert" : due > 0.7 * room ? "watch" : "ok";
        return result("upcoming_payments", "Payments due in the next 30 days", level,
                      rupees(due) + " falls due within 30 days.", "Keep this amount aside so no instalment is missed.");
    }
};
}

Json DistressIndicator::result(const std::string& key, const std::string& title, const std::string& level,
                               const std::string& detail, const std::string& action) {
    return {{"key", key}, {"title", title}, {"level", level}, {"detail", detail}, {"action", action}};
}

Json DistressMonitor::assess(const Json& facts) {
    std::vector<std::unique_ptr<DistressIndicator>> indicators;
    indicators.push_back(std::make_unique<InstalmentBurden>());
    indicators.push_back(std::make_unique<DebtLoad>());
    indicators.push_back(std::make_unique<MissedPayments>());
    indicators.push_back(std::make_unique<OverdueAmount>());
    indicators.push_back(std::make_unique<Reserves>());
    indicators.push_back(std::make_unique<Cashflow>());
    indicators.push_back(std::make_unique<FallingSavings>());
    indicators.push_back(std::make_unique<FallingIncome>());
    indicators.push_back(std::make_unique<UpcomingPayments>());
    Json list = Json::array(), actions = Json::array();
    int score = 0;
    for (const auto& indicator : indicators) {
        auto item = indicator->evaluate(facts);
        if (item.is_null()) continue;
        const int points = item.at("level") == "alert" ? 3 : item.at("level") == "watch" ? 1 : 0;
        item["points"] = points;
        score += points;
        if (points && !item.at("action").get<std::string>().empty()) actions.push_back(item.at("action"));
        list.push_back(std::move(item));
    }
    const bool noData = number(facts, "income") <= 0 && list.size() < 3;
    const std::string level = score >= 6 ? "high" : score >= 3 ? "elevated" : score >= 1 ? "watch" : "low";
    if (level == "elevated" || level == "high") actions.push_back("Open a support request to talk to a person about repayment options.");
    if (actions.empty()) actions.push_back("Keep paying on time and keep building your emergency savings.");
    return {{"level", level}, {"score", score}, {"indicators", list}, {"recommendations", actions}, {"insufficient_data", noData},
            {"notice", "This view exists to offer support. It never changes your score, eligibility or interest rate."}};
}
}
