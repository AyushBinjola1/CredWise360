#include "services/identity.hpp"
#include "services/servicing.hpp"
#include "services/assessment.hpp"
#include "domain/profile.hpp"
#include "security/accounts.hpp"
#include "security/credentials.hpp"
#include "security/synthetic_document.hpp"
#include <charconv>
#include <regex>

namespace cw {
namespace {
const char* metadataSql = R"(
    SELECT (to_jsonb(p)-'user_id'-'created_at'-'updated_at') ||
           COALESCE((SELECT jsonb_object_agg(kind,amount) FROM financial_entries e
                     WHERE e.user_id=p.user_id),'{}'::jsonb) AS fields
    FROM financial_profiles p WHERE p.user_id=$1)";
const char* kycColumns = R"(
    SELECT k.id,k.user_id,k.legal_name,k.address,k.employment,k.pan,k.status,k.reason,
           k.created_at,k.updated_at,u.name,u.email,
           jsonb_build_object('id',d.id,'name',d.name,'mime',d.mime,'size',octet_length(d.contents),'sha256',d.sha256) AS document
    FROM kyc_records k JOIN users u ON u.id=k.user_id
    JOIN synthetic_documents d ON d.id=k.document_id )";

std::string idOf(const Json& record) { return record.at("id").dump(); }
FinancialProfile loadProfile(Database& db, const std::string& id) {
    return FinancialProfile().adjusted(db.one(metadataSql, {id}).at("fields"));
}
Json saveProfile(Database& db, const std::string& id, const Json& changes) {
    db.one("SELECT user_id FROM financial_profiles WHERE user_id=$1 FOR UPDATE", {id});
    const auto profile = loadProfile(db,id).adjusted(changes);
    const auto& values = profile.values();
    db.exec(R"(
        UPDATE financial_profiles f SET employment=p.employment,stability_months=p.stability_months,
              credit_months=p.credit_months,utilization=p.utilization,on_time=p.on_time,missed=p.missed,
              income_regularity=p.income_regularity,rent=p.rent,utilities=p.utilities,consent=p.consent,
              savings_reported=p.savings_reported,emi_reported=p.emi_reported,
              goal=p.goal,goal_amount=p.goal_amount,updated_at=now()
        FROM jsonb_populate_record(NULL::financial_profiles,$2::jsonb) p WHERE f.user_id=$1)", {id,values.dump()});
    Json money = Json::object();
    for (const auto& key : FinancialProfile::moneyFields()) money[key] = values.at(key);
    db.exec(R"(
        INSERT INTO financial_entries(user_id,kind,amount)
        SELECT $1, key, value::bigint FROM jsonb_each_text($2::jsonb)
        ON CONFLICT(user_id,kind) DO UPDATE SET amount=excluded.amount,updated_at=now())", {id,money.dump()});
    auto portfolio = portfolioCommitments(db,id);
    auto combined = profile.withPortfolio(portfolio);
    auto metrics = combined.metrics();
    db.exec("INSERT INTO financial_snapshots(user_id,profile,metrics) VALUES($1,$2::jsonb,$3::jsonb)",
            {id,values.dump(),metrics.dump()});
    recordProfileAssessment(db,id,values);
    identityAudit(db,id,id,"profile.updated");
    return {{"profile",values},{"metrics",metrics},{"effective_profile",combined.values()},{"portfolio",portfolio}};
}

