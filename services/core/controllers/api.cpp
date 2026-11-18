#include "controllers/api.hpp"
#include "services/identity.hpp"
#include "services/assessment.hpp"
#include "services/market.hpp"
namespace cw {
Response dispatch(Database& db, const Request& request) {
    if (request.path == std::vector<std::string>{"health"} && request.method == "GET") {
        auto status = db.one("SELECT count(*)::int AS migrations,(SELECT count(*)::int FROM system_events WHERE kind='initialized') AS initializations FROM schema_migrations");
        status["service"] = "CredWise 360";
        status["storage"] = "PostgreSQL";
        return {status};
    }
    if (auto response=identityRoutes(db,request)) return *response;
    if (auto response=assessmentRoutes(db,request)) return *response;
    if (auto response=marketRoutes(db,request)) return *response;
    throw Error(404,"not_found","No matching API route.");
}
}
