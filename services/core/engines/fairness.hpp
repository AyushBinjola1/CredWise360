#pragma once
#include "engines/credit.hpp"

namespace cw {
// Counterfactual auditor: evaluates equivalent synthetic profiles that differ only in irrelevant attributes.
class FairnessAuditor {
    Json policy_;
    std::vector<Json> products_;
public:
    FairnessAuditor(Json policy, std::vector<Json> products) : policy_(std::move(policy)), products_(std::move(products)) {}
    Json run() const;
    static const std::vector<std::string>& excludedAttributes();
};
}
