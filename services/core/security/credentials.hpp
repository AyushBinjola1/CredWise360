#pragma once
#include "common.hpp"

namespace cw::security {
std::string token(size_t bytes = 32);
std::string digest(const std::string& input);
std::string hashPassword(const std::string& password);
bool matchesPassword(const std::string& password, const std::string& stored);
bool equals(const std::string& left, const std::string& right);
std::string decodeDocument(const std::string& encoded);
std::string sessionCookie(const std::string& token);
}
