#include "services/engagement.hpp"
#include "security/accounts.hpp"
#include <charconv>

namespace cw {
namespace {
const char* today = "(now() AT TIME ZONE 'Asia/Kolkata')::date";

std::string numeric(const std::string& value) {
    std::int64_t id = 0;
    auto [end, error] = std::from_chars(value.data(), value.data() + value.size(), id);
    require(error == std::errc() && end == value.data() + value.size() && id > 0, "Enter a valid record number.");
    return std::to_string(id);
}

// Upcoming and overdue instalments become reminders. The dedupe key keeps each event to one notification.
void syncReminders(Database& db, const std::string& uid) {
    db.exec(std::string(R"(
        INSERT INTO notifications(user_id,kind,title,body,link,dedupe_key)
        SELECT l.user_id,
               CASE WHEN s.due_date<t.today THEN 'overdue' ELSE 'reminder' END,
               CASE WHEN s.due_date<t.today THEN 'Payment overdue' ELSE 'Payment due soon' END,
               'Loan '||l.id||': instalment '||s.month||' of INR '||to_char((s.principal+s.interest-s.principal_paid-s.interest_paid)/100.0,'FM999,999,999,990.00')||
               ' is due on '||to_char(s.due_date,'DD Mon YYYY')||'.',
               '/app/loans/'||l.id,
               CASE WHEN s.due_date<t.today THEN 'overdue' ELSE 'due' END||':'||l.id||':'||s.month
        FROM loans l
        CROSS JOIN (SELECT )") + today + R"( AS today) t
        CROSS JOIN LATERAL (SELECT * FROM repayment_schedules r WHERE r.loan_id=l.id AND r.active AND r.paid_on IS NULL
                            ORDER BY r.month LIMIT 1) s
        WHERE l.user_id=$1 AND l.status='active' AND s.due_date<=t.today+7
        ON CONFLICT (user_id,dedupe_key) DO NOTHING)", {uid});
}

Json notifications(Database& db, const std::string& uid) {
    syncReminders(db, uid);
    return {{"items", db.rows("SELECT id,kind,title,body,link,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 100", {uid})},
            {"unread", db.one("SELECT count(*) AS n FROM notifications WHERE user_id=$1 AND read_at IS NULL", {uid}).at("n")}};
}

// Rule-based screening of synthetic activity. Existing cases keep their review status.
void scanFraud(Database& db) {
    db.exec(R"(
        INSERT INTO fraud_cases(user_id,rule,subject,severity,evidence)
        SELECT k.user_id,'shared_synthetic_identity',k.pan,'high',
               'Synthetic PAN '||k.pan||' is used by more than one simulated account.'
        FROM kyc_records k WHERE k.pan IN (SELECT pan FROM kyc_records GROUP BY pan HAVING count(*)>1)
        ON CONFLICT DO NOTHING)");
    db.exec(R"(
        INSERT INTO fraud_cases(user_id,rule,subject,severity,evidence)
        SELECT user_id,'repeated_submissions',day,'review',n||' applications were submitted within one hour.'
        FROM (SELECT a.user_id,to_char(a.submitted_at,'YYYY-MM-DD') AS day,max(c.n) AS n FROM loan_applications a
              CROSS JOIN LATERAL (SELECT count(*) AS n FROM loan_applications b WHERE b.user_id=a.user_id
                   AND b.submitted_at BETWEEN a.submitted_at AND a.submitted_at+interval '1 hour') c
              WHERE a.submitted_at IS NOT NULL GROUP BY a.user_id,to_char(a.submitted_at,'YYYY-MM-DD')) x
        WHERE n>=3 ON CONFLICT DO NOTHING)");
    db.exec(R"(
        INSERT INTO fraud_cases(user_id,rule,subject,severity,evidence)
        SELECT a.user_id,'amount_exceeds_income',a.id::text,'review',
               'Application '||a.id||' requests more than 36 months of reported income.'
        FROM loan_applications a
        CROSS JOIN LATERAL (SELECT coalesce(sum(amount),0) AS income FROM financial_entries
                            WHERE user_id=a.user_id AND kind IN ('salary','business_income','other_income')) i
        WHERE a.status NOT IN ('draft','withdrawn') AND a.principal>36*i.income
        ON CONFLICT DO NOTHING)");
    db.exec(R"(
        INSERT INTO fraud_cases(user_id,rule,subject,severity,evidence)
        SELECT t.user_id,'early_foreclosure',t.loan_id::text,'review',
               'Loan '||t.loan_id||' was fully settled within 30 days of disbursement.'
        FROM repayment_transactions t JOIN loans l ON l.id=t.loan_id
        WHERE t.kind='foreclosure' AND t.payment_date<=l.opened_on+30
        ON CONFLICT DO NOTHING)");
}
Json fraudList(Database& db, const Request& req) {
    scanFraud(db);
    auto it = req.query.find("status");
    const std::string status = it == req.query.end() ? "" : it->second;
    require(status.empty() || status == "open" || status == "investigating" || status == "cleared" || status == "confirmed", "Choose a valid case status.");
    return {{"items", db.rows(R"(SELECT f.id,f.user_id,u.name AS user_name,u.email,f.rule,f.subject,f.severity,f.evidence,f.status,f.note,f.created_at,f.updated_at
        FROM fraud_cases f JOIN users u ON u.id=f.user_id WHERE $1='' OR f.status=$1
        ORDER BY (f.status IN ('open','investigating')) DESC,(f.severity='high') DESC,f.id DESC LIMIT 200)", {status})}};
}
Json fraudDecision(Database& db, const std::string& admin, const std::string& id, const Json& body) {
    const auto status = field(body, "status", 16);
    require(status == "open" || status == "investigating" || status == "cleared" || status == "confirmed", "Choose a valid case status.");
    const auto note = field(body, "note", 600, status == "open" || status == "investigating");
    Transaction tx(db);
    auto row = db.one("SELECT user_id FROM fraud_cases WHERE id=$1 FOR UPDATE", {id});
    auto updated = db.one("UPDATE fraud_cases SET status=$2,note=$3,reviewer_id=$4,updated_at=now() WHERE id=$1 RETURNING id,status,note,updated_at",
                          {id, status, note, admin});
    identityAudit(db, admin, row.at("user_id").dump(), "fraud." + status, {{"case_id", updated.at("id")}, {"note", note}});
    tx.commit();
    return updated;
}

// Administrator audit trail: who did what, to whom and when. Filters are bound as parameters, never concatenated.
Json auditTrail(Database& db, const Request& req) {
    auto param = [&](const char* key) { auto it = req.query.find(key); return it == req.query.end() ? std::string() : it->second; };
    const auto action = param("action"), search = param("q");
    require(action.size() <= 60 && search.size() <= 100, "Shorten the audit filters.");
    std::int64_t page = 1;
    if (!param("page").empty()) page = std::stoll(numeric(param("page")));
    require(page <= 100000, "Choose a supported page.");
    const std::string source = R"( FROM identity_audit a LEFT JOIN users actor ON actor.id=a.actor_id LEFT JOIN users subject ON subject.id=a.subject_id
        WHERE ($1='' OR a.action LIKE $1||'%') AND ($2='' OR strpos(lower(concat_ws(' ',a.action,actor.name,subject.name,a.detail::text)),lower($2))>0))";
    const auto total = db.one("SELECT count(*) AS n" + source, {action, search}).at("n");
    auto items = db.rows(R"(SELECT a.id,a.action,a.created_at,actor.name AS actor_name,actor.email AS actor_email,subject.name AS subject_name,a.detail)" + source +
                         " ORDER BY a.id DESC LIMIT 50 OFFSET $3", {action, search, std::to_string((page - 1) * 50)});
    return {{"items", items}, {"total", total}, {"page", page}, {"page_size", 50}};
}

Json portfolio(Database& db) {
    auto totals = db.one(std::string(R"(SELECT
        (SELECT count(*) FROM users WHERE role='customer') AS customers,
        (SELECT count(*) FROM kyc_records WHERE status='pending') AS kyc_pending,
        (SELECT count(*) FROM loan_applications WHERE status IN ('submitted','under_review')) AS queue,
        (SELECT count(*) FROM loan_applications WHERE status<>'draft') AS submitted_total,
        (SELECT count(*) FROM loan_applications WHERE status IN ('approved','accepted','disbursed','active','closed','defaulted')) AS approved_total,
        (SELECT count(*) FROM loan_applications WHERE status='rejected') AS rejected_total,
        (SELECT count(*) FROM loans) AS loans_total,
        (SELECT count(*) FROM loans WHERE status='active') AS loans_active,
        (SELECT count(*) FROM loans WHERE status='defaulted') AS loans_defaulted,
        (SELECT count(*) FROM loans WHERE status='closed') AS loans_closed,
        (SELECT coalesce(sum(principal),0) FROM loans) AS disbursed,
        (SELECT coalesce(sum(outstanding),0) FROM loans WHERE status IN ('active','defaulted')) AS outstanding,
        (SELECT coalesce(sum(amount),0) FROM repayment_transactions WHERE kind<>'disbursement') AS collected,
        (SELECT coalesce(sum(interest),0) FROM repayment_transactions WHERE kind<>'disbursement') AS interest_collected,
        (SELECT coalesce(sum(fee+penalty),0) FROM repayment_transactions WHERE kind<>'disbursement') AS fees_collected,
        (SELECT count(DISTINCT s.loan_id) FROM repayment_schedules s JOIN loans l ON l.id=s.loan_id
           WHERE s.active AND s.paid_on IS NULL AND l.status='active' AND s.due_date<)") + today + R"() AS overdue_loans,
        (SELECT count(*) FROM fraud_cases WHERE status IN ('open','investigating')) AS fraud_open,
        (SELECT count(*) FROM disputes WHERE status IN ('open','in_review','awaiting_customer')) AS disputes_open,
        (SELECT count(*) FROM distress_cases WHERE level IN ('elevated','high') AND outreach IN ('none','contacted')) AS distress_open)");
    return {{"totals", totals},
            {"by_status", db.rows("SELECT status,count(*) AS count FROM loan_applications GROUP BY status ORDER BY count DESC")},
            {"by_product", db.rows(R"(SELECT p.name,count(a.id) AS applications,
                 count(a.id) FILTER (WHERE a.status IN ('approved','accepted','disbursed','active','closed','defaulted')) AS approved,
                 coalesce(sum(l.principal),0) AS disbursed FROM loan_products p
                 LEFT JOIN loan_applications a ON a.product_slug=p.slug AND a.status<>'draft'
                 LEFT JOIN loans l ON l.application_id=a.id GROUP BY p.slug,p.name,p.display_order ORDER BY p.display_order)")},
            {"risk_bands", db.rows("SELECT coalesce(assessment->>'risk','unknown') AS risk,count(*) AS count FROM credit_assessments GROUP BY 1 ORDER BY 2 DESC")},
            {"collections", db.rows(R"(SELECT to_char(payment_date,'YYYY-MM') AS month,sum(amount) AS amount,count(*) AS payments
                 FROM repayment_transactions WHERE kind<>'disbursement' GROUP BY 1 ORDER BY 1 DESC LIMIT 12)")}};
}

Json customerReport(Database& db, const std::string& uid) {
    return {{"loans", db.rows(R"(SELECT l.id,l.product_terms->>'name' AS product,l.principal,l.outstanding,l.emi,l.status,l.opened_on,l.closed_on,
                coalesce((SELECT sum(interest) FROM repayment_transactions t WHERE t.loan_id=l.id),0) AS interest_paid,
                coalesce((SELECT sum(amount) FROM repayment_transactions t WHERE t.loan_id=l.id AND t.kind<>'disbursement'),0) AS paid
                FROM loans l WHERE l.user_id=$1 ORDER BY l.id)", {uid})},
            {"applications", db.rows("SELECT status,count(*) AS count FROM loan_applications WHERE user_id=$1 GROUP BY status", {uid})},
            {"payments", db.rows(R"(SELECT 'CW-T-'||id AS reference,loan_id,kind,amount,principal,interest,fee,penalty,payment_date
                FROM repayment_transactions WHERE user_id=$1 ORDER BY payment_date DESC,id DESC LIMIT 200)", {uid})},
            {"score_history", db.rows("SELECT score,strategy,created_at FROM credit_score_history WHERE user_id=$1 ORDER BY id DESC LIMIT 24", {uid})}};
}
Json customerDashboard(Database& db, const std::string& uid) {
    // Reminders are generated here too, so the notification badge reflects upcoming and overdue instalments.
    Transaction tx(db);
    syncReminders(db, uid);
    auto next = db.rows(std::string(R"(SELECT l.id AS loan_id,s.due_date,s.principal+s.interest-s.principal_paid-s.interest_paid AS amount,
        s.due_date<)") + today + R"( AS overdue FROM loans l
        CROSS JOIN LATERAL (SELECT * FROM repayment_schedules r WHERE r.loan_id=l.id AND r.active AND r.paid_on IS NULL ORDER BY r.month LIMIT 1) s
        WHERE l.user_id=$1 AND l.status='active' ORDER BY s.due_date LIMIT 1)", {uid});
    auto kyc = db.rows("SELECT status FROM kyc_records WHERE user_id=$1", {uid});
    Json result = {{"applications", db.rows("SELECT status,count(*) AS count FROM loan_applications WHERE user_id=$1 GROUP BY status", {uid})},
            {"loans", db.one(R"(SELECT count(*) FILTER (WHERE status='active') AS active,
                coalesce(sum(outstanding) FILTER (WHERE status IN ('active','defaulted')),0) AS outstanding,
                coalesce(sum(principal) FILTER (WHERE status IN ('active','defaulted')),0) AS principal FROM loans WHERE user_id=$1)", {uid})},
            {"next_payment", next.empty() ? Json(nullptr) : next.front()},
            {"kyc_status", kyc.empty() ? Json(nullptr) : kyc.front().at("status")},
            {"unread", db.one("SELECT count(*) AS n FROM notifications WHERE user_id=$1 AND read_at IS NULL", {uid}).at("n")},
            {"alerts", db.rows("SELECT id,kind,title,body,link,created_at FROM notifications WHERE user_id=$1 AND read_at IS NULL ORDER BY id DESC LIMIT 3", {uid})},
            {"transactions", db.rows(R"(SELECT id,'CW-T-'||id AS reference,loan_id,kind,amount,payment_date FROM repayment_transactions
                WHERE user_id=$1 ORDER BY payment_date DESC,id DESC LIMIT 5)", {uid})},
            {"recent", db.rows(R"(SELECT e.id,e.application_id,e.status,e.action,e.note,e.created_at FROM application_events e
                JOIN loan_applications a ON a.id=e.application_id WHERE a.user_id=$1 AND e.action NOT IN ('draft_created','draft_saved','review_started')
                ORDER BY e.id DESC LIMIT 5)", {uid})}};
    tx.commit();
    return result;
}
}

void notify(Database& db, const std::string& uid, const std::string& kind, const std::string& title,
            const std::string& body, const std::string& link, const std::string& dedupe) {
    db.exec(R"(INSERT INTO notifications(user_id,kind,title,body,link,dedupe_key)
        VALUES($1,$2,$3,$4,$5,COALESCE(NULLIF($6,''),gen_random_uuid()::text)) ON CONFLICT (user_id,dedupe_key) DO NOTHING)",
            {uid, kind, title, body, link, dedupe});
}

Json portfolioSummary(Database& db) { return portfolio(db); }

std::optional<Response> engagementRoutes(Database& db, const Request& req) {
    if (req.path.empty()) return std::nullopt;
    const auto& p = req.path;
    if (p[0] == "admin" && p.size() == 2 && p[1] == "audit" && req.method == "GET") {
        authenticate(db, req, Permission::administration);
        return Response{auditTrail(db, req)};
    }
    if (p[0] == "admin" && p.size() >= 2 && (p[1] == "fraud" || p[1] == "reports" || p[1] == "overview")) {
        const auto admin = authenticate(db, req, Permission::administration).at("id").dump();
        if (p.size() == 2 && req.method == "GET") {
            if (p[1] == "fraud") {
                Transaction tx(db);
                auto result = fraudList(db, req);
                tx.commit();
                return Response{result};
            }
            return Response{portfolio(db)};
        }
        if (p[1] == "fraud" && p.size() == 3 && req.method == "POST") return Response{fraudDecision(db, admin, numeric(p[2]), req.body)};
        return std::nullopt;
    }
    if (p.size() == 1 && req.method == "GET" && (p[0] == "notifications" || p[0] == "reports" || p[0] == "dashboard")) {
        const auto uid = authenticate(db, req, Permission::customerWorkspace).at("id").dump();
        if (p[0] == "reports") return Response{customerReport(db, uid)};
        if (p[0] == "dashboard") return Response{customerDashboard(db, uid)};
        Transaction tx(db);
        auto result = notifications(db, uid);
        tx.commit();
        return Response{result};
    }
    if (p.size() == 2 && p[0] == "notifications" && p[1] == "read" && req.method == "POST") {
        const auto uid = authenticate(db, req, Permission::customerWorkspace).at("id").dump();
        if (req.body.contains("id")) db.exec("UPDATE notifications SET read_at=now() WHERE user_id=$1 AND id=$2 AND read_at IS NULL", {uid, std::to_string(integer(req.body, "id", 1, INT64_MAX))});
        else db.exec("UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL", {uid});
        return Response{{{"ok", true}}};
    }
    return std::nullopt;
}
}
