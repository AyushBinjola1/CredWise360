#include "services/oversight.hpp"
#include "services/engagement.hpp"
#include "services/identity.hpp"
#include "engines/distress.hpp"
#include "engines/fairness.hpp"
#include "engines/safety.hpp"
#include "security/accounts.hpp"
#include <charconv>

namespace cw {
namespace {
std::string idOf(const Json& row) { return row.at("id").dump(); }
std::string numeric(const std::string& value) {
    std::int64_t id = 0;
    auto [end, error] = std::from_chars(value.data(), value.data() + value.size(), id);
    require(error == std::errc() && end == value.data() + value.size() && id > 0, "Enter a valid record number.");
    return std::to_string(id);
}
const char* today = "(now() AT TIME ZONE 'Asia/Kolkata')::date";

Json scan(Database& db, const std::string& uid, const Json& body) {
    Json offer = body;
    offer.erase("use_profile_income");
    Money income = 0;
    if (body.value("use_profile_income", true)) income = getProfile(db, uid).at("metrics").at("income").get<Money>();
    return LoanSafetyScanner::scan(offer, income);
}

Json distressFacts(Database& db, const std::string& uid) {
    const auto profile = getProfile(db, uid);
    const auto& m = profile.at("metrics");
    const auto& p = profile.at("effective_profile");
    auto due = db.one(std::string(R"(SELECT
        count(*) FILTER (WHERE s.due_date<)") + today + R"() AS overdue_count,
        coalesce(sum(s.principal+s.interest-s.principal_paid-s.interest_paid) FILTER (WHERE s.due_date<)" + today + R"(),0) AS overdue_amount,
        coalesce(sum(s.principal+s.interest-s.principal_paid-s.interest_paid) FILTER (WHERE s.due_date>=)" + today + " AND s.due_date<=" + today + R"(+30),0) AS due_30d
        FROM repayment_schedules s JOIN loans l ON l.id=s.loan_id
        WHERE l.user_id=$1 AND l.status IN ('active','defaulted') AND s.active AND s.paid_on IS NULL)", {uid});
    Json disposable = Json::array(), reserves = Json::array();
    for (const auto& snap : db.rows("SELECT * FROM (SELECT id,metrics->>'disposable' AS d,profile->>'reserves' AS r FROM financial_snapshots WHERE user_id=$1 ORDER BY id DESC LIMIT 6) x ORDER BY id", {uid})) {
        if (!snap.at("d").is_string() || !snap.at("r").is_string()) continue;
        disposable.push_back(std::stod(snap.at("d").get<std::string>()));
        reserves.push_back(std::stod(snap.at("r").get<std::string>()));
    }
    return {{"income", m.at("income")}, {"disposable", m.at("disposable")}, {"emi_ratio", m.at("emi_ratio")}, {"dti", m.at("dti")}, {"coverage", m.at("coverage")},
            {"missed", p.at("missed")}, {"overdue_count", due.at("overdue_count")}, {"overdue_amount", due.at("overdue_amount")}, {"due_30d", due.at("due_30d")},
            {"emi_in_profile", p.at("existing_emi")}, {"disposable_trend", disposable}, {"reserves_trend", reserves}};
}
Json refreshDistress(Database& db, const std::string& uid) {
    auto result = DistressMonitor::assess(distressFacts(db, uid));
    db.exec(R"(INSERT INTO distress_cases(user_id,level,score,indicators) VALUES($1,$2,$3,$4::jsonb)
        ON CONFLICT(user_id) DO UPDATE SET level=excluded.level,score=excluded.score,indicators=excluded.indicators,updated_at=now())",
            {uid, result.at("level"), result.at("score").dump(), result.at("indicators").dump()});
    if (result.at("level") == "elevated" || result.at("level") == "high")
        db.exec(R"(INSERT INTO notifications(user_id,kind,title,body,link,dedupe_key)
            SELECT $1::bigint,'distress','Your finances may need attention','Open your wellbeing check for plain-language steps and support options.','/app/distress','distress:'||$2::text||':'||to_char(now(),'YYYY-MM')
            ON CONFLICT DO NOTHING)", {uid, result.at("level").get<std::string>()});
    return result;
}
Json customerDistress(Database& db, const std::string& uid) {
    Transaction tx(db);
    auto result = refreshDistress(db, uid);
    auto row = db.one("SELECT outreach,note,updated_at FROM distress_cases WHERE user_id=$1", {uid});
    result["support"] = {{"outreach", row.at("outreach")}, {"note", row.at("note")}};
    tx.commit();
    return result;
}
Json adminDistress(Database& db) {
    Transaction tx(db);
    // Cases are recomputed when missing or older than a minute, so a busy queue does not rescan every customer on each visit.
    for (const auto& user : db.rows(R"(SELECT u.id FROM users u LEFT JOIN distress_cases d ON d.user_id=u.id
            WHERE u.role='customer' AND u.active AND (d.user_id IS NULL OR d.updated_at<now()-interval '60 seconds') ORDER BY u.id DESC LIMIT 200)"))
        refreshDistress(db, idOf(user));
    Json items = db.rows(R"(SELECT d.user_id,u.name,u.email,d.level,d.score,d.indicators,d.outreach,d.note,d.updated_at FROM distress_cases d JOIN users u ON u.id=d.user_id
        WHERE d.level<>'low' ORDER BY (d.outreach IN ('none','contacted')) DESC,
              CASE d.level WHEN 'high' THEN 0 WHEN 'elevated' THEN 1 ELSE 2 END,d.score DESC LIMIT 200)");
    auto counts = db.rows("SELECT level,count(*) AS count FROM distress_cases GROUP BY level");
    tx.commit();
    return {{"items", items}, {"counts", counts},
            {"notice", "Cases are for supportive outreach only. A distress level never changes a customer's score, eligibility or terms."}};
}
Json supportCase(Database& db, const std::string& admin, const std::string& userId, const Json& body) {
    const auto outreach = field(body, "outreach", 16), note = field(body, "note", 600, outreach == "none");
    require(outreach == "none" || outreach == "contacted" || outreach == "plan_agreed" || outreach == "resolved", "Choose an outreach status.");
    Transaction tx(db);
    db.one("SELECT user_id FROM distress_cases WHERE user_id=$1 FOR UPDATE", {userId});
    auto updated = db.one("UPDATE distress_cases SET outreach=$2,note=$3,reviewer_id=$4,updated_at=now() WHERE user_id=$1 RETURNING user_id,outreach,note,updated_at", {userId, outreach, note, admin});
    identityAudit(db, admin, userId, "distress.outreach_" + outreach, {{"note", note}});
    if (outreach == "contacted")
        notify(db, userId, "support", "Our team would like to help", "A member of the CredWise team recorded an offer of support. Open a support ticket to talk to them.", "/app/disputes");
    tx.commit();
    return updated;
}

Json fairnessStats(Database& db) {
    return {{"human_review", db.one(R"(SELECT count(*) AS total,count(*) FILTER (WHERE (assessment->>'human_review')::boolean) AS review FROM credit_assessments)")},
            {"risk_bands", db.rows("SELECT coalesce(assessment->>'risk','unknown') AS risk,count(*) AS count FROM credit_assessments GROUP BY 1 ORDER BY 2 DESC")},
            {"decisions", db.rows("SELECT action,count(*) AS count FROM application_decisions GROUP BY action ORDER BY 2 DESC")},
            {"rejection_reasons", db.rows("SELECT coalesce(reason_code,'unspecified') AS reason,count(*) AS count FROM application_decisions WHERE action='reject' GROUP BY 1 ORDER BY 2 DESC")},
            {"policy", db.one("SELECT id,conventional_weights,alternative_weights,thresholds,note,created_at FROM scoring_policies ORDER BY id DESC LIMIT 1")},
            {"policy_history", db.rows("SELECT p.id,p.note,p.created_at,u.name AS author FROM scoring_policies p LEFT JOIN users u ON u.id=p.created_by ORDER BY p.id DESC LIMIT 20")}};
}
Json fairnessOverview(Database& db) {
    auto latest = db.rows("SELECT id,policy_id,consistent,result,created_at FROM fairness_runs ORDER BY id DESC LIMIT 1");
    return {{"latest", latest.empty() ? Json(nullptr) : latest.front()},
            {"history", db.rows("SELECT id,policy_id,consistent,created_at FROM fairness_runs ORDER BY id DESC LIMIT 20")},
            {"stats", fairnessStats(db)}};
}
Json runFairness(Database& db, const std::string& admin) {
    Transaction tx(db);
    auto policy = db.one("SELECT id,conventional_weights,alternative_weights,thresholds FROM scoring_policies ORDER BY id DESC LIMIT 1");
    std::vector<Json> products;
    for (auto& row : db.rows("SELECT * FROM loan_products ORDER BY display_order")) products.push_back(std::move(row));
    auto result = FairnessAuditor(policy, products).run();
    db.exec("INSERT INTO fairness_runs(admin_id,policy_id,consistent,result) VALUES($1,$2,$3,$4::jsonb)",
            {admin, policy.at("id").dump(), result.at("consistent").get<bool>() ? "true" : "false", result.dump()});
    identityAudit(db, admin, "", "fairness.run", {{"consistent", result.at("consistent")}});
    auto overview = fairnessOverview(db);
    tx.commit();
    return overview;
}
}

std::optional<Response> oversightRoutes(Database& db, const Request& req) {
    const auto& p = req.path;
    if (p.empty()) return std::nullopt;
    if (p == std::vector<std::string>{"safety", "scan"} && req.method == "POST")
        return Response{scan(db, idOf(authenticate(db, req, Permission::customerWorkspace)), req.body)};
    if (p == std::vector<std::string>{"distress"} && req.method == "GET")
        return Response{customerDistress(db, idOf(authenticate(db, req, Permission::customerWorkspace)))};
    if (p[0] != "admin" || p.size() < 2) return std::nullopt;
    if (p[1] == "distress") {
        const auto admin = idOf(authenticate(db, req, Permission::administration));
        if (p.size() == 2 && req.method == "GET") return Response{adminDistress(db)};
        if (p.size() == 3 && req.method == "POST") return Response{supportCase(db, admin, numeric(p[2]), req.body)};
    }
    if (p[1] == "fairness") {
        const auto admin = idOf(authenticate(db, req, Permission::administration));
        if (p.size() == 2 && req.method == "GET") return Response{fairnessOverview(db)};
        if (p.size() == 3 && p[2] == "run" && req.method == "POST") return Response{runFairness(db, admin), 201};
    }
    return std::nullopt;
}
}