Json findKyc(Database& db, const std::string& id) {
    auto records = db.rows(std::string(kycColumns) + " WHERE k.user_id=$1", {id});
    return records.empty() ? Json(nullptr) : records.front();
}
Json documentContents(Database& db, const std::string& id) {
    return db.one(R"(
        SELECT d.name,d.mime,replace(encode(d.contents,'base64'),chr(10),'') AS content_base64
        FROM kyc_records k JOIN synthetic_documents d ON d.id=k.document_id WHERE k.user_id=$1)", {id});
}
Json submitKyc(Database& db, const std::string& id, const Json& body) {
    auto legalName = field(body,"legal_name",100), address = field(body,"address",400);
    auto employment = field(body,"employment",80), pan = field(body,"pan",10);
    static const std::regex syntheticPan("^DEMO[A-Z][0-9]{4}[A-Z]$");
    require(std::regex_match(pan,syntheticPan),"Enter a synthetic PAN such as DEMOX1234Q.");
    require(body.contains("document") && body.at("document").is_object(), "Attach a synthetic proof document.");
    db.one("SELECT id FROM users WHERE id=$1 FOR UPDATE",{id});
    auto existing = db.rows("SELECT status FROM kyc_records WHERE user_id=$1",{id});
    if (!existing.empty() && existing.front().at("status") != "rejected")
        throw Error(409,"kyc_state","A new submission is available after a reviewer requests a correction.");
    auto inserted = storeSyntheticDocument(db,id,body.at("document"));
    auto record = db.one(R"(
        INSERT INTO kyc_records(user_id,legal_name,address,employment,pan,document_id,status)
        VALUES($1,$2,$3,$4,$5,$6,'pending')
        ON CONFLICT(user_id) DO UPDATE SET legal_name=excluded.legal_name,address=excluded.address,
             employment=excluded.employment,pan=excluded.pan,document_id=excluded.document_id,
             status='pending',reason='',reviewer_id=NULL,updated_at=now() RETURNING id)",
             {id,legalName,address,employment,pan,idOf(inserted)});
    db.exec("INSERT INTO kyc_history(kyc_id,document_id,actor_id,status) VALUES($1,$2,$3,'pending')",
            {idOf(record),idOf(inserted),id});
    identityAudit(db,id,id,"kyc.submitted");
    return findKyc(db,id);
}
Json reviewKyc(Database& db, const std::string& actor, const std::string& id, const Json& body) {
    auto status = field(body,"status",16);
    require(status == "verified" || status == "rejected","Choose verified or rejected.");
    auto reason = field(body,"reason",600,status == "verified");
    auto record = db.one("SELECT id,document_id,status FROM kyc_records WHERE user_id=$1 FOR UPDATE",{id});
    if (record.at("status") != "pending") throw Error(409,"kyc_state","This submission has already received a decision.");
    db.exec("UPDATE kyc_records SET status=$2,reason=$3,reviewer_id=$4,updated_at=now() WHERE user_id=$1",
            {id,status,reason,actor});
    db.exec("INSERT INTO kyc_history(kyc_id,document_id,actor_id,status,reason) VALUES($1,$2,$3,$4,$5)",
            {idOf(record),record.at("document_id").dump(),actor,status,reason});
    identityAudit(db,actor,id,"kyc." + status,{{"reason",reason}});
    return findKyc(db,id);
}

std::int64_t number(const std::string& value, std::int64_t max, const std::string& label) {
    std::int64_t output = 0;
    auto [end,error] = std::from_chars(value.data(),value.data() + value.size(),output);
    require(error == std::errc() && end == value.data() + value.size() && output >= 1 && output <= max,
            "Enter a valid " + label + ".");
    return output;
}
std::string query(const Request& req, const std::string& field, const std::string& fallback = "") {
    auto found = req.query.find(field);
    return found == req.query.end() ? fallback : found->second;
}
Json listRecords(Database& db, const Request& req, bool kyc) {
    auto page = number(query(req,"page","1"),1000000,"page");
    auto size = number(query(req,"page_size","25"),100,"page size");
    std::string fields, filter, order, search;
    if (kyc) {
        search = query(req,"status");
        require(search.empty() || search == "pending" || search == "verified" || search == "rejected","Choose a KYC status.");
        fields = kycColumns;
        filter = " WHERE ($1='' OR k.status=$1)";
        order = " ORDER BY (k.status='pending') DESC,k.updated_at,k.id";
    } else {
        search = query(req,"q");
        require(search.size() <= 120 && search.find('\0') == std::string::npos,"Shorten the search.");
        fields = R"(SELECT u.id,u.name,u.email,u.role,u.active,u.created_at,
                    COALESCE(k.status,'not_started') AS kyc_status
                    FROM users u LEFT JOIN kyc_records k ON k.user_id=u.id)";
        filter = " WHERE u.role='customer' AND (strpos(lower(u.name),lower($1))>0 OR strpos(lower(u.email),lower($1))>0)";
        order = " ORDER BY u.created_at DESC,u.id DESC";
    }
    const auto total = db.one("SELECT count(*) AS total FROM (" + fields + filter + ") AS filtered",{search}).at("total");
    auto rows = db.rows(fields + filter + order + " LIMIT $2 OFFSET $3",
                        {search,std::to_string(size),std::to_string((page - 1) * size)});
    return {{"items",rows},{"total",total},{"page",page},{"page_size",size}};
}
}

