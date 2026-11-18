#include "security/credentials.hpp"
#include <array>
#include <openssl/crypto.h>
#include <openssl/evp.h>
#include <openssl/rand.h>

namespace cw::security {
namespace {
constexpr int iterations = 600000;
constexpr char digits[] = "0123456789abcdef";
std::string hex(const unsigned char* bytes, size_t count) {
    std::string result(2 * count, '0');
    for (size_t index = 0; index < count; ++index) {
        result[2 * index] = digits[bytes[index] >> 4];
        result[2 * index + 1] = digits[bytes[index] & 15];
    }
    return result;
}
std::string derive(const std::string& password, const std::string& salt) {
    std::array<unsigned char, 32> output{};
    if (PKCS5_PBKDF2_HMAC(password.data(), int(password.size()),
                          reinterpret_cast<const unsigned char*>(salt.data()), int(salt.size()),
                          iterations, EVP_sha256(), int(output.size()), output.data()) != 1)
        throw std::runtime_error("Password derivation failed.");
    return hex(output.data(), output.size());
}
}

std::string token(size_t bytes) {
    std::vector<unsigned char> random(bytes);
    if (RAND_bytes(random.data(), int(random.size())) != 1) throw std::runtime_error("Random generation failed.");
    return hex(random.data(), random.size());
}
std::string digest(const std::string& input) {
    std::array<unsigned char, EVP_MAX_MD_SIZE> bytes{};
    unsigned int size = 0;
    if (EVP_Digest(input.data(), input.size(), bytes.data(), &size, EVP_sha256(), nullptr) != 1)
        throw std::runtime_error("Digest calculation failed.");
    return hex(bytes.data(), size);
}
bool equals(const std::string& left, const std::string& right) {
    return left.size() == right.size() && CRYPTO_memcmp(left.data(), right.data(), left.size()) == 0;
}
std::string hashPassword(const std::string& password) {
    const auto salt = token(16);
    return "pbkdf2-sha256$600000$" + salt + "$" + derive(password, salt);
}
bool matchesPassword(const std::string& password, const std::string& stored) {
    const std::string prefix = "pbkdf2-sha256$600000$";
    if (!stored.starts_with(prefix) || stored.size() != prefix.size() + 32 + 1 + 64 ||
        stored[prefix.size() + 32] != '$') return false;
    return equals(derive(password, stored.substr(prefix.size(), 32)), stored.substr(prefix.size() + 33));
}
std::string decodeDocument(const std::string& encoded) {
    constexpr size_t maxBytes = 256 * 1024;
    require(!encoded.empty() && encoded.size() % 4 == 0 && encoded.size() <= ((maxBytes + 2) / 3) * 4,
            "Upload a document of up to 256 KiB.");
    size_t pad = encoded.ends_with("==") ? 2 : encoded.ends_with('=') ? 1 : 0;
    for (size_t index = 0; index < encoded.size() - pad; ++index) {
        const char c = encoded[index];
        require((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') ||
                c == '+' || c == '/', "Document encoding is invalid.");
    }
    std::string result(encoded.size() / 4 * 3, '\0');
    const int output = EVP_DecodeBlock(reinterpret_cast<unsigned char*>(result.data()),
                                       reinterpret_cast<const unsigned char*>(encoded.data()), int(encoded.size()));
    require(output > int(pad) && size_t(output) - pad <= maxBytes, "Document encoding is invalid.");
    result.resize(size_t(output) - pad);
    return result;
}
std::string sessionCookie(const std::string& value) {
    return "cw=" + value + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" +
           (value.empty() ? "0" : "43200") + (setting("COOKIE_SECURE") == "1" ? "; Secure" : "");
}
}
