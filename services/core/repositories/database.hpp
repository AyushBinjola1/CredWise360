#pragma once
#include "common.hpp"
#include <libpq-fe.h>
#include <memory>

namespace cw {
using Params = std::vector<std::string>;
class Repository {
public:
    virtual Json rows(const std::string&, const Params& = {}) = 0;
    virtual void exec(const std::string&, const Params& = {}) = 0;
    virtual ~Repository() = default;
};
class Database final : public Repository {
    using Result = std::unique_ptr<PGresult, decltype(&PQclear)>;
    // Connections return to a per-thread cache instead of closing, which avoids a TLS handshake per request.
    std::unique_ptr<PGconn, void (*)(PGconn*)> conn_;
    Result query(const std::string&, const Params&);
public:
    Database();
    Database(const Database&) = delete;
    Json rows(const std::string&, const Params& = {}) override;
    Json one(const std::string&, const Params& = {});
    void exec(const std::string&, const Params& = {}) override;
    void script(const std::string&);
};
class Transaction {
    Database& db_;
    bool committed_ = false;
public:
    explicit Transaction(Database& db) : db_(db) { db_.exec("BEGIN"); }
    Transaction(const Transaction&) = delete;
    void commit() { db_.exec("COMMIT"); committed_ = true; }
    ~Transaction() { if (!committed_) try { db_.exec("ROLLBACK"); } catch (...) {} }
};
// DATABASE_URL (URI or keyword form) plus optional DATABASE_SSLMODE and DATABASE_CONNECT_TIMEOUT.
// Parameters already present in the URL are never overridden, so local setups are unchanged.
std::string databaseConnectionString();
void migrate(Database&, const std::filesystem::path&);
}
