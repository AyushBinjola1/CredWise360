#include "services/assessment.hpp"
#include "services/identity.hpp"
#include "engines/credit.hpp"
#include "security/accounts.hpp"

namespace cw {
namespace {
const char* policyFields = "id,conventional_weights,alternative_weights,thresholds,note,created_by,created_at";
Json currentPolicy(Database& db) {
    return db.one(std::string("SELECT ") + policyFields + " FROM scoring_policies ORDER BY id DESC LIMIT 1");
}
Json policies(Database& db) {
    return {{"policy",currentPolicy(db)},{"history",db.rows(std::string("SELECT ") + policyFields +
                                                 " FROM scoring_policies ORDER BY id DESC LIMIT 100")}};
}
int inquiryCount(Database& db, const std::string& userId, const Json& policy) {
    return db.one("SELECT count(*)::integer AS n FROM credit_inquiries WHERE user_id=$1 AND created_at > now()-($2::int*interval '1 day')",
                  {userId,policy.at("thresholds").at("inquiry_window_days").dump()}).at("n").get<int>();
}
Json compute(Database& db, const std::string& userId, const Json& profile) {
    auto policy = currentPolicy(db);
    return CreditScoreEngine(policy).evaluate(profile,inquiryCount(db,userId,policy));
}
void saveResult(Database& db, const std::string& id, const Json& result) {
    const std::string policy = result.at("policy_version").dump();
    db.exec(R"(
        INSERT INTO credit_assessments(user_id,policy_id,assessment) VALUES($1,$2,$3::jsonb)
        ON CONFLICT(user_id) DO UPDATE SET policy_id=excluded.policy_id,assessment=excluded.assessment,updated_at=now()
        WHERE credit_assessments.assessment IS DISTINCT FROM excluded.assessment)",{id,policy,result.dump()});
    auto last = db.rows("SELECT score FROM credit_score_history WHERE user_id=$1 ORDER BY id DESC LIMIT 1",{id});
    if (last.empty() || last.front().at("score") != result.at("score")) {
        db.exec("INSERT INTO credit_score_history(user_id,policy_id,score,strategy) VALUES($1,$2,NULLIF($3,'')::integer,$4)",
                {id,policy,result.at("score").is_null() ? "" : result.at("score").dump(),result.at("strategy").get<std::string>()});
    }
}
Json withHistory(Database& db, const std::string& id, Json result) {
    auto history = db.rows("SELECT id,score,strategy,created_at FROM (SELECT id,score,strategy,created_at FROM credit_score_history WHERE user_id=$1 ORDER BY id DESC LIMIT 36) h ORDER BY id",
                           {id});
    Json prior = nullptr;
    if (!history.empty()) {
        auto index = history.size()-1;
        if (history[index].at("score") != result.at("score")) prior = history[index].at("score");
        else if (index > 0) prior = history[index-1].at("score");
    }
    result["prior_score"] = prior;
    result["change"] = prior.is_number() && result.at("score").is_number()
        ? Json(result.at("score").get<int>() - prior.get<int>()) : Json(nullptr);
    result["history"] = std::move(history);
    return result;
}
Json policyConsistency(Database& db) {
    Json profile = {
        {"salary",6000000},{"essential",2300000},{"savings",900000},{"existing_emi",700000},
        {"debt",11000000},{"reserves",8000000},{"credit_months",30},{"on_time",20},
        {"missed",1},{"utilization",30},{"income_regularity",90}
    };
    Json equivalent = profile;
    profile.update(Json{{"gender","A"},{"ethnicity","B"},{"religion","C"},{"caste","D"}});
    equivalent.update(Json{{"gender","E"},{"ethnicity","F"},{"religion","G"},{"caste","H"}});
    CreditScoreEngine engine(currentPolicy(db));
    auto a = engine.evaluate(profile), b = engine.evaluate(equivalent);
    auto summary = [](const Json& row) -> Json {
        return {{"score",row.at("score")},{"risk",row.at("risk")},{"capacity",row.at("capacity")},{"reason_codes",row.at("reason_codes")}};
    };
    return {{"consistent",a == b},{"first",summary(a)},{"second",summary(b)},{"policy_version",a.at("policy_version")},
            {"excluded",{"gender","ethnicity","religion","caste"}}};
}
}

Json modelCredit(Database& db, const Json& fullProfile, int recent) {
    return CreditScoreEngine(currentPolicy(db)).evaluate(fullProfile,recent);
}
void recordProfileAssessment(Database& db, const std::string& userId, const Json& fullProfile) {
    db.one("SELECT user_id FROM financial_profiles WHERE user_id=$1 FOR UPDATE",{userId});
    saveResult(db,userId,compute(db,userId,fullProfile));
}
void recordCreditInquiry(Database& db, const std::string& userId, const std::string& applicationRef) {
    db.one("SELECT user_id FROM financial_profiles WHERE user_id=$1 FOR UPDATE",{userId});
    db.exec("INSERT INTO credit_inquiries(user_id,application_ref) VALUES($1,$2) ON CONFLICT DO NOTHING",{userId,applicationRef});
    saveResult(db,userId,compute(db,userId,getProfile(db,userId).at("profile")));
}
Json assess(Database& db, std::string userId, bool persist) {
    if (!persist) return withHistory(db,userId,compute(db,userId,getProfile(db,userId).at("profile")));
    Transaction tx(db);
    db.one("SELECT user_id FROM financial_profiles WHERE user_id=$1 FOR UPDATE",{userId});
    auto result = compute(db,userId,getProfile(db,userId).at("profile"));
    saveResult(db,userId,result);
    auto response = withHistory(db,userId,std::move(result));
    tx.commit();
    return response;
}

std::optional<Response> assessmentRoutes(Database& db, const Request& req) {
    if (req.path == std::vector<std::string>{"credit"} && req.method == "GET") {
        const auto user = authenticate(db,req,Permission::customerWorkspace);
        return Response{assess(db,user.at("id").dump())};
    }
    if (req.path == std::vector<std::string>{"admin","policy","consistency"} && req.method == "GET") {
        currentUser(db,req,true);
        return Response{policyConsistency(db)};
    }
    if (req.path != std::vector<std::string>{"admin","policy"} || (req.method != "GET" && req.method != "PUT"))
        return std::nullopt;
    auto admin = currentUser(db,req,true);
    if (req.method == "GET") return Response{policies(db)};
    const auto note = field(req.body,"note",400);
    Transaction tx(db);
    db.exec("SELECT pg_advisory_xact_lock(36804362)");
    auto policy = currentPolicy(db);
    if (req.body.contains("base_version") && req.body.at("base_version") != policy.at("id"))
        throw Error(409,"policy_changed","Reload the current policy before saving.");
    bool changed = false;
    for (const auto& [name,values] : req.body.items()) {
        if (name == "note" || name == "base_version") continue;
        require(name == "conventional_weights" || name == "alternative_weights" || name == "thresholds","Unknown policy setting.");
        require(values.is_object(),"Send numeric values for the selected policy fields.");
        for (const auto& [key,value] : values.items()) {
            require(policy.at(name).contains(key),"Unknown scoring policy field.");
            changed = changed || policy[name][key] != value;
            policy[name][key] = value;
        }
    }
    require(changed,"Change a policy field before saving.");
    validateCreditPolicy(policy);
    db.exec(R"(
        INSERT INTO scoring_policies(conventional_weights,alternative_weights,thresholds,note,created_by)
        VALUES($1::jsonb,$2::jsonb,$3::jsonb,$4,$5))",
        {policy["conventional_weights"].dump(),policy["alternative_weights"].dump(),policy["thresholds"].dump(),
         note,admin.at("id").dump()});
    identityAudit(db,admin.at("id").dump(),"","credit.policy_updated",{{"note",note}});
    auto data = policies(db);
    tx.commit();
    return Response{data};
}
}
