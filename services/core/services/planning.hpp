#pragma once
#include "controllers/api.hpp"

namespace cw {
std::optional<Response> planningRoutes(Database&, const Request&);
}
