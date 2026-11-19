#include "services/learning.hpp"
#include "services/identity.hpp"
#include "security/accounts.hpp"
#include <memory>
#include <mutex>

namespace cw {
namespace {
const Json& lessons() {
    static Json cache;
    static std::once_flag once;
    std::call_once(once, [] {
        const auto root = std::filesystem::path(setting("CREDWISE_DB_DIR", "database"));
        cache = Json::parse(readFile(root / "seeds" / "academy.json"));
    });
    return cache;
}
const Json& lessonFor(const std::string& slug) {
    for (const auto& item : lessons()) if (item.at("slug") == slug) return item;
    throw Error(404, "not_found", "That lesson could not be found.");
}
std::string language(const Request& req, const Json& body = Json::object()) {
    std::string lang = "en";
    if (auto it = req.query.find("lang"); it != req.query.end()) lang = it->second;
    if (body.contains("lang")) lang = field(body, "lang", 2);
    require(lang == "en" || lang == "hi", "Choose English (en) or Hindi (hi).");
    return lang;
}
std::string idOf(const Json& row) { return row.at("id").dump(); }

Json progress(Database& db, const std::string& uid) {
    return db.rows(R"(SELECT lesson,count(*) AS attempts,bool_or(correct) AS completed FROM quiz_attempts WHERE user_id=$1 GROUP BY lesson)", {uid});
}
Json lessonList(Database& db, const std::string& uid, const std::string& lang) {
    auto done = progress(db, uid);
    Json items = Json::array();
    int completed = 0;
    for (const auto& lesson : lessons()) {
        bool finished = false;
        int attempts = 0;
        for (const auto& row : done) if (row.at("lesson") == lesson.at("slug")) { finished = row.at("completed"); attempts = row.at("attempts"); }
        completed += finished;
        items.push_back({{"slug", lesson.at("slug")}, {"title", lesson.at(lang).at("title")}, {"completed", finished}, {"attempts", attempts}});
    }
    const int total = static_cast<int>(lessons().size());
    return {{"language", lang}, {"items", items}, {"progress", {{"completed", completed}, {"total", total}, {"percent", total ? 100 * completed / total : 0}}}};
}
Json lessonDetail(Database& db, const std::string& uid, const std::string& slug, const std::string& lang) {
    const auto& lesson = lessonFor(slug);
    const auto& text = lesson.at(lang);
    auto row = db.one("SELECT count(*) AS attempts,coalesce(bool_or(correct),false) AS completed FROM quiz_attempts WHERE user_id=$1 AND lesson=$2", {uid, slug});
    return {{"slug", slug}, {"language", lang}, {"title", text.at("title")}, {"lesson", text.at("lesson")}, {"question", text.at("question")},
            {"choices", text.at("choices")}, {"attempts", row.at("attempts")}, {"completed", row.at("completed")}};
}
Json answer(Database& db, const std::string& uid, const std::string& slug, const Request& req) {
    const auto lang = language(req, req.body);
    const auto& lesson = lessonFor(slug);
    const auto& text = lesson.at(lang);
    const int choice = static_cast<int>(integer(req.body, "choice", 0, 9));
    require(choice < static_cast<int>(text.at("choices").size()), "Choose one of the listed answers.");
    const bool correct = choice == lesson.at("answer").get<int>();
    db.exec("INSERT INTO quiz_attempts(user_id,lesson,language,choice,correct) VALUES($1,$2,$3,$4,$5)",
            {uid, slug, lang, std::to_string(choice), correct ? "true" : "false"});
    return {{"correct", correct}, {"correct_choice", lesson.at("answer")}, {"explanation", text.at("explanation")},
            {"detail", lessonDetail(db, uid, slug, lang)}};
}

// Reward rules are independent strategies. None of them pays for applying, borrowing or being disbursed a loan.
class RewardRule {
public:
    virtual ~RewardRule() = default;
    virtual void apply(Database& db, const std::string& uid) const = 0;
protected:
    static void award(Database& db, const std::string& uid, const std::string& kind, int points, const std::string& ref, const std::string& note) {
        db.exec("INSERT INTO reward_events(user_id,kind,points,ref,note) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING", {uid, kind, std::to_string(points), ref, note});
    }
};
struct LessonRule final : RewardRule {
    void apply(Database& db, const std::string& uid) const override {
        db.exec(R"(INSERT INTO reward_events(user_id,kind,points,ref,note)
            SELECT $1::bigint,'learning',10,'lesson:'||lesson,'Completed a lesson quiz' FROM (SELECT DISTINCT lesson FROM quiz_attempts WHERE user_id=$1 AND correct) x
            ON CONFLICT DO NOTHING)", {uid});
    }
};
struct OnTimeRule final : RewardRule {
    void apply(Database& db, const std::string& uid) const override {
        db.exec(R"(INSERT INTO reward_events(user_id,kind,points,ref,note)
            SELECT $1::bigint,'repayment',5,'emi:'||s.loan_id||':'||s.month,'Paid instalment '||s.month||' of loan '||s.loan_id||' on time'
            FROM repayment_schedules s JOIN loans l ON l.id=s.loan_id
            WHERE l.user_id=$1 AND s.settlement='scheduled' AND s.paid_on<=s.due_date ON CONFLICT DO NOTHING)", {uid});
    }
};
struct DebtMilestoneRule final : RewardRule {
    void apply(Database& db, const std::string& uid) const override {
        db.exec(R"(INSERT INTO reward_events(user_id,kind,points,ref,note)
            SELECT $1::bigint,'milestone',20,'halfway:'||l.id,'Repaid half of loan '||l.id||' without late charges' FROM loans l
            WHERE l.user_id=$1 AND l.outstanding*2<=l.principal AND NOT EXISTS (SELECT 1 FROM loan_penalties p WHERE p.loan_id=l.id)
            AND (SELECT count(*) FROM repayment_schedules s WHERE s.loan_id=l.id AND s.settlement='scheduled')>=3 ON CONFLICT DO NOTHING)", {uid});
    }
};
struct SavingsGoalRule final : RewardRule {
    void apply(Database& db, const std::string& uid) const override {
        const auto profile = getProfile(db, uid).at("profile");
        const Money goal = profile.at("goal_amount").get<Money>();
        if (goal > 0 && profile.at("reserves").get<Money>() >= goal)
            award(db, uid, "savings", 30, "goal:" + std::to_string(goal), "Emergency savings reached your goal");
    }
};
struct ScoreImprovementRule final : RewardRule {
    void apply(Database& db, const std::string& uid) const override {
        auto row = db.one(R"(SELECT (SELECT score FROM credit_score_history WHERE user_id=$1 AND score IS NOT NULL ORDER BY id LIMIT 1) AS first,
            (SELECT score FROM credit_score_history WHERE user_id=$1 AND score IS NOT NULL ORDER BY id DESC LIMIT 1) AS latest)", {uid});
        if (row.at("first").is_number() && row.at("latest").get<int>() - row.at("first").get<int>() >= 40)
            award(db, uid, "improvement", 25, "score_improved", "Simulated score rose by 40 points or more");
    }
};
struct PlanningRule final : RewardRule {
    void apply(Database& db, const std::string& uid) const override {
        db.exec(R"(INSERT INTO reward_events(user_id,kind,points,ref,note)
            SELECT DISTINCT $1::bigint,'planning',5,'plan:'||kind,'Saved a '||kind||' plan' FROM planning_scenarios WHERE user_id=$1 ON CONFLICT DO NOTHING)", {uid});
    }
};

struct BadgeInfo { const char* id; const char* name; const char* description; };
const std::vector<BadgeInfo>& badgeCatalogue() {
    static const std::vector<BadgeInfo> list = {
        {"first_lesson", "First lesson", "Answered a lesson quiz correctly."},
        {"academy_graduate", "Academy graduate", "Completed every lesson in the academy."},
        {"steady_payer", "Steady payer", "Paid three instalments on or before the due date."},
        {"consistent_payer", "Consistent payer", "Paid twelve instalments on or before the due date."},
        {"halfway", "Halfway there", "Repaid half of a loan without late charges."},
        {"goal_reached", "Goal reached", "Emergency savings reached your own goal."},
        {"score_climber", "Score climber", "Raised the simulated score by 40 points or more."},
        {"planner", "Planner", "Saved a plan in the planning tools."}
    };
    return list;
}
Json syncRewards(Database& db, const std::string& uid) {
    std::vector<std::unique_ptr<RewardRule>> rules;
    rules.push_back(std::make_unique<LessonRule>());
    rules.push_back(std::make_unique<OnTimeRule>());
    rules.push_back(std::make_unique<DebtMilestoneRule>());
    rules.push_back(std::make_unique<SavingsGoalRule>());
    rules.push_back(std::make_unique<ScoreImprovementRule>());
    rules.push_back(std::make_unique<PlanningRule>());
    for (const auto& rule : rules) rule->apply(db, uid);
    auto count = [&](const std::string& ref) { return db.one("SELECT count(*) AS n FROM reward_events WHERE user_id=$1 AND ref LIKE $2", {uid, ref}).at("n").get<int>(); };
    const int lessonsDone = count("lesson:%"), onTime = count("emi:%"), plans = count("plan:%");
    std::vector<std::pair<std::string, bool>> earned = {
        {"first_lesson", lessonsDone >= 1}, {"academy_graduate", lessonsDone >= static_cast<int>(lessons().size())},
        {"steady_payer", onTime >= 3}, {"consistent_payer", onTime >= 12}, {"halfway", count("halfway:%") >= 1},
        {"goal_reached", count("goal:%") >= 1}, {"score_climber", count("score_improved") >= 1}, {"planner", plans >= 1}};
    for (const auto& [badge, ok] : earned)
        if (ok) db.exec("INSERT INTO reward_badges(user_id,badge) VALUES($1,$2) ON CONFLICT DO NOTHING", {uid, badge});
    auto owned = db.rows("SELECT badge,awarded_at FROM reward_badges WHERE user_id=$1", {uid});
    Json badges = Json::array();
    for (const auto& info : badgeCatalogue()) {
        Json awarded = nullptr;
        for (const auto& row : owned) if (row.at("badge") == info.id) awarded = row.at("awarded_at");
        badges.push_back({{"id", info.id}, {"name", info.name}, {"description", info.description}, {"awarded_at", awarded}});
    }
    const int points = db.one("SELECT coalesce(sum(points),0)::int AS p FROM reward_events WHERE user_id=$1", {uid}).at("p");
    const char* level = points >= 300 ? "Champion" : points >= 150 ? "Steady" : points >= 50 ? "Learner" : "Starter";
    const int next = points >= 300 ? 0 : points >= 150 ? 300 : points >= 50 ? 150 : 50;
    return {{"points", points}, {"level", level}, {"next_level_at", next ? Json(next) : Json(nullptr)}, {"badges", badges},
            {"counts", {{"lessons", lessonsDone}, {"on_time_instalments", onTime}, {"plans", plans}}},
            {"events", db.rows("SELECT kind,points,note,created_at FROM reward_events WHERE user_id=$1 ORDER BY id DESC LIMIT 50", {uid})},
            {"rules", Json::array({"10 points for each lesson quiz answered correctly",
                                   "5 points for each instalment paid on or before its due date",
                                   "20 points for repaying half of a loan with no late charges",
                                   "30 points when emergency savings reach your own goal",
                                   "25 points when your simulated score rises by 40 points or more",
                                   "5 points for each kind of planning tool you save a plan in"})},
            {"notice", "Points are educational recognition only. You never earn points for applying for, taking or increasing a loan, and points have no cash value."}};
}
}

std::optional<Response> learningRoutes(Database& db, const Request& req) {
    const auto& p = req.path;
    if (p.empty() || (p[0] != "academy" && p[0] != "rewards")) return std::nullopt;
    const auto uid = idOf(authenticate(db, req, Permission::customerWorkspace));
    if (p[0] == "rewards" && p.size() == 1 && req.method == "GET") {
        Transaction tx(db);
        auto result = syncRewards(db, uid);
        tx.commit();
        return Response{result};
    }
    if (p[0] != "academy") return std::nullopt;
    if (p.size() == 1 && req.method == "GET") return Response{lessonList(db, uid, language(req))};
    if (p.size() == 2 && req.method == "GET") return Response{lessonDetail(db, uid, p[1], language(req))};
    if (p.size() == 3 && p[2] == "answer" && req.method == "POST") {
        Transaction tx(db);
        auto result = answer(db, uid, p[1], req);
        tx.commit();
        return Response{result};
    }
    return std::nullopt;
}
}
