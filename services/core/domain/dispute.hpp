#pragma once
#include "common.hpp"

namespace cw {
// Ticket lifecycle. Customers and administrators move a ticket only along permitted transitions.
class DisputeTicket {
    std::string state_;
public:
    explicit DisputeTicket(std::string state) : state_(std::move(state)) {}
    bool permits(const std::string& next) const;
    void checkTransition(const std::string& next) const;
    bool closed() const { return state_ == "resolved" || state_ == "rejected" || state_ == "withdrawn"; }
    static bool validCategory(const std::string& category);
};
}
