#pragma once
#include "controllers/api.hpp"

namespace cw {
Json assess(Database&, std::string userId, bool persist = true);
Json modelCredit(Database&, const Json& fullProfile, int recent = 0);
// The caller owns the transaction containing the profile update or loan submission.
void recordProfileAssessment(Database&, const std::string& userId, const Json& fullProfile);
void recordCreditInquiry(Database&, const std::string& userId, const std::string& applicationRef);
std::optional<Response> assessmentRoutes(Database&, const Request&);
}
