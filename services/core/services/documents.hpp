#pragma once
#include "controllers/api.hpp"

namespace cw {
// Server-generated PDF documents derived from current persisted data.
std::optional<Response> documentRoutes(Database&, const Request&);
}
