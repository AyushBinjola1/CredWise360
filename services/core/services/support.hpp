#pragma once
#include "controllers/api.hpp"

namespace cw {
std::optional<Response> supportRoutes(Database&, const Request&);
}
