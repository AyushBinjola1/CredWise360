#include "domain/dispute.hpp"
#include <map>
#include <set>

namespace cw {
bool DisputeTicket::permits(const std::string& next) const {
    static const std::map<std::string, std::set<std::string>> transitions = {
        {"open", {"in_review", "awaiting_customer", "resolved", "rejected", "withdrawn"}},
        {"in_review", {"awaiting_customer", "resolved", "rejected", "withdrawn"}},
        {"awaiting_customer", {"in_review", "resolved", "rejected", "withdrawn"}},
        {"resolved", {"open"}},
        {"rejected", {"open"}},
        {"withdrawn", {}}
    };
    const auto found = transitions.find(state_);
    return found != transitions.end() && found->second.contains(next);
}
void DisputeTicket::checkTransition(const std::string& next) const {
    if (!permits(next)) throw Error(409, "ticket_state", "This ticket cannot move to that status from its current status.");
}
bool DisputeTicket::validCategory(const std::string& category) {
    static const std::set<std::string> list = {"incorrect_record", "assessment_challenge", "application_reconsideration", "payment_issue", "other"};
    return list.contains(category);
}
}
