#include "services/planning.hpp"
#include "services/assessment.hpp"
#include "services/identity.hpp"
#include "services/market.hpp"
#include "engines/planner.hpp"
#include "security/accounts.hpp"
#include <charconv>

namespace cw {
namespace {
std::string idOf(const Json& row) { return row.at("id").dump(); }

struct Preset { const char* id; const char* name; const char* description; };
const std::vector<Preset>& presets() {
    static const std::vector<Preset> list = {
        {"reduce_utilization","Lower credit utilization","Reduce reported credit utilization by 20 points."},
        {"build_reserves","Build three months of reserves","Add three months of essential spending to emergency savings."},
        {"pay_down_debt","Pay down a quarter of your debt","Reduce outstanding debt by 25%."},
        {"raise_income","Earn 10% more","Increase salary by 10%."},
        {"cut_discretionary","Trim optional spending","Reduce discretionary spending by 30% and save the difference."},
        {"miss_payment","Miss a payment","See the effect of one additional missed repayment."}
    };
    return list;
}
Json presetChanges(const std::string& id, const Json& p) {
    auto n = [&](const char* k) { return p.at(k).get<Money>(); };
    if (id == "reduce_utilization") return {{"utilization", std::max<Money>(0, n("utilization") - 20)}};
    if (id == "build_reserves") return {{"reserves", n("reserves") + 3 * n("essential")}};
    if (id == "pay_down_debt") return {{"debt", n("debt") * 75 / 100}};
    if (id == "raise_income") return {{"salary", n("salary") * 110 / 100}};
    if (id == "cut_discretionary") {
        const Money cut = n("discretionary") * 30 / 100;
        return {{"discretionary", n("discretionary") - cut}, {"savings", n("savings") + cut}};
    }
    if (id == "miss_payment") return {{"missed", n("missed") + 1}};
    throw Error(422, "validation", "Choose a supported scenario preset.");
}
Json summary(const Json& credit, const Json& metrics) {
    return {{"score", credit.at("score")}, {"risk", credit.at("risk")}, {"capacity", credit.at("capacity")},
            {"strategy", credit.at("strategy")}, {"health", credit.at("health")}, {"affordability", credit.at("affordability")},
            {"disposable", metrics.at("disposable")}, {"emi_ratio", metrics.at("emi_ratio")}, {"savings_rate", metrics.at("savings_rate")}};
}
Json effective(Database& db, const std::string& uid) {
    return getProfile(db, uid).at("effective_profile");
}
// The twin works on a cloned profile. Nothing here writes to the borrower's records.
Json twin(Database& db, const std::string& uid, const Json& body) {
    const auto base = effective(db, uid);
    Json changes = Json::object();
    std::string preset = body.contains("preset") ? field(body, "preset", 40) : "";
    if (!preset.empty()) changes = presetChanges(preset, base);
    if (body.contains("changes")) {
        require(body.at("changes").is_object(), "Send the profile changes as an object.");
        for (const auto& [k, v] : body.at("changes").items()) changes[k] = v;
    }
    require(!changes.empty(), "Choose a preset or change at least one value.");
    const auto before = FinancialProfile().adjusted(base);
    const auto after = before.adjusted(changes);
    const int recent = assess(db, uid, false).at("recent_applications").get<int>();
    const auto baseline = modelCredit(db, before.values(), recent), scenario = modelCredit(db, after.values(), recent);
    Json factors = Json::array();
    for (const auto& f : scenario.at("factors")) {
        Json prior = nullptr;
        for (const auto& g : baseline.at("factors")) if (g.at("key") == f.at("key")) prior = g.at("value");
        factors.push_back({{"name", f.at("name")}, {"before", prior}, {"after", f.at("value")}});
    }
    Json delta = {{"score", baseline.at("score").is_number() && scenario.at("score").is_number()
                                ? Json(scenario.at("score").get<int>() - baseline.at("score").get<int>()) : Json(nullptr)},
                  {"capacity", scenario.at("capacity").get<Money>() - baseline.at("capacity").get<Money>()},
                  {"disposable", after.metrics().at("disposable").get<Money>() - before.metrics().at("disposable").get<Money>()}};
    return {{"preset", preset}, {"changes", changes}, {"baseline", summary(baseline, before.metrics())},
            {"scenario", summary(scenario, after.metrics())}, {"delta", delta}, {"factors", factors},
            {"suggestions", scenario.at("suggestions")}, {"reasons", scenario.at("reasons")}};
}
Json loanDebts(Database& db, const std::string& uid) {
    return db.rows(R"(SELECT 'Loan '||l.id||' · '||(l.product_terms->>'name') AS name,l.outstanding AS balance,
        coalesce((SELECT s.principal+s.interest FROM repayment_schedules s WHERE s.loan_id=l.id AND s.active AND s.paid_on IS NULL
                  ORDER BY s.month LIMIT 1),l.emi) AS minimum,l.rate_bps
        FROM loans l WHERE l.user_id=$1 AND l.status IN ('active','defaulted') ORDER BY l.id)", {uid});
}
Json debtPlan(Database& db, const std::string& uid, const Json& body) {
    Json debts = loanDebts(db, uid);
    if (body.contains("extra_debts")) {
        require(body.at("extra_debts").is_array(), "Send extra debts as a list.");
        for (const auto& d : body.at("extra_debts")) debts.push_back(d);
    }
    require(!debts.empty(), "Add at least one debt, or take a loan through CredWise first.");
    auto result = DebtNavigator::plan(debts, integer(body, "monthly_budget", 1, maxMoney), field(body, "strategy", 12));
    result["debts"] = debts;
    return result;
}
Json stress(Database& db, const std::string& uid, const Json& body) {
    return StressTester::run(FinancialProfile().adjusted(effective(db, uid)), body);
}
Json education(Database& db, const Json& body) {
    Json input = body;
    if (!input.contains("rate_bps")) input["rate_bps"] = loadProduct(db, "education")->terms().at("rate_bps");
    auto result = EducationPlanner::project(input);
    result["input"] = input;
    return result;
}
Json run(Database& db, const std::string& uid, const std::string& kind, const Json& input) {
    if (kind == "twin") return twin(db, uid, input);
    if (kind == "stress") return stress(db, uid, input);
    if (kind == "debt") return debtPlan(db, uid, input);
    if (kind == "education") return education(db, input);
    throw Error(404, "not_found", "Unknown planning tool.");
}
}

std::optional<Response> planningRoutes(Database& db, const Request& req) {
    if (req.path.empty() || req.path[0] != "planning") return std::nullopt;
    const auto user = authenticate(db, req, Permission::customerWorkspace);
    const auto uid = idOf(user);
    if (req.path.size() == 2 && req.method == "GET") {
        if (req.path[1] == "presets") {
            Json items = Json::array();
            for (const auto& p : presets()) items.push_back({{"id", p.id}, {"name", p.name}, {"description", p.description}});
            return Response{{{"items", items}}};
        }
        if (req.path[1] == "context") {
            auto profile = getProfile(db, uid);
            return Response{{{"debts", loanDebts(db, uid)}, {"profile", profile.at("effective_profile")}, {"metrics", profile.at("metrics")},
                             {"education_rate_bps", loadProduct(db, "education")->terms().at("rate_bps")}}};
        }
        if (req.path[1] == "scenarios")
            return Response{{{"items", db.rows("SELECT id,kind,name,input,result,created_at FROM planning_scenarios WHERE user_id=$1 ORDER BY id DESC LIMIT 50", {uid})}}};
    }
    if (req.path.size() == 2 && req.method == "POST") {
        const auto& tool = req.path[1];
        if (tool == "scenarios") {
            const auto kind = field(req.body, "kind", 12), name = field(req.body, "name", 100);
            require(req.body.contains("input") && req.body.at("input").is_object(), "Send the scenario inputs.");
            Transaction tx(db);
            db.one("SELECT id FROM users WHERE id=$1 FOR UPDATE", {uid});
            require(db.one("SELECT count(*) AS n FROM planning_scenarios WHERE user_id=$1", {uid}).at("n").get<int>() < 100,
                    "Delete older scenarios before saving more.");
            auto result = run(db, uid, kind, req.body.at("input"));
            auto saved = db.one("INSERT INTO planning_scenarios(user_id,kind,name,input,result) VALUES($1,$2,$3,$4::jsonb,$5::jsonb) RETURNING id,kind,name,created_at",
                                {uid, kind, name, req.body.at("input").dump(), result.dump()});
            tx.commit();
            return Response{saved, 201};
        }
        if (tool == "twin" || tool == "stress" || tool == "debt" || tool == "education") {
            Transaction tx(db);
            db.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
            auto result = run(db, uid, tool, req.body);
            tx.commit();
            return Response{result};
        }
    }
    return std::nullopt;
}
}
