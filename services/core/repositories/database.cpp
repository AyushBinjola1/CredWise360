#include "repositories/database.hpp"
namespace cw {
Database::Database() : conn_(PQconnectdb(setting("DATABASE_URL").c_str()), PQfinish) {
    if (!conn_ || PQstatus(conn_.get()) != CONNECTION_OK) throw Error(503,"database_unavailable","Database connection unavailable.");
    PQsetClientEncoding(conn_.get(), "UTF8");
    exec("SET TIME ZONE 'UTC'");
}
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
