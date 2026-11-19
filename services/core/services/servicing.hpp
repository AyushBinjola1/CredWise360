#pragma once
#include "controllers/api.hpp"

namespace cw {
std::int64_t openLoan(Database&,const Json& application,const Json& quote,const Json& product);
Json portfolioCommitments(Database&,std::string userId);
std::optional<Response> servicingRoutes(Database&,const Request&);
}
