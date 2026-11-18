#pragma once
#include "controllers/api.hpp"

namespace cw {
Json currentUser(Database&, const Request&, bool admin = false);
Json getProfile(Database&, std::string userId);
void seedIdentity(Database&);
std::optional<Response> identityRoutes(Database&, const Request&);
}
