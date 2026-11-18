#pragma once
#include "json.hpp"
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <optional>
#include <stdexcept>
#include <string>
#include <vector>

namespace cw {
using Json = nlohmann::json;
using Money = std::int64_t;
constexpr Money maxMoney = 100'000'000'000LL;
struct Error : std::runtime_error {
    int status;
    std::string code;
    Error(int status, std::string code, const std::string& message)
        : std::runtime_error(message), status(status), code(std::move(code)) {}
};
inline void require(bool valid, const std::string& message) {
    if (!valid) throw Error(422, "validation", message);
}
inline std::string setting(const char* key, const std::string& fallback = "") {
    const char* value = std::getenv(key);
    return value && *value ? value : fallback;
}
inline std::string field(const Json& body, const std::string& key, size_t max = 240, bool optional = false) {
    if (optional && !body.contains(key)) return "";
    require(body.contains(key) && body.at(key).is_string(), "Enter a valid " + key + ".");
    auto value = body.at(key).get<std::string>();
    require((optional || value.find_first_not_of(" \t\r\n") != std::string::npos) &&
            value.size() <= max && value.find('\0') == std::string::npos, "Check the " + key + " field.");
    return value;
}
inline Money integer(const Json& body, const std::string& key, Money low, Money high) {
    require(body.contains(key) && body.at(key).is_number_integer(), "Enter a whole number for " + key + ".");
    const auto& v = body.at(key);
    if (v.is_number_unsigned()) require(v.get<std::uint64_t>() <= static_cast<std::uint64_t>(high), key + " is too large.");
    Money result = v.get<Money>();
    require(result >= low && result <= high, key + " is outside the supported range.");
    return result;
}
inline std::string readFile(const std::filesystem::path& path) {
    std::ifstream f(path, std::ios::binary);
    if (!f) throw std::runtime_error("Cannot open " + path.filename().string());
    return {std::istreambuf_iterator<char>(f), {}};
}
}
