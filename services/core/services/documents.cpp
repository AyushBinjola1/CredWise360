#include "services/documents.hpp"
#include "services/assessment.hpp"
#include "services/engagement.hpp"
#include "services/identity.hpp"
#include "engines/pdf.hpp"
#include "security/accounts.hpp"
#include <charconv>
#include <iomanip>
#include <sstream>

namespace cw {
namespace {
using KeyValues = std::vector<std::pair<std::string, std::string>>;
std::string idOf(const Json& row) { return row.at("id").dump(); }
std::string numeric(const std::string& value) {
    std::int64_t id = 0;
    auto [end, error] = std::from_chars(value.data(), value.data() + value.size(), id);
    require(error == std::errc() && end == value.data() + value.size() && id > 0, "Enter a valid record number.");
    return std::to_string(id);
}
std::string inr(const Json& v) { return v.is_number() ? PdfDocument::inr(v.get<Money>()) : "Not available"; }
std::string text(const Json& v) { return v.is_string() ? v.get<std::string>() : v.is_null() ? "Not available" : v.dump(); }
std::string percent(const Json& v) {
    if (!v.is_number()) return "Not available";
    std::ostringstream out; out << std::fixed << std::setprecision(1) << v.get<double>() << "%";
    return out.str();
}
std::string human(std::string value) {
    for (auto& c : value) if (c == '_') c = ' ';
    if (!value.empty()) value[0] = static_cast<char>(std::toupper(static_cast<unsigned char>(value[0])));
    return value;
}
std::string stamp(Database& db) {
    return db.one("SELECT to_char(now() AT TIME ZONE 'Asia/Kolkata','DD Mon YYYY HH24:MI') AS t").at("t");
}
Response file(const std::string& name, const PdfDocument& doc) {
    return Response{{{"name", name}, {"mime", "application/pdf"}, {"content_base64", doc.base64()}}};
}

Response healthReport(Database& db, const std::string& uid, const std::string& name) {
    auto profile = getProfile(db, uid);
    const auto& m = profile.at("metrics");
    const auto& p = profile.at("effective_profile");
    PdfDocument doc("Financial health report", name, stamp(db));
    doc.heading("Monthly cash flow");
    doc.keyValues({{"Monthly income", inr(m.at("income"))}, {"Essential expenses", inr(p.at("essential"))}, {"Optional expenses", inr(p.at("discretionary"))},
                   {"Monthly instalments", inr(p.at("existing_emi"))}, {"Planned savings", inr(p.at("savings"))}, {"Left after spending and instalments", inr(m.at("disposable"))}});
    doc.heading("Indicators");
    doc.keyValues({{"Financial health score", m.at("health").is_number() ? m.at("health").dump() + " / 100" : "Add income to calculate"},
                   {"Savings rate", percent(m.at("savings_rate"))}, {"Instalments to income", percent(m.at("emi_ratio"))},
                   {"Debt to yearly income", percent(m.at("dti"))},
                   {"Emergency coverage", m.at("coverage").is_number() ? std::to_string(m.at("coverage").get<double>()).substr(0, 4) + " months" : "Not available"}});
    doc.heading("Balance sheet");
    doc.keyValues({{"Assets", inr(p.at("assets"))}, {"Emergency savings", inr(p.at("reserves"))}, {"Outstanding debt", inr(p.at("debt"))},
                   {"Other liabilities", inr(p.at("liabilities"))}, {"Net worth", inr(m.at("net_worth"))}});
    if (profile.at("portfolio").at("debt").get<Money>() > 0)
        doc.note("Debt and instalments include " + inr(profile.at("portfolio").at("debt")) + " outstanding on loans held through CredWise.");
    doc.note("Figures come from the financial profile you entered and the CredWise loan ledger. They are educational estimates.");
    return file("financial-health-report.pdf", doc);
}
Response creditReport(Database& db, const std::string& uid, const std::string& name) {
    auto a = assess(db, uid, false);
    PdfDocument doc("Simulated credit assessment", name, stamp(db));
    doc.heading("Result");
    doc.keyValues({{"Simulated score (300-900)", a.at("score").is_number() ? a.at("score").dump() : "More evidence needed"}, {"Risk category", human(text(a.at("risk")))},
                   {"Assessment method", human(text(a.at("strategy")))}, {"Monthly room for a new EMI", inr(a.at("capacity"))},
                   {"Financial health", a.at("health").is_number() ? a.at("health").dump() + " / 100" : "Not available"}});
    if (!a.at("factors").empty()) {
        doc.heading("Score factors");
        std::vector<std::vector<std::string>> rows;
        for (const auto& f : a.at("factors")) rows.push_back({text(f.at("name")), f.at("effective_weight").dump() + "%", f.at("value").is_number() ? f.at("value").dump() : "No evidence"});
        doc.table({"Factor", "Weight", "Score (0-100)"}, rows, {3, 1, 1});
    }
    doc.heading("Why this result");
    for (const auto& r : a.at("reasons")) doc.paragraph("- " + text(r));
    doc.heading("How to improve");
    for (const auto& s : a.at("suggestions")) doc.paragraph("- " + text(s));
    if (!a.at("history").empty()) {
        doc.heading("Score history");
        std::vector<std::vector<std::string>> rows;
        for (const auto& h : a.at("history")) rows.push_back({text(h.at("created_at")).substr(0, 10), h.at("score").is_number() ? h.at("score").dump() : "Needs evidence", human(text(h.at("strategy")))});
        doc.table({"Date", "Score", "Method"}, rows, {1, 1, 2});
    }
    doc.note("This score is a simulated, bureau-independent educational estimate. Factor weights and thresholds are policy version " + a.at("policy_version").dump() + ".");
    return file("credit-assessment.pdf", doc);
}
Response loanStatement(Database& db, const std::string& id, const std::string& owner) {
    auto loan = db.one(R"(SELECT l.id,l.application_id,l.product_terms->>'name' AS product,l.principal,l.outstanding,l.emi,l.rate_bps,l.months,l.status,
        l.opened_on,l.closed_on,u.name FROM loans l JOIN users u ON u.id=l.user_id WHERE l.id=$1 AND ($2='' OR l.user_id=NULLIF($2,'')::bigint))", {id, owner});
    PdfDocument doc("Loan statement", text(loan.at("name")) + " - Loan " + id, stamp(db));
    doc.heading("Loan summary");
    doc.keyValues({{"Product", text(loan.at("product"))}, {"Status", human(text(loan.at("status")))}, {"Opened", text(loan.at("opened_on"))},
                   {"Original principal", inr(loan.at("principal"))}, {"Outstanding principal", inr(loan.at("outstanding"))},
                   {"Annual interest rate", std::to_string(loan.at("rate_bps").get<int>() / 100.0).substr(0, 5) + "%"},
                   {"Contractual EMI", inr(loan.at("emi"))}, {"Tenure", loan.at("months").dump() + " months"}});
    doc.heading("Transactions");
    std::vector<std::vector<std::string>> tx;
    for (const auto& t : db.rows(R"(SELECT 'CW-T-'||id AS ref,payment_date,kind,amount,principal,interest,fee+penalty AS charges FROM repayment_transactions
                                    WHERE loan_id=$1 ORDER BY payment_date,id)", {id}))
        tx.push_back({text(t.at("ref")), text(t.at("payment_date")), human(text(t.at("kind"))), inr(t.at("amount")), inr(t.at("principal")), inr(t.at("interest")), inr(t.at("charges"))});
    doc.table({"Reference", "Date", "Type", "Amount", "Principal", "Interest", "Charges"}, tx, {1.3, 1.2, 1.3, 1.5, 1.5, 1.3, 1.2});
    doc.heading("Repayment schedule");
    std::vector<std::vector<std::string>> rows;
    for (const auto& r : db.rows(R"(SELECT month,due_date,principal,interest,paid_on FROM repayment_schedules WHERE loan_id=$1 AND active ORDER BY month)", {id}))
        rows.push_back({r.at("month").dump(), text(r.at("due_date")), inr(r.at("principal")), inr(r.at("interest")), inr(r.at("principal").get<Money>() + r.at("interest").get<Money>()),
                        r.at("paid_on").is_null() ? "Open" : "Paid " + text(r.at("paid_on"))});
    doc.table({"No.", "Due date", "Principal", "Interest", "Payment", "Status"}, rows, {0.6, 1.3, 1.5, 1.3, 1.5, 1.6});
    return file("loan-" + id + "-statement.pdf", doc);
}
Response certificate(Database& db, const std::string& id, const std::string& owner) {
    auto loan = db.one("SELECT id,status FROM loans WHERE id=$1 AND ($2='' OR user_id=NULLIF($2,'')::bigint)", {id, owner});
    if (loan.at("status") != "closed") throw Error(409, "loan_state", "The closure certificate is available after settlement.");
    const auto c = db.one("SELECT certificate FROM closure_certificates WHERE loan_id=$1", {id}).at("certificate");
    PdfDocument doc("Loan closure certificate", text(c.at("reference")), stamp(db));
    doc.paragraph("CredWise records this simulated loan as fully settled on " + text(c.at("closed_on")) + ".");
    doc.keyValues({{"Borrower", text(c.at("borrower_name"))}, {"Product", text(c.at("product_name"))}, {"Loan account", c.at("loan_id").dump()},
                   {"Application", c.at("application_id").dump()}, {"Original principal", inr(c.at("original_principal"))}, {"Principal repaid", inr(c.at("principal_paid"))},
                   {"Interest paid", inr(c.at("interest_paid"))}, {"Fees and penalties paid", inr(c.at("fees_paid"))}, {"Total payments", inr(c.at("total_paid"))},
                   {"Closure date", text(c.at("closed_on"))}});
    doc.note(text(c.at("disclaimer")));
    return file("closure-certificate-" + id + ".pdf", doc);
}
Response scenario(Database& db, const std::string& uid, const std::string& id, const std::string& name) {
    auto row = db.one("SELECT kind,name,result,created_at FROM planning_scenarios WHERE id=$1 AND user_id=$2", {id, uid});
    const auto& r = row.at("result");
    const auto kind = row.at("kind").get<std::string>();
    PdfDocument doc(kind == "education" ? "Education loan projection" : kind == "debt" ? "Debt freedom plan" : kind == "stress" ? "Financial stress test" : "Credit score twin scenario",
                    name + " - " + text(row.at("name")), stamp(db));
    if (kind == "education") {
        doc.keyValues({{"Loan needed", inr(r.at("loan_principal"))}, {"Months before repayment starts", r.at("moratorium_months").dump()},
                       {"Interest added while studying", inr(r.at("interest_accrued"))}, {"Interest paid while studying", inr(r.at("interest_paid_during_study"))},
                       {"Balance when repayment starts", inr(r.at("repayment_start_balance"))}, {"EMI", inr(r.at("emi"))}, {"Repayment period", r.at("repayment_months").dump() + " months"},
                       {"Total repayment", inr(r.at("total_repayment"))}, {"Total interest over the loan", inr(r.at("lifetime_interest"))},
                       {"EMI as share of expected salary", percent(r.at("salary_share_pct"))}, {"Outlook", human(text(r.at("verdict")))}});
        std::vector<std::vector<std::string>> rows;
        for (const auto& o : r.at("tenure_options")) rows.push_back({o.at("months").dump() + " months", inr(o.at("emi")), inr(o.at("total_interest")), percent(o.at("salary_share_pct"))});
        doc.heading("Repayment period options");
        doc.table({"Period", "EMI", "Interest", "Of salary"}, rows, {1, 1.4, 1.4, 1});
    } else if (kind == "debt") {
        doc.keyValues({{"Strategy", human(text(r.at("strategy")))}, {"Total debt", inr(r.at("total_debt"))}, {"Monthly amount", inr(r.at("monthly_budget"))},
                       {"Debt-free in", r.at("months").dump() + " months"}, {"Total interest", inr(r.at("total_interest"))},
                       {"Interest saved against minimum payments", inr(r.at("interest_saved"))}});
        std::vector<std::vector<std::string>> rows;
        for (const auto& o : r.at("payoff_order")) rows.push_back({text(o.at("name")), "Month " + o.at("month").dump()});
        doc.heading("Payoff order");
        doc.table({"Debt", "Cleared"}, rows, {3, 1});
    } else if (kind == "stress") {
        const auto& s = r.at("stressed");
        doc.keyValues({{"Income drop", r.at("shocks").at("income_drop_pct").dump() + "%"}, {"Essential cost rise", r.at("shocks").at("expense_rise_pct").dump() + "%"},
                       {"Instalment rise", r.at("shocks").at("emi_rise_pct").dump() + "%"}, {"Duration", r.at("shocks").at("duration_months").dump() + " months"},
                       {"Income in scenario", inr(s.at("income"))}, {"Monthly surplus", inr(s.at("surplus"))}, {"Emergency savings", inr(r.at("reserves"))},
                       {"Outcome", human(text(r.at("level")))}});
        doc.heading("Recommended actions");
        for (const auto& a : r.at("actions")) doc.paragraph("- " + text(a));
    } else {
        const auto& b = r.at("baseline");
        const auto& s = r.at("scenario");
        doc.table({"Measure", "Today", "Scenario"}, {{"Score", text(b.at("score")), text(s.at("score"))}, {"Risk", human(text(b.at("risk"))), human(text(s.at("risk")))},
                  {"Room for new EMI", inr(b.at("capacity")), inr(s.at("capacity"))}, {"Disposable income", inr(b.at("disposable")), inr(s.at("disposable"))}}, {2, 1.5, 1.5});
        std::vector<std::vector<std::string>> rows;
        for (const auto& f : r.at("factors")) rows.push_back({text(f.at("name")), text(f.at("before")), text(f.at("after"))});
        doc.heading("Factor scores");
        doc.table({"Factor", "Today", "Scenario"}, rows, {3, 1, 1});
    }
    doc.note("Projection based on the inputs you saved. Results are educational estimates.");
    return file(kind + "-plan.pdf", doc);
}
Response portfolioReport(Database& db) {
    auto p = portfolioSummary(db);
    const auto& t = p.at("totals");
    PdfDocument doc("Portfolio report", "Administrator report", stamp(db));
    doc.heading("Portfolio totals");
    doc.keyValues({{"Customers", t.at("customers").dump()}, {"Applications submitted", t.at("submitted_total").dump()}, {"Approved or funded", t.at("approved_total").dump()},
                   {"Rejected", t.at("rejected_total").dump()}, {"Active loans", t.at("loans_active").dump()}, {"Defaulted loans", t.at("loans_defaulted").dump()},
                   {"Principal disbursed", inr(t.at("disbursed"))}, {"Outstanding principal", inr(t.at("outstanding"))}, {"Collected", inr(t.at("collected"))},
                   {"Interest collected", inr(t.at("interest_collected"))}, {"Loans with overdue instalments", t.at("overdue_loans").dump()}, {"Open fraud cases", t.at("fraud_open").dump()}});
    std::vector<std::vector<std::string>> rows;
    for (const auto& r : p.at("by_product")) rows.push_back({text(r.at("name")), r.at("applications").dump(), r.at("approved").dump(), inr(r.at("disbursed"))});
    doc.heading("By product");
    doc.table({"Product", "Applications", "Approved", "Disbursed"}, rows, {2.2, 1.2, 1.2, 1.6});
    doc.note("Calculated from the application records and repayment ledger at the time of export.");
    return file("portfolio-report.pdf", doc);
}
}

std::optional<Response> documentRoutes(Database& db, const Request& req) {
    const auto& p = req.path;
    if (req.method != "GET" || p.size() < 3) return std::nullopt;
    const bool admin = p[0] == "admin" && p[1] == "reports" && p.size() >= 4 && p[2] == "pdf";
    const bool customer = p[0] == "reports" && p[1] == "pdf";
    if (!admin && !customer) return std::nullopt;
    const auto user = authenticate(db, req, admin ? Permission::administration : Permission::customerWorkspace);
    const auto uid = idOf(user), owner = admin ? std::string() : uid, kind = admin ? p[3] : p[2];
    const size_t arg = admin ? 4 : 3;
    const auto name = text(user.at("name"));
    if (admin && kind == "portfolio" && p.size() == 4) return portfolioReport(db);
    if (kind == "loan" && p.size() == arg + 1) return loanStatement(db, numeric(p[arg]), owner);
    if (admin) return std::nullopt;
    if (kind == "health" && p.size() == 3) return healthReport(db, uid, name);
    if (kind == "credit" && p.size() == 3) return creditReport(db, uid, name);
    if (kind == "certificate" && p.size() == 4) return certificate(db, numeric(p[3]), owner);
    if (kind == "scenario" && p.size() == 4) return scenario(db, uid, numeric(p[3]), name);
    return std::nullopt;
}
}
