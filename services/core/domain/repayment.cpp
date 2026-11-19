#include "domain/repayment.hpp"
#include <charconv>
#include <iomanip>
#include <sstream>

namespace cw {
CalendarDay calendarDay(const std::string& value) {
    require(value.size() == 10 && value[4] == '-' && value[7] == '-', "Use a calendar date in YYYY-MM-DD format.");
    auto number = [&](int start,int length) {
        int result = 0;
        const char* end = value.data()+start+length;
        auto parsed = std::from_chars(value.data()+start,end,result);
        require(parsed.ec == std::errc() && parsed.ptr == end && result >= 0, "Enter a valid calendar date.");
        return result;
    };
    using namespace std::chrono;
    const year_month_day ymd{year{number(0,4)},month{static_cast<unsigned>(number(5,2))},
                             day{static_cast<unsigned>(number(8,2))}};
    require(ymd.ok(),"Enter a valid calendar date.");
    return sys_days(ymd);
}
std::string isoDate(CalendarDay value) {
    const std::chrono::year_month_day date(value);
    std::ostringstream out;
    out << std::setfill('0') << std::setw(4) << int(date.year()) << '-' << std::setw(2) << unsigned(date.month())
        << '-' << std::setw(2) << unsigned(date.day());
    return out.str();
}
CalendarDay monthAnniversary(CalendarDay opening,int count) {
    using namespace std::chrono;
    const year_month_day anchor{opening};
    const auto target = anchor.year()/anchor.month()+months(count);
    const auto candidate = target/anchor.day();
    return candidate.ok() ? sys_days(candidate) : sys_days(target/last);
}
Json recastInstallments(const Json& loan, const Json& firstOpen, Money outstanding) {
    const auto& quote = loan.at("offer_quote");
    const bool flat = quote.at("method") == "flat";
    const Money original = loan.at("principal");
    const int first = firstOpen.at("month"), months = loan.at("months");
    const auto opened = calendarDay(loan.at("opened_on"));
    Json rows = Json::array();
    for (int month = first; outstanding > 0 && month <= months; ++month) {
        const auto& reference = quote.at("schedule").at(month-1);
        const int rate = reference.at("rate_bps");
        const Money alreadyPrincipal = month == first ? firstOpen.at("principal_paid").get<Money>() : 0;
        const Money alreadyInterest = month == first ? firstOpen.at("interest_paid").get<Money>() : 0;
        Money interest = flat ? reference.at("interest").get<Money>() : EMIEngine::monthlyInterest(outstanding,rate);
        if (alreadyPrincipal || alreadyInterest) interest = firstOpen.at("interest");
        const Money regular = flat ? (original + months/2) / months + interest : reference.at("payment").get<Money>();
        const Money due = month == months ? outstanding : std::min(outstanding,std::max<Money>(0,regular-interest-alreadyPrincipal));
        outstanding -= due;
        rows.push_back({{"month",month},{"due_date",isoDate(monthAnniversary(opened,month))},
                        {"principal",due+alreadyPrincipal},{"interest",interest},{"balance",outstanding}});
    }
    require(outstanding == 0,"The schedule could not reconcile the outstanding principal.");
    return rows;
}
}
