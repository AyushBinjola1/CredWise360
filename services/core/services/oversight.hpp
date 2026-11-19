#pragma once
#include "controllers/api.hpp"

namespace cw {
// Loan safety scanner, financial distress early warning and lending fairness monitor.
std::optional<Response> oversightRoutes(Database&, const Request&);
}
