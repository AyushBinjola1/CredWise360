#pragma once
#include "controllers/api.hpp"

namespace cw {
// Records an in-app notification. An empty dedupe key always creates a new entry.
void notify(Database&, const std::string& userId, const std::string& kind, const std::string& title,
            const std::string& body, const std::string& link, const std::string& dedupeKey = "");
// Portfolio totals and breakdowns calculated from the ledger, shared by the dashboard, reports and PDF export.
Json portfolioSummary(Database&);
std::optional<Response> engagementRoutes(Database&, const Request&);
}
