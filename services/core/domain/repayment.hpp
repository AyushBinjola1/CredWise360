#pragma once
#include "engines/emi.hpp"
#include <chrono>

namespace cw {
using CalendarDay = std::chrono::sys_days;
CalendarDay calendarDay(const std::string& text);
std::string isoDate(CalendarDay date);
CalendarDay monthAnniversary(CalendarDay opening, int months);

struct Repayment {
    Money principal = 0, interest = 0, fee = 0, penalty = 0;
    Json allocations = Json::array();
    Money amount() const { return principal + interest + fee + penalty; }
};

// Reprice open instalments at the frozen regular payment after a principal-only payment.
Json recastInstallments(const Json& loan, const Json& firstOpen, Money outstanding);
}
