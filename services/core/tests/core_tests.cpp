#include "repositories/database.hpp"
#include <iostream>

namespace {
void setEnv(const char* key, const char* value) {
#ifdef _WIN32
    _putenv_s(key, value);  // An empty value removes the variable on Windows.
#else
    if (*value) setenv(key, value, 1); else unsetenv(key);
#endif
}
void check(bool valid, const char* message) {
    if (!valid) throw std::runtime_error(message);
}
bool rejects(const char* what) {
    try { cw::databaseConnectionString(); } catch (const std::runtime_error&) { return true; }
    (void)what;
    return false;
}
void connectionStrings() {
    using cw::databaseConnectionString;
    setEnv("DATABASE_SSLMODE", ""); setEnv("DATABASE_CONNECT_TIMEOUT", "");
    // Local URL: nothing but a connection timeout is added, and SSL is left to libpq defaults.
    setEnv("DATABASE_URL", "postgresql://credwise@127.0.0.1:55432/credwise");
    check(databaseConnectionString() == "postgresql://credwise@127.0.0.1:55432/credwise?connect_timeout=15", "Local URL should only gain a timeout");
    // Keyword form used by Docker Compose keeps its own timeout.
    setEnv("DATABASE_URL", "connect_timeout=5");
    check(databaseConnectionString() == "connect_timeout=5", "Existing timeout must be preserved");
    // Neon-style URL: SSL is enforced, existing query parameters are kept.
    setEnv("DATABASE_SSLMODE", "require");
    setEnv("DATABASE_URL", "postgresql://user:pw@ep-example.neon.tech/neondb?channel_binding=require");
    check(databaseConnectionString() == "postgresql://user:pw@ep-example.neon.tech/neondb?channel_binding=require&sslmode=require&connect_timeout=15", "SSL mode should be appended");
    // A mode written in the URL wins over the environment, so nobody is silently downgraded or upgraded.
    setEnv("DATABASE_URL", "postgres://user:pw@host/db?sslmode=verify-full");
    check(databaseConnectionString() == "postgres://user:pw@host/db?sslmode=verify-full&connect_timeout=15", "URL sslmode must not be overridden");
    // Keyword strings gain parameters separated by spaces.
    setEnv("DATABASE_URL", "host=db dbname=credwise");
    check(databaseConnectionString() == "host=db dbname=credwise sslmode=require connect_timeout=15", "Keyword form");
    // Invalid configuration is rejected before any connection is attempted.
    setEnv("DATABASE_SSLMODE", "sometimes");
    check(rejects("sslmode"), "Unknown SSL mode accepted");
    setEnv("DATABASE_SSLMODE", "");
    setEnv("DATABASE_CONNECT_TIMEOUT", "soon");
    check(rejects("timeout"), "Non-numeric timeout accepted");
    setEnv("DATABASE_CONNECT_TIMEOUT", "");
    setEnv("DATABASE_URL", "");
    check(rejects("missing"), "Missing DATABASE_URL accepted");
}
}

int main() {
    using namespace cw;
    try {
        if (integer(Json{{"amount",10000}},"amount",1,maxMoney)!=10000) return 1;
        bool rejected=false;
        try { integer(Json{{"amount",-1}},"amount",1,maxMoney); } catch(const Error& e) {rejected=e.status==422;}
        if (!rejected) return 1;
        connectionStrings();
        std::cout<<"Money boundary, validation and database connection checks passed.\n";
    } catch(const std::exception& e) {std::cerr<<e.what()<<'\n';return 1;}
}
