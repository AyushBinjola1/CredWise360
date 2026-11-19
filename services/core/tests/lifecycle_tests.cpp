#include "domain/application.hpp"
#include "domain/profile.hpp"
#include "domain/repayment.hpp"
#include <iostream>

namespace {
void check(bool valid,const char* message) {
    if (!valid) throw std::runtime_error(message);
}
void workflow() {
    using cw::LoanApplication;
    for (const auto& transition : std::vector<std::pair<std::string,std::string>>{
            {"draft","submitted"},{"submitted","under_review"},{"under_review","requires_information"},
            {"requires_information","submitted"},{"under_review","rejected"},{"rejected","under_review"},
            {"under_review","approved"},{"approved","accepted"},{"accepted","under_review"},
            {"accepted","disbursed"},{"disbursed","active"},{"active","closed"},{"active","defaulted"}})
        LoanApplication(transition.first).checkTransition(transition.second);
    for (const auto& [from,to] : std::vector<std::pair<std::string,std::string>>{
            {"draft","active"},{"rejected","accepted"},{"closed","disbursed"},{"active","approved"},{"withdrawn","submitted"}}) {
        bool rejected = false;
        try { LoanApplication(from).checkTransition(to); } catch (const cw::Error& e) { rejected = e.status==409; }
        check(rejected,"Invalid lifecycle transition accepted");
    }
}
void schedule() {
    using namespace cw;
    auto start=calendarDay("2024-01-31");
    check(isoDate(monthAnniversary(start,1))=="2024-02-29","Leap-year anniversary");
    check(isoDate(monthAnniversary(start,2))=="2024-03-31","Month-end anchor drifted");
    check(isoDate(monthAnniversary(calendarDay("2025-01-31"),1))=="2025-02-28","Short month anniversary");
    bool invalid=false;
    try {calendarDay("2025-02-29");} catch(const Error& e){invalid=e.status==422;}
    check(invalid,"Impossible payment date accepted");
    auto offer=quote({{"principal",1200000},{"months",12},{"rate_bps",1200}});
    Json loan={{"offer_quote",offer},{"principal",1200000},{"months",12},{"opened_on","2024-01-31"}};
    const Json& first=offer.at("schedule").at(0);
    Json partiallyPaid={{"month",1},{"principal_paid",15000},{"interest_paid",first.at("interest")},{"interest",first.at("interest")}};
    const Money outstanding=885000;
    auto revised=recastInstallments(loan,partiallyPaid,outstanding);
    Money unpaid=-15000;
    for (auto& row:revised) unpaid+=row.at("principal").get<Money>();
    check(unpaid==outstanding && revised.back().at("balance")==0,"Recast principal mismatch");
    check(revised[0].at("interest")==first.at("interest"),"Partially paid period interest was lost");
}
void exposure() {
    using namespace cw;
    auto declared=FinancialProfile().adjusted({{"salary",5000000},{"essential",1500000},{"debt",maxMoney},{"existing_emi",50000}});
    auto combined=declared.withPortfolio({{"debt",2000000},{"existing_emi",100000},{"on_time",6},{"missed",1},{"credit_months",8}});
    check(declared.values()["debt"]==maxMoney,"Platform loan modified externally declared debt");
    check(combined.values()["debt"]==maxMoney+2000000,"Combined debt was capped at the single-input limit");
    check(combined.metrics()["disposable"]==3350000,"Platform EMI omitted from cash flow");
    check(combined.values()["credit_months"]==8 && combined.values()["missed"]==1,"Servicing evidence missing");
}
}
int main() {
    try {workflow();schedule();exposure();std::cout<<"Lifecycle, calendar, recast and combined exposure passed.\n";}
    catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
