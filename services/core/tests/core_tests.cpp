#include "common.hpp"
#include <iostream>
int main() {
    using namespace cw;
    try {
        if (integer(Json{{"amount",10000}},"amount",1,maxMoney)!=10000) return 1;
        bool rejected=false;
        try { integer(Json{{"amount",-1}},"amount",1,maxMoney); } catch(const Error& e) {rejected=e.status==422;}
        if (!rejected) return 1;
        std::cout<<"Money boundary and validation checks passed.\n";
    } catch(const std::exception& e) {std::cerr<<e.what();return 1;}
}
