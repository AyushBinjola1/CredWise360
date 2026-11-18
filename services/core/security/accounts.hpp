#pragma once
#include "controllers/api.hpp"
#include <memory>

namespace cw {
enum class Permission { ownAccount, customerWorkspace, administration };
class User {
    Json record_;
protected:
    explicit User(Json record) : record_(std::move(record)) {}
public:
    virtual ~User() = default;
    virtual bool permits(Permission permission) const = 0;
    const Json& record() const { return record_; }
    static std::unique_ptr<User> from(Json record);
};
class Customer final : public User {
public:
    explicit Customer(Json record) : User(std::move(record)) {}
    bool permits(Permission permission) const override { return permission != Permission::administration; }
};
class Administrator final : public User {
public:
    explicit Administrator(Json record) : User(std::move(record)) {}
    bool permits(Permission permission) const override { return permission != Permission::customerWorkspace; }
};

Json authenticate(Database&, const Request&, Permission);
std::optional<Response> authRoutes(Database&, const Request&);
Json createAccount(Database&, const std::string& email, const std::string& name,
                   const std::string& password, const std::string& role, const std::string& recovery);
void identityAudit(Database&, const std::string& actor, const std::string& subject,
                   const std::string& action, const Json& detail = Json::object());
Response settingsRoute(Database&, const Request&);
}
