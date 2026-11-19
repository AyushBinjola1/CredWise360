#pragma once
#include "common.hpp"

namespace cw {
class LoanApplication {
    std::string state_;
public:
    explicit LoanApplication(std::string state) : state_(std::move(state)) {}
    bool permits(const std::string& next) const;
    void checkTransition(const std::string& next) const;
};
}
