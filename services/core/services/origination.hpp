#pragma once
#include "controllers/api.hpp"
namespace cw {
std::optional<Response> originationRoutes(Database&,const Request&);
// Servicing holds the borrower's financial profile and application locks.
// Administrators can send a rejected application back to underwriting as an escalated reconsideration.
void reconsiderApplication(Database&,const std::string& applicationId,const std::string& actorId,const std::string& note);
void closeLoanApplication(Database&,const std::string& applicationId,const std::string& actorId,bool defaulted=false);
}
