#include "httplib.h"
#include "controllers/api.hpp"
#include "services/identity.hpp"
#include <atomic>
#include <csignal>
#include <iostream>
#include <sstream>
#include <thread>
namespace {
volatile std::sig_atomic_t stopping = 0;
void stop(int) { stopping = 1; }
std::vector<std::string> parts(const std::string& value,char separator) {
    std::stringstream stream(value);
    std::vector<std::string> result;
    for (std::string piece; std::getline(stream,piece,separator);) if (!piece.empty()) result.push_back(piece);
    return result;
}
std::string sessionToken(const std::string& cookies) {
    for (auto cookie : parts(cookies,';')) {
        auto first=cookie.find_first_not_of(' ');
        if (first!=std::string::npos && cookie.compare(first,3,"cw=")==0) return cookie.substr(first+3);
    }
    return {};
}
}
int main(int argc,char** argv) {
    using namespace cw;
    try {
        if (setting("DATABASE_URL").empty()) throw std::runtime_error("Set DATABASE_URL before starting CredWise.");
        auto databaseRoot=std::filesystem::path(setting("CREDWISE_DB_DIR","database"));
        { Database db; migrate(db,databaseRoot); if (setting("DEMO_MODE")=="1") seedIdentity(db); }
        if (argc>1 && std::string(argv[1])=="--migrate") return 0;
        httplib::Server server;
        server.new_task_queue=[] {return new httplib::ThreadPool(8);};
        server.set_payload_max_length(600*1024);
        server.set_read_timeout(10,0);
        server.set_write_timeout(15,0);
        server.set_default_headers({{"Cache-Control","no-store"},{"X-Content-Type-Options","nosniff"},{"Vary","Cookie"}});
        auto origins=parts(setting("WEB_ORIGINS","http://127.0.0.1:3000,http://localhost:3000"),',');
        auto handler=[&](const httplib::Request& req,httplib::Response& res) {
            Json response;
            try {
                bool write = req.method != "GET";
                if (write) {
                    auto origin=req.get_header_value("Origin");
                    if ((!origin.empty() && std::find(origins.begin(),origins.end(),origin)==origins.end()) ||
                        req.get_header_value("X-CredWise-Action")!="1") throw Error(403,"origin","Request verification failed.");
                    if (req.get_header_value("Content-Type").find("application/json")!=0) throw Error(415,"content_type","Send a JSON request.");
                }
                Json body = req.body.empty() ? Json::object() : Json::parse(req.body);
                require(body.is_object(),"Send a JSON object.");
                Request request{req.method,parts(req.path.substr(5),'/'),body,{},sessionToken(req.get_header_value("Cookie")),req.remote_addr,req.get_header_value("Idempotency-Key")};
                for (auto& [key,value] : req.params) request.query.emplace(key,value);
                Database db;
                auto result=dispatch(db,request);
                res.status=result.status;
                response={{"data",std::move(result.data)}};
                if (!result.cookie.empty()) res.set_header("Set-Cookie",result.cookie);
            } catch (const Error& e) {
                res.status=e.status; response={{"error",{{"code",e.code},{"message",e.what()}}}};
            } catch (const Json::exception&) {
                res.status=422; response={{"error",{{"code","validation"},{"message","Check the JSON fields and value types."}}}};
            } catch (const std::exception& e) {
                std::cerr << "Request failed: " << e.what() << '\n';
                res.status=500; response={{"error",{{"code","internal"},{"message","The operation could not be completed."}}}};
            }
            res.set_content(response.dump(),"application/json; charset=utf-8");
        };
        server.Get("/api/.*",handler); server.Post("/api/.*",handler); server.Put("/api/.*",handler); server.Patch("/api/.*",handler);
        server.set_logger([](const httplib::Request& req,const httplib::Response& res) {
            std::clog << req.method << " " << req.path.substr(0,150) << " " << res.status << '\n';
        });
        auto host=setting("CORE_HOST","127.0.0.1");
        int port=std::stoi(setting("CORE_PORT","8787"));
        if (!server.bind_to_port(host,port)) throw std::runtime_error("Could not bind API port.");
        std::signal(SIGINT,stop); std::signal(SIGTERM,stop);
        std::jthread monitor([&](std::stop_token token) {
            while (!token.stop_requested() && !stopping) std::this_thread::sleep_for(std::chrono::milliseconds(150));
            if (stopping) server.stop();
        });
        std::cout << "CredWise API listening on " << host << ":" << port << std::endl;
        server.listen_after_bind();
    } catch (const std::exception& e) {
        std::cerr << e.what() << '\n'; return 1;
    }
}
