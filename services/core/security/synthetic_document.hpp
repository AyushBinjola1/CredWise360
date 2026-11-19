#pragma once
#include "repositories/database.hpp"
namespace cw {
Json storeSyntheticDocument(Database&, const std::string& userId, const Json& document);
}
