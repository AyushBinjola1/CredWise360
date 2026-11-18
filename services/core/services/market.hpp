#pragma once
#include "controllers/api.hpp"
#include "domain/loan.hpp"

namespace cw {
std::unique_ptr<Loan> loadProduct(Database&, const std::string& slug);
Json productAssessment(Database&, const std::string& userId, const std::string& slug,
                       Money principal, int months, const std::string& purpose);
std::optional<Response> marketRoutes(Database&, const Request&);
}
