#include "engines/distress.hpp"
#include "engines/fairness.hpp"
#include "engines/pdf.hpp"
#include "engines/safety.hpp"
#include "domain/dispute.hpp"
#include <functional>
#include <iostream>

namespace {
using namespace cw;
void check(bool valid, const char* message) {
    if (!valid) throw std::runtime_error(message);
}
bool rejects(const std::function<void()>& action) {
    try { action(); } catch (const Error&) { return true; }
    return false;
}
bool flagged(const Json& result, const char* code) {
    for (const auto& f : result.at("flags")) if (f.at("code") == code) return true;
    return false;
}
void safety() {
    // Zero interest and no fees costs nothing: the effective rate is exactly zero.
    auto zero = LoanSafetyScanner::scan({{"principal",1200000},{"months",12},{"advertised_rate_bps",0},{"late_fee",0},{"prepayment_penalty_bps",0},{"lock_in_months",0}},0);
    check(zero.at("facts").at("effective_annual_pct") == 0.0 && zero.at("facts").at("total_repayment") == 1200000,"Zero-rate offer should cost nothing");
    check(zero.at("verdict") == "no_major_concerns","Zero-rate offer should raise no concern");
    // A 12% reducing loan has an effective annual rate of 12.68% when repaid monthly.
    auto fair = LoanSafetyScanner::scan({{"principal",10000000},{"months",12},{"advertised_rate_bps",1200},{"late_fee",50000},{"prepayment_penalty_bps",0},{"lock_in_months",0}},0);
    const double ear = fair.at("facts").at("effective_annual_pct");
    check(ear > 12.6 && ear < 12.75,"Reducing 12% monthly should be 12.68% effective");
    check(fair.at("facts").at("net_disbursed") == 10000000,"No fees should leave the principal intact");
    // Flat interest roughly doubles the true rate, and fees deducted upfront raise it further.
    auto flat = LoanSafetyScanner::scan({{"principal",5000000},{"months",12},{"advertised_rate_bps",1800},{"basis","flat"},{"processing_fee",500000},{"mandatory_charges",300000}},0);
    check(flat.at("facts").at("effective_annual_pct").get<double>() > 36,"Flat 18% with fees should exceed 36% effective");
    check(flat.at("facts").at("net_disbursed") == 4200000,"Net disbursed must remove fees and charges");
    check(flagged(flat,"flat_rate") && flagged(flat,"rate_gap") && flagged(flat,"upfront_deductions") && flagged(flat,"bundled_charges"),"Expected cost warnings");
    check(flat.at("verdict") == "high_concern","Hidden-cost offer should be a high concern");
    // Income burden is only tested when income is known.
    auto burden = LoanSafetyScanner::scan({{"principal",5000000},{"months",6},{"advertised_rate_bps",1200}},500000);
    check(flagged(burden,"burden"),"Large repayment against small income should be flagged");
    check(!flagged(LoanSafetyScanner::scan({{"principal",5000000},{"months",6},{"advertised_rate_bps",1200}},0),"burden"),"Unknown income should skip burden");
    check(rejects([]{ LoanSafetyScanner::scan({{"principal",100},{"months",6},{"advertised_rate_bps",100},{"processing_fee",200}},0); }),"Fees above principal accepted");
    check(rejects([]{ LoanSafetyScanner::scan({{"principal",100},{"months",6},{"advertised_rate_bps",100},{"bogus",1}},0); }),"Unknown field accepted");
}
void distress() {
    Json calm = {{"income",8000000},{"disposable",3000000},{"emi_ratio",5.0},{"dti",20.0},{"coverage",8.0},{"missed",0},{"overdue_count",0},{"overdue_amount",0},
                 {"due_30d",0},{"emi_in_profile",400000},{"disposable_trend",Json::array({3000000,3000000})},{"reserves_trend",Json::array({9000000,9000000})}};
    auto low = DistressMonitor::assess(calm);
    check(low.at("level") == "low" && low.at("score") == 0,"Healthy profile should be low");
    Json strained = calm;
    strained["disposable"] = -500000; strained["emi_ratio"] = 60.0; strained["coverage"] = 0.5; strained["missed"] = 4; strained["overdue_count"] = 2;
    strained["overdue_amount"] = 900000; strained["reserves_trend"] = Json::array({9000000,4000000});
    auto high = DistressMonitor::assess(strained);
    check(high.at("level") == "high","Strained profile should be high");
    for (const auto& i : high.at("indicators")) check(!i.at("detail").get<std::string>().empty(),"Every indicator must explain itself");
    check(high.at("recommendations").size() >= 3,"High distress should come with recommendations");
    check(high.at("notice").get<std::string>().find("never changes") != std::string::npos,"Non-punitive notice required");
    Json watch = calm; watch["coverage"] = 2.0;
    check(DistressMonitor::assess(watch).at("level") == "watch","One watch indicator should be watch");
}
void documents() {
    check(PdfDocument::inr(2500000) == "INR 25,000.00","Rupee grouping for 25,000");
    check(PdfDocument::inr(12345678) == "INR 1,23,456.78","Indian grouping for lakhs");
    check(PdfDocument::inr(123456789012) == "INR 1,23,45,67,890.12","Indian grouping for crores");
    check(PdfDocument::inr(-500) == "-INR 5.00" && PdfDocument::inr(5) == "INR 0.05" && PdfDocument::inr(0) == "INR 0.00","Small and negative amounts");
    PdfDocument doc("Test report", "Subtitle ₹ (with) \\ specials", "01 Jan 2026 10:00");
    doc.heading("Section");
    doc.paragraph("A long paragraph that must wrap across several lines because it is much wider than the printable area of the page. " + std::string(400, 'x'));
    std::vector<std::vector<std::string>> rows;
    for (int i = 0; i < 120; ++i) rows.push_back({std::to_string(i), "Row " + std::to_string(i), PdfDocument::inr(i * 1000)});
    doc.table({"No.","Name","Amount"}, rows);
    const auto bytes = doc.render();
    check(bytes.rfind("%PDF-1.4",0) == 0 && bytes.find("%%EOF") != std::string::npos,"PDF framing");
    const auto pages = std::count(bytes.begin(), bytes.end(), '\n') > 0 ? bytes.find("/Count ") : std::string::npos;
    check(pages != std::string::npos && std::stoi(bytes.substr(pages + 7)) >= 3,"Long tables should span pages");
    // Every cross-reference offset must point at the matching object.
    const auto start = std::stoul(bytes.substr(bytes.rfind("startxref") + 10));
    check(bytes.compare(start,4,"xref") == 0,"startxref must locate the table");
    size_t cursor = bytes.find('\n', bytes.find('\n', start) + 1) + 1;  // skip "xref" and "0 N"
    cursor = bytes.find('\n', cursor) + 1;                              // skip the free entry
    for (int object = 1; bytes.compare(cursor,7,"trailer") != 0; ++object, cursor += 20) {
        const auto offset = std::stoul(bytes.substr(cursor,10));
        check(bytes.compare(offset, std::to_string(object).size() + 6, std::to_string(object) + " 0 obj") == 0,"xref offset mismatch");
    }
    check(bytes.find("\\(with\\)") != std::string::npos && bytes.find("INR  (") == std::string::npos,"Special characters must be escaped");
    for (unsigned char c : bytes) check(c < 0x80,"PDF output must be plain ASCII");
    check(!doc.base64().empty() && doc.base64().size() % 4 == 0,"Base64 padding");
}
void fairness() {
    const Json policy = {{"id",1},
        {"conventional_weights",{{"repayment",35},{"utilization",20},{"obligations",10},{"history",10},{"inquiries",10},{"consistency",8},{"resilience",7}}},
        {"alternative_weights",{{"rent",25},{"utilities",20},{"cashflow",20},{"savings",20},{"commitments",15}}},
        {"thresholds",{{"min_conventional_payments",3},{"min_history_months",3},{"history_target_months",60},{"inquiry_window_days",90},{"max_recent_inquiries",5},
                       {"full_reserve_months",6},{"full_savings_pct",20},{"max_debt_to_annual_pct",100},{"emi_cap_pct",40},{"cashflow_share_pct",70},
                       {"low_risk_score",740},{"moderate_risk_score",620},{"alt_min_evidence",3},{"positive_factor_min",75},{"negative_factor_max",45}}}};
    auto result = FairnessAuditor(policy, {}).run();
    check(result.at("consistent") == true && result.at("max_score_difference") == 0,"Protected attributes must not move outcomes");
    check(result.at("tests").size() == 3 && result.at("comparisons") == 9,"Three personas with three variants each");
    for (const auto& s : result.at("sensitivity")) check(s.at("changed") == true,"Control changes must move the result");
    // A biased policy would show up: this auditor reports a difference if outcomes diverge.
    for (const auto& p : result.at("policy_checks")) check(p.at("passed") == true,"Policy checks should pass");
}
void tickets() {
    check(DisputeTicket("open").permits("in_review") && DisputeTicket("awaiting_customer").permits("in_review"),"Ticket progress");
    check(DisputeTicket("resolved").permits("open") && !DisputeTicket("resolved").permits("in_review"),"Only reopening leaves resolved");
    check(!DisputeTicket("withdrawn").permits("open") && DisputeTicket("withdrawn").closed(),"Withdrawn is final");
    check(rejects([]{ DisputeTicket("open").checkTransition("open"); }),"Self transition accepted");
    check(DisputeTicket::validCategory("payment_issue") && !DisputeTicket::validCategory("anything"),"Categories");
}
}
int main() {
    try { safety(); distress(); documents(); fairness(); tickets(); }
    catch (const std::exception& e) { std::cerr << e.what() << '\n'; return 1; }
    std::cout << "Oversight engine tests passed\n";
}
