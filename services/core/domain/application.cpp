#include "domain/application.hpp"
#include <map>
#include <set>

namespace cw {
bool LoanApplication::permits(const std::string& next) const {
    static const std::map<std::string,std::set<std::string>> transitions = {
        {"draft",{"submitted","withdrawn"}},{"submitted",{"under_review","withdrawn"}},
        {"under_review",{"approved","rejected","requires_information","withdrawn"}},
        {"requires_information",{"submitted","withdrawn"}},{"approved",{"accepted","withdrawn"}},
        {"rejected",{"under_review"}},{"accepted",{"disbursed","under_review"}},
        {"disbursed",{"active"}},{"active",{"closed","defaulted"}},{"defaulted",{"closed"}}
    };
    const auto found = transitions.find(state_);
    return found != transitions.end() && found->second.contains(next);
}
void LoanApplication::checkTransition(const std::string& next) const {
    if (!permits(next)) throw Error(409,"application_state","This operation is unavailable in the current application state.");
}
}
