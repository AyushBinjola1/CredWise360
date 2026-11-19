#pragma once
#include "controllers/api.hpp"

namespace cw {
std::optional<Response> learningRoutes(Database&, const Request&);
}
