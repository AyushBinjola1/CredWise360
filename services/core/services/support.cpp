#include "services/support.hpp"
#include "services/engagement.hpp"
#include "services/origination.hpp"
#include "domain/dispute.hpp"
#include "security/accounts.hpp"
#include "security/synthetic_document.hpp"
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
std::string param(const Request& req, const char* key) {
    auto found = req.query.find(key);
    return found == req.query.end() ? "" : found->second;
}
Json ticket(Database& db, const std::string& id, const std::string& owner, bool lock = false) {
    return db.one(std::string(R"(SELECT d.*,u.name AS customer_name,u.email AS customer_email,a.name AS assignee_name
        FROM disputes d JOIN users u ON u.id=d.user_id LEFT JOIN users a ON a.id=d.assignee_id
        WHERE d.id=$1 AND ($2='' OR d.user_id=NULLIF($2,'')::bigint))") + (lock ? " FOR UPDATE OF d" : ""), {id, owner});
}
Json detail(Database& db, const std::string& id, const std::string& owner) {
    auto row = ticket(db, id, owner);
    Json application = nullptr;
    if (!row.at("application_id").is_null())
        application = db.one("SELECT a.id,a.status,a.tracking_id,a.principal,a.months,p.name AS product_name FROM loan_applications a JOIN loan_products p ON p.slug=a.product_slug WHERE a.id=$1",
                             {row.at("application_id").dump()});
    return {{"ticket", row}, {"application", application},
            {"messages", db.rows(R"(SELECT m.id,m.author_role,u.name AS author_name,m.kind,m.body,m.status,m.created_at,
                  m.document_id,d.name AS document_name FROM dispute_messages m JOIN users u ON u.id=m.author_id
                  LEFT JOIN synthetic_documents d ON d.id=m.document_id WHERE m.dispute_id=$1 ORDER BY m.id)", {id})}};
}
void post(Database& db, const Json& row, const std::string& author, const std::string& role, const std::string& body,
          const std::string& status, const std::string& documentId = "") {
    db.exec("INSERT INTO dispute_messages(dispute_id,author_id,author_role,kind,body,status,document_id) VALUES($1,$2,$3,'message',$4,$5,NULLIF($6,'')::bigint)",
            {idOf(row), author, role, body, status, documentId});
}
void setStatus(Database& db, Json& row, const std::string& next) {
    DisputeTicket(row.at("status")).checkTransition(next);
    const bool closing = next == "resolved" || next == "rejected" || next == "withdrawn";
    db.exec("UPDATE disputes SET status=$2,updated_at=now(),resolved_at=CASE WHEN $3::boolean THEN now() ELSE NULL END WHERE id=$1",
            {idOf(row), next, closing ? "true" : "false"});
    row["status"] = next;
}
std::string attach(Database& db, const Json& body, const std::string& owner) {
    if (!body.contains("document") || body.at("document").is_null()) return "";
    return idOf(storeSyntheticDocument(db, owner, body.at("document")));
}
Json list(Database& db, const Request& req, const std::string& owner) {
    const auto status = param(req, "status"), category = param(req, "category"), mine = param(req, "assigned");
    require(status.empty() || status == "open" || status == "in_review" || status == "awaiting_customer" || status == "resolved" || status == "rejected" || status == "withdrawn", "Choose a valid status.");
    require(category.empty() || DisputeTicket::validCategory(category), "Choose a valid category.");
    return {{"items", db.rows(R"(SELECT d.id,d.user_id,u.name AS customer_name,d.category,d.subject,d.status,d.assignee_id,a.name AS assignee_name,
            d.application_id,d.created_at,d.updated_at FROM disputes d JOIN users u ON u.id=d.user_id LEFT JOIN users a ON a.id=d.assignee_id
            WHERE ($1='' OR d.user_id=NULLIF($1,'')::bigint) AND ($2='' OR d.status=$2) AND ($3='' OR d.category=$3)
            ORDER BY (d.status IN ('open','in_review','awaiting_customer')) DESC,d.updated_at DESC LIMIT 200)", {owner, status, category})},
            {"counts", db.rows("SELECT status,count(*) AS count FROM disputes WHERE ($1='' OR user_id=NULLIF($1,'')::bigint) GROUP BY status", {owner})}};
}
Json create(Database& db, const std::string& uid, const Json& body) {
    const auto category = field(body, "category", 40), subject = field(body, "subject", 140), description = field(body, "description", 2000);
    require(DisputeTicket::validCategory(category), "Choose a valid category.");
    require(subject.size() >= 3 && description.size() >= 10, "Describe the issue in a little more detail.");
    std::string application, loan;
    if (body.contains("application_id") && !body.at("application_id").is_null()) {
        application = std::to_string(integer(body, "application_id", 1, INT64_MAX));
        auto row = db.rows("SELECT status FROM loan_applications WHERE id=$1 AND user_id=$2", {application, uid});
        if (row.empty()) throw Error(404, "not_found", "That application could not be found.");
        if (category == "application_reconsideration" && row.front().at("status") != "rejected")
            throw Error(409, "application_state", "Only a rejected application can be reconsidered.");
    } else require(category != "application_reconsideration", "Choose the rejected application to reconsider.");
    if (body.contains("loan_id") && !body.at("loan_id").is_null()) {
        loan = std::to_string(integer(body, "loan_id", 1, INT64_MAX));
        if (db.rows("SELECT id FROM loans WHERE id=$1 AND user_id=$2", {loan, uid}).empty()) throw Error(404, "not_found", "That loan could not be found.");
    }
    Transaction tx(db);
    db.one("SELECT id FROM users WHERE id=$1 FOR UPDATE", {uid});
    require(db.one("SELECT count(*) AS n FROM disputes WHERE user_id=$1 AND status IN ('open','in_review','awaiting_customer')", {uid}).at("n").get<int>() < 10,
            "Resolve some open tickets before raising more.");
    auto doc = attach(db, body, uid);
    auto created = db.one("INSERT INTO disputes(user_id,category,subject,description,application_id,loan_id) VALUES($1,$2,$3,$4,NULLIF($5,'')::bigint,NULLIF($6,'')::bigint) RETURNING id",
                          {uid, category, subject, description, application, loan});
    post(db, created, uid, "customer", description, "open", doc);
    identityAudit(db, uid, uid, "dispute.opened", {{"dispute_id", created.at("id")}, {"category", category}});
    auto result = detail(db, idOf(created), uid);
    tx.commit();
    return result;
}
Json customerAction(Database& db, const std::string& uid, const std::string& id, const std::string& action, const Json& body) {
    Transaction tx(db);
    auto row = ticket(db, id, uid, true);
    const auto status = row.at("status").get<std::string>();
    if (action == "messages") {
        if (DisputeTicket(status).closed()) throw Error(409, "ticket_state", "This ticket is closed. Reopen it to add more information.");
        auto doc = attach(db, body, uid);
        post(db, row, uid, "customer", field(body, "body", 2000), status, doc);
        if (status == "awaiting_customer") setStatus(db, row, "in_review");
    } else if (action == "reopen") {
        if (status == "withdrawn") throw Error(409, "ticket_state", "A withdrawn ticket cannot be reopened. Raise a new ticket.");
        setStatus(db, row, "open");
        post(db, row, uid, "customer", field(body, "body", 2000), "open", attach(db, body, uid));
    } else if (action == "withdraw") {
        setStatus(db, row, "withdrawn");
        post(db, row, uid, "customer", "The customer withdrew this ticket.", "withdrawn");
    } else throw Error(404, "not_found", "Unknown ticket action.");
    identityAudit(db, uid, uid, "dispute." + action, {{"dispute_id", row.at("id")}});
    auto result = detail(db, id, uid);
    tx.commit();
    return result;
}
Json respond(Database& db, const std::string& admin, const std::string& id, const Json& body) {
    const auto next = field(body, "status", 24), message = field(body, "body", 2000);
    require(next == "in_review" || next == "awaiting_customer" || next == "resolved" || next == "rejected", "Choose a status for this response.");
    const bool reconsider = body.value("reconsider", false);
    Transaction tx(db);
    auto row = ticket(db, id, "", true);
    const auto owner = row.at("user_id").dump();
    const bool closing = next == "resolved" || next == "rejected";
    if (reconsider) {
        require(row.at("category") == "application_reconsideration" && !row.at("application_id").is_null() && next == "resolved",
                "Reconsideration applies to a resolved reconsideration request.");
        reconsiderApplication(db, row.at("application_id").dump(), admin, "Reconsideration approved from support ticket " + id + ": " + message);
        db.exec("UPDATE disputes SET reconsidered=true WHERE id=$1", {id});
    }
    setStatus(db, row, next);
    db.exec("UPDATE disputes SET assignee_id=COALESCE(assignee_id,$2),resolution=CASE WHEN $3::boolean THEN $4 ELSE resolution END WHERE id=$1",
            {id, admin, closing ? "true" : "false", message});
    post(db, row, admin, "admin", message, next);
    identityAudit(db, admin, owner, "dispute." + next, {{"dispute_id", row.at("id")}, {"reconsidered", reconsider}});
    notify(db, owner, "support", closing ? "Your support ticket was " + next : "An update on your support ticket", message, "/app/disputes/" + id);
    auto result = detail(db, id, "");
    tx.commit();
    return result;
}
Json assign(Database& db, const std::string& admin, const std::string& id) {
    Transaction tx(db);
    auto row = ticket(db, id, "", true);
    if (DisputeTicket(row.at("status")).closed()) throw Error(409, "ticket_state", "Closed tickets cannot be assigned.");
    db.exec("UPDATE disputes SET assignee_id=$2,updated_at=now() WHERE id=$1", {id, admin});
    if (row.at("status") == "open") setStatus(db, row, "in_review");
    identityAudit(db, admin, row.at("user_id").dump(), "dispute.assigned", {{"dispute_id", row.at("id")}});
    auto result = detail(db, id, "");
    tx.commit();
    return result;
}
Json document(Database& db, const std::string& id, const std::string& owner, const std::string& docId) {
    return db.one(R"(SELECT d.name,d.mime,replace(encode(d.contents,'base64'),chr(10),'') AS content_base64
        FROM dispute_messages m JOIN disputes t ON t.id=m.dispute_id JOIN synthetic_documents d ON d.id=m.document_id
        WHERE m.dispute_id=$1 AND d.id=$2 AND ($3='' OR t.user_id=NULLIF($3,'')::bigint) LIMIT 1)", {id, docId, owner});
}
}

std::optional<Response> supportRoutes(Database& db, const Request& req) {
    const auto& p = req.path;
    if (p.empty()) return std::nullopt;
    const bool admin = p.size() >= 2 && p[0] == "admin" && p[1] == "disputes";
    if (!admin && p[0] != "disputes") return std::nullopt;
    const size_t base = admin ? 2 : 1;
    const auto actor = authenticate(db, req, admin ? Permission::administration : Permission::customerWorkspace);
    const auto actorId = idOf(actor), owner = admin ? std::string() : actorId;
    if (p.size() == base) {
        if (req.method == "GET") return Response{list(db, req, owner)};
        if (req.method == "POST" && !admin) return Response{create(db, actorId, req.body), 201};
        return std::nullopt;
    }
    const auto id = numeric(p[base]);
    if (req.method == "GET" && p.size() == base + 1) return Response{detail(db, id, owner)};
    if (req.method == "GET" && p.size() == base + 3 && p[base + 1] == "documents") return Response{document(db, id, owner, numeric(p[base + 2]))};
    if (req.method == "POST" && p.size() == base + 2) {
        if (admin && p[base + 1] == "respond") return Response{respond(db, actorId, id, req.body)};
        if (admin && p[base + 1] == "assign") return Response{assign(db, actorId, id)};
        if (!admin) return Response{customerAction(db, actorId, id, p[base + 1], req.body)};
    }
    return std::nullopt;
}
}
