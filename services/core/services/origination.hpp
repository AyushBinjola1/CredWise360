#pragma once
#include "controllers/api.hpp"
namespace cw {
std::optional<Response> originationRoutes(Database&,const Request&);
// Servicing holds the borrower's financial profile and application locks.
void closeLoanApplication(Database&,const std::string& applicationId,const std::string& actorId,bool defaulted=false);
}