Json currentUser(Database& db, const Request& req, bool admin) {
    return authenticate(db,req,admin ? Permission::administration : Permission::ownAccount);
}
Json getProfile(Database& db, std::string userId) {
    auto profile = loadProfile(db,userId);
    auto portfolio = portfolioCommitments(db,userId);
    auto combined = profile.withPortfolio(portfolio);
    return {{"profile",profile.values()},{"metrics",combined.metrics()},{"effective_profile",combined.values()},{"portfolio",portfolio}};
}
void seedIdentity(Database& db) {
    if (setting("DEMO_MODE") != "1") return;
    Transaction tx(db);
    db.exec("SELECT pg_advisory_xact_lock(36804361)");
    auto admin = db.rows("SELECT id FROM users WHERE email='admin@credwise.test'");
    std::string adminId = admin.empty()
        ? idOf(createAccount(db,"admin@credwise.test","Ayush Binjola","CredWiseDemo!360","admin",security::token(16)))
        : idOf(admin.front());
    if (db.rows("SELECT id FROM users WHERE email='borrower@credwise.test'").empty()) {
        auto borrower = createAccount(db,"borrower@credwise.test","Ayush","CredWiseDemo!360","customer",security::token(16));
        const auto id = idOf(borrower);
        saveProfile(db,id,{
            {"salary",7800000},{"business_income",0},{"other_income",450000},{"essential",2560000},
            {"discretionary",940000},{"savings",1250000},{"existing_emi",680000},{"debt",14800000},
            {"assets",29000000},{"liabilities",850000},{"reserves",11200000},{"employment","Salaried professional"},
            {"stability_months",36},{"credit_months",42},{"utilization",26},{"on_time",32},{"missed",0},
            {"income_regularity",96},{"rent",100},{"utilities",97},{"consent",true},{"goal","Build six months of reserves"},
            {"goal_amount",19440000}
        });
        submitKyc(db,id,{{"legal_name","Ayush"},{"address","Demo House 12, Example Lane, Pune"},
                        {"employment","Salaried professional"},{"pan","DEMOX4321A"},
                        {"document",{{"name","synthetic-proof.txt"},{"mime","text/plain"},{"content_base64","Q1JFRFdJU0UtU1lOVEhFVElD"}}}});
        reviewKyc(db,adminId,id,{{"status","verified"},{"reason","Reviewed the supplied synthetic demonstration document."}});
    }
    tx.commit();
}

std::optional<Response> identityRoutes(Database& db, const Request& req) {
    if (auto auth = authRoutes(db,req)) return auth;
    if (req.path == std::vector<std::string>{"settings"} && (req.method == "GET" || req.method == "PUT"))
        return settingsRoute(db,req);
    if (req.path == std::vector<std::string>{"profile"} && (req.method == "GET" || req.method == "PUT")) {
        const auto id = idOf(authenticate(db,req,Permission::customerWorkspace));
        if (req.method == "GET") return Response{getProfile(db,id)};
        require(!req.body.empty(),"Choose a financial profile field to update.");
        Transaction tx(db);
        auto result = saveProfile(db,id,req.body);
        tx.commit();
        return Response{result};
    }
    if (!req.path.empty() && req.path.front() == "kyc") {
        auto id = idOf(authenticate(db,req,Permission::customerWorkspace));
        if (req.path.size() == 1 && req.method == "GET") return Response{{{"kyc",findKyc(db,id)}}};
        if (req.path.size() == 2 && req.path[1] == "document" && req.method == "GET") return Response{documentContents(db,id)};
        if (req.path.size() == 1 && req.method == "POST") {
            Transaction tx(db);
            auto record = submitKyc(db,id,req.body);
            tx.commit();
            return Response{{{"kyc",record}},201};
        }
    }
    if (req.path.size() < 2 || req.path.front() != "admin" || (req.path[1] != "users" && req.path[1] != "kyc"))
        return std::nullopt;
    auto actor = idOf(currentUser(db,req,true));
    const bool kyc = req.path[1] == "kyc";
    if (req.method == "GET" && req.path.size() == 2) return Response{listRecords(db,req,kyc)};
    if (req.path.size() < 3) return std::nullopt;
    const auto id = std::to_string(number(req.path[2],INT64_MAX,"customer ID"));
    if (kyc && req.method == "GET" && req.path.size() == 4 && req.path[3] == "document")
        return Response{documentContents(db,id)};
    if (req.method != "POST" || req.path.size() != 3) return std::nullopt;
    Transaction tx(db);
    if (kyc) {
        auto record = reviewKyc(db,actor,id,req.body);
        tx.commit();
        return Response{{{"kyc",record}}};
    }
    require(req.body.contains("active") && req.body.at("active").is_boolean(),"Choose an account status.");
    auto target = db.one("SELECT role,email FROM users WHERE id=$1 FOR UPDATE",{id});
    blockSharedDemoChange(target,"the demonstration accounts available");
    if (target.at("role") != "customer") throw Error(403,"forbidden","Only customer accounts can be managed here.");
    bool active = req.body.at("active");
    auto user = db.one("UPDATE users SET active=$2,updated_at=now() WHERE id=$1 RETURNING id,name,email,role,active,created_at",
                       {id,active ? "true" : "false"});
    if (!active) db.exec("DELETE FROM sessions WHERE user_id=$1",{id});
    identityAudit(db,actor,id,active ? "account.activated" : "account.deactivated");
    tx.commit();
    return Response{{{"user",user}}};
}
}
