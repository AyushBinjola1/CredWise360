#pragma once
#include "repositories/database.hpp"
#include <map>
namespace cw {
struct Request {
    std::string method;
    std::vector<std::string> path;
    Json body;
    std::map<std::string,std::string> query;
    std::string session;
    std::string remote;
};
struct Response {
    Json data;
    int status = 200;
    std::string cookie;
};
Response dispatch(Database&, const Request&);
}
