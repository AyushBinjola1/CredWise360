#include "domain/profile.hpp"
#include "engines/emi.hpp"
#include <iostream>

namespace {
void check(bool value,const char* message) { if (!value) throw std::runtime_error(message); }
void reconciles(const cw::Json& q) {
    using cw::Money;
    Money balance=q.at("principal"),paidPrincipal=0,paidInterest=0,cash=0;
    for(const auto& row:q.at("schedule")) {
        const Money principal=row.at("principal"),interest=row.at("interest"),payment=row.at("payment");
        check(principal>=0 && principal<=balance && interest>=0,"Negative or excessive allocation");
        balance-=principal;
        check(row.at("balance")==balance,"Closing balance mismatch");
        check(payment==principal+interest+row.at("prepayment_fee").get<Money>(),"Payment split mismatch");
        paidPrincipal+=principal;paidInterest+=interest;cash+=payment;
    }
    check(balance==0 && paidPrincipal==q.at("principal"),"Unreconciled principal");
    check(paidInterest==q.at("total_interest") && cash==q.at("total_repayment"),"Aggregate mismatch");
}
}
int main() {
    using namespace cw;
    try {
        Json base={{"principal",1000000},{"months",3},{"rate_bps",0}};
        auto free=quote(base);reconciles(free);
        check(free.at("emi")==333333 && free.at("schedule").back().at("payment")==333334,"Final-paise correction");
        for (int months:{1,2,12,60,360,600}) for (int rate:{0,1,750,2450,6000})
            for (Money amount:std::vector<Money>{1,137,532818,maxMoney})
                reconciles(quote({{"principal",amount},{"months",months},{"rate_bps",rate}}));
        auto priced=base;priced["rate_bps"]=1200;priced["months"]=24;
        auto ordinary=quote(priced);
        auto partial=priced;partial["prepayment"]=240000;partial["prepay_month"]=5;
        auto earlier=quote(partial);reconciles(earlier);
        check(earlier.at("total_interest")<ordinary.at("total_interest"),"Prepayment should reduce interest");
        auto floating=priced;floating["next_rate_bps"]=1600;floating["rate_month"]=5;
        auto changed=quote(floating);reconciles(changed);check(changed.at("total_interest")>ordinary.at("total_interest"),"Floating-rate reset");
        auto flat=priced;flat["method"]="flat";auto flatQuote=quote(flat);reconciles(flatQuote);
        check(flatQuote.at("total_interest")==240000,"Flat interest on original principal");
        base["upfront"]=1000000;
        bool invalid=false;try { quote(base); } catch(const Error& e) {invalid=e.status==422;}
        check(invalid,"Net proceeds validation");
        auto before=FinancialProfile().adjusted({{"salary",2000000},{"essential",400000}});
        auto clone=before.adjusted({{"salary",1000000}});
        check(before.metrics().at("disposable")==1600000 && clone.metrics().at("disposable")==600000,"Profile copy isolation");
        std::cout<<"120 amortization combinations, paise rounding, floating/flat terms, prepayments and profile copy passed.\n";
    } catch(const std::exception& e){std::cerr<<e.what()<<'\n';return 1;}
}
