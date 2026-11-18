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
    std::unique_ptr<PGconn, decltype(&PQfinish)> conn_;
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
void migrate(Database&, const std::filesystem::path&);
}
