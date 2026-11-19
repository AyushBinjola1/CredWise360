#include "repositories/database.hpp"
#include <chrono>
#include <set>
namespace cw {
namespace {
bool isUri(const std::string& value) { return value.rfind("postgresql://", 0) == 0 || value.rfind("postgres://", 0) == 0; }
std::string withParameter(const std::string& url, const std::string& key, const std::string& value) {
    if (url.find(key + "=") != std::string::npos) return url;
    if (isUri(url)) return url + (url.find('?') == std::string::npos ? "?" : "&") + key + "=" + value;
    return url + " " + key + "=" + value;
}
}
std::string databaseConnectionString() {
    std::string url = setting("DATABASE_URL");
    if (url.empty()) throw std::runtime_error("Set DATABASE_URL before starting CredWise.");
    const auto mode = setting("DATABASE_SSLMODE");
    if (!mode.empty()) {
        static const std::set<std::string> allowed = {"disable", "allow", "prefer", "require", "verify-ca", "verify-full"};
        if (!allowed.contains(mode)) throw std::runtime_error("DATABASE_SSLMODE must be disable, allow, prefer, require, verify-ca or verify-full.");
        url = withParameter(url, "sslmode", mode);
    }
    const auto timeout = setting("DATABASE_CONNECT_TIMEOUT", "15");
    if (timeout.find_first_not_of("0123456789") != std::string::npos) throw std::runtime_error("DATABASE_CONNECT_TIMEOUT must be a number of seconds.");
    return withParameter(url, "connect_timeout", timeout);
}
namespace {
using Clock = std::chrono::steady_clock;
// One idle connection per worker thread. A connection idle for a while is checked before reuse because a serverless
// database may have closed it; a broken connection is dropped and replaced.
struct IdleConnection {
    PGconn* conn = nullptr;
    Clock::time_point since{};
    ~IdleConnection() { if (conn) PQfinish(conn); }
};
thread_local IdleConnection idle;
constexpr auto recheckAfter = std::chrono::seconds(20);

bool usable(PGconn* conn) {
    if (PQstatus(conn) != CONNECTION_OK) return false;
    if (Clock::now() - idle.since < recheckAfter) return true;
    PGresult* result = PQexec(conn, "SELECT 1");
    const bool ok = result && PQresultStatus(result) == PGRES_TUPLES_OK;
    if (result) PQclear(result);
    return ok;
}
PGconn* acquire() {
    if (idle.conn) {
        PGconn* conn = idle.conn;
        idle.conn = nullptr;
        if (usable(conn)) return conn;
        PQfinish(conn);
    }
    PGconn* conn = PQconnectdb(databaseConnectionString().c_str());
    if (!conn || PQstatus(conn) != CONNECTION_OK) {
        if (conn) PQfinish(conn);
        throw Error(503, "database_unavailable", "Database connection unavailable.");
    }
    PQsetClientEncoding(conn, "UTF8");
    if (PGresult* result = PQexec(conn, "SET TIME ZONE 'UTC'")) PQclear(result);
    return conn;
}
void release(PGconn* conn) {
    if (!conn) return;
    bool keep = PQstatus(conn) == CONNECTION_OK;
    if (keep) {
        const auto state = PQtransactionStatus(conn);
        if (state == PQTRANS_INTRANS || state == PQTRANS_INERROR) {
            // A request that stopped mid-transaction must not leak its state to the next one.
            PGresult* result = PQexec(conn, "ROLLBACK");
            keep = result && PQresultStatus(result) == PGRES_COMMAND_OK;
            if (result) PQclear(result);
        } else keep = state == PQTRANS_IDLE;
    }
    if (keep && !idle.conn) { idle.conn = conn; idle.since = Clock::now(); }
    else PQfinish(conn);
}
}
Database::Database() : conn_(acquire(), release) {}
Database::Result Database::query(const std::string& sql, const Params& values) {
    std::vector<const char*> params;
    for (auto& value : values) params.push_back(value.c_str());
    Result r(PQexecParams(conn_.get(), sql.c_str(), static_cast<int>(params.size()), nullptr, params.data(), nullptr, nullptr, 0), PQclear);
    if (!r || (PQresultStatus(r.get()) != PGRES_TUPLES_OK && PQresultStatus(r.get()) != PGRES_COMMAND_OK)) {
        std::string code = r && PQresultErrorField(r.get(),PG_DIAG_SQLSTATE) ? PQresultErrorField(r.get(),PG_DIAG_SQLSTATE) : "";
        if (code == "23505") throw Error(409,"conflict","This record already exists.");
        if (code == "23514" || code == "22P02" || code == "22003") throw Error(422,"validation","Check the submitted values.");
        throw std::runtime_error("Database operation failed (" + code + ").");
    }
    return r;
}
void Database::exec(const std::string& sql, const Params& params) { query(sql,params); }
Json Database::rows(const std::string& sql, const Params& params) {
    auto r = query("WITH cw_records AS (" + sql + ") SELECT COALESCE(json_agg(cw_records),'[]')::text FROM cw_records",params);
    return Json::parse(PQgetvalue(r.get(),0,0));
}
Json Database::one(const std::string& sql, const Params& p) {
    auto data = rows(sql,p);
    if (data.empty()) throw Error(404,"not_found","The requested record could not be found.");
    return std::move(data.front());
}
void Database::script(const std::string& sql) {
    Result r(PQexec(conn_.get(),sql.c_str()),PQclear);
    if (!r || (PQresultStatus(r.get()) != PGRES_COMMAND_OK && PQresultStatus(r.get()) != PGRES_TUPLES_OK))
        throw std::runtime_error("Migration failed: " + std::string(PQerrorMessage(conn_.get())));
}
void migrate(Database& db, const std::filesystem::path& root) {
    Transaction transaction(db);
    db.exec("SELECT pg_advisory_xact_lock(36804360)");
    db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    std::vector<std::filesystem::path> files;
    for (auto& f : std::filesystem::directory_iterator(root / "migrations"))
        if (f.path().extension() == ".sql") files.push_back(f.path());
    std::sort(files.begin(),files.end());
    for (auto& path : files) {
        auto name = path.filename().string();
        if (!db.rows("SELECT version FROM schema_migrations WHERE version=$1",{name}).empty()) continue;
        db.script(readFile(path));
        db.exec("INSERT INTO schema_migrations(version) VALUES($1)",{name});
    }
    transaction.commit();
}
}
