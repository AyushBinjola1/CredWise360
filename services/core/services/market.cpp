#include "services/market.hpp"
#include "security/accounts.hpp"
#include "services/assessment.hpp"
#include "services/identity.hpp"
#include <set>

namespace cw {
namespace {
Json readProduct(Database& db, const std::string& slug, bool lock = false) {
    return db.one(std::string("SELECT * FROM loan_products WHERE slug=$1") + (lock ? " FOR UPDATE" : ""), {slug});
}
Json allProducts(Database& db) {
    return db.rows("SELECT * FROM loan_products ORDER BY display_order");
}
std::vector<std::string> stringList(const Json& values, std::size_t maximum, std::size_t width) {
    require(values.is_array() && !values.empty() && values.size() <= maximum,"Choose a supported number of entries.");
    std::vector<std::string> list;
    std::set<std::string> distinct;
    for (const auto& value : values) {
        require(value.is_string(),"Enter text for each list entry.");
        auto text = value.get<std::string>();
        require(text.find_first_not_of(" \t\r\n") != std::string::npos && text.size() <= width &&
                text.find('\0') == std::string::npos && distinct.insert(text).second,
                "Each entry must be nonblank, unique and within the length limit.");
        list.push_back(std::move(text));
    }
    return list;
}
Json compareProducts(Database& db, const Json& body) {
    require(body.contains("slugs"),"Choose one to four products for comparison.");
    const auto slugs = stringList(body.at("slugs"),4,36);
    auto principal = integer(body,"principal",1,maxMoney);
    int commonMonths = static_cast<int>(integer(body,"months",1,600));
    const Json terms = body.value("terms",Json::object());
    require(terms.is_object(),"Provide repayment terms indexed by product.");
    for (const auto& [slug,value] : terms.items())
        require(std::find(slugs.begin(),slugs.end(),slug) != slugs.end(),"Set terms only for selected products.");
    Json items = Json::array();
    Transaction tx(db);
    db.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    for (const auto& slug : slugs) {
        auto months = terms.contains(slug) ? static_cast<int>(integer(terms,slug,1,600)) : commonMonths;
        items.push_back(loadProduct(db,slug)->evaluate(principal,months,""));
    }
    tx.commit();
    return {{"items",std::move(items)}};
}
Json recommended(Database& db, const std::string& id, const Json& body) {
    auto purpose = field(body,"purpose",240);
    auto principal = integer(body,"principal",1,maxMoney);
    auto months = static_cast<int>(integer(body,"months",1,600));
    Transaction tx(db);
    db.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    auto profile = getProfile(db,id), credit = assess(db,id,false);
    Json items = Json::array(), alternatives = Json::array();
    for (auto& row : allProducts(db)) {
        auto item = LoanFactory::make(std::move(row))->evaluate(principal,months,purpose,&profile,&credit);
        (item.at("eligible").get<bool>() ? items : alternatives).push_back(std::move(item));
    }
    auto rank = [](const Json& a,const Json& b) {
        if (a.at("compatibility") != b.at("compatibility")) return a.at("compatibility") > b.at("compatibility");
        if (a.at("quote").at("total_cost") != b.at("quote").at("total_cost"))
            return a.at("quote").at("total_cost") < b.at("quote").at("total_cost");
        return a.at("product").at("display_order") < b.at("product").at("display_order");
    };
    std::sort(items.begin(),items.end(),rank);
    std::sort(alternatives.begin(),alternatives.end(),rank);
    tx.commit();
    return {{"items",std::move(items)},{"alternatives",std::move(alternatives)}};
}
void checkProductChanges(Json& row, const Json& body) {
    static const std::map<std::string,std::pair<Money,Money>> limits = {
        {"min_amount",{1,maxMoney}},{"max_amount",{1,maxMoney}},{"min_months",{1,600}},{"max_months",{1,600}},
        {"rate_bps",{0,6000}},{"fee_bps",{0,5000}},{"fee_cap",{0,maxMoney}},{"min_income",{0,maxMoney}},
        {"max_emi_percent",{1,100}},{"min_score",{300,900}},{"min_stability_months",{0,1200}},
        {"prepayment_from_month",{1,600}},{"prepayment_fee_bps",{0,5000}},{"late_fee",{0,maxMoney}},{"grace_days",{0,180}}
    };
    require(!body.empty(),"Choose a product setting to update.");
    for (const auto& [key,value] : body.items()) {
        if (key == "base_updated_at") {
            if (value != row.at("updated_at")) throw Error(409,"product_changed","Reload the latest product terms before saving.");
            continue;
        }
        if (auto limit = limits.find(key); limit != limits.end()) row[key] = integer(body,key,limit->second.first,limit->second.second);
        else if (key == "name" || key == "description" || key == "collateral" || key == "risk_policy")
            row[key] = field(body,key,key == "name" ? 100 : 600);
        else if (key == "documents" || key == "purposes") row[key] = stringList(value,20,160);
        else if (key == "method") {
            require(value == "reducing" || value == "flat","Choose reducing or flat interest.");
            row[key] = value;
        } else throw Error(422,"validation","Unknown or read-only product setting.");
    }
    require(row.at("min_amount") <= row.at("max_amount"),"The maximum principal must cover the minimum.");
    require(row.at("min_months") <= row.at("max_months"),"The maximum tenure must cover the minimum.");
}
Json updateProduct(Database& db, const std::string& admin, const std::string& slug, const Json& body) {
    Transaction tx(db);
    const auto previous = readProduct(db,slug,true);
    auto next = previous;
    checkProductChanges(next,body);
    if (next != previous) {
        db.exec(R"(
            UPDATE loan_products p SET name=n.name,description=n.description,purposes=n.purposes,documents=n.documents,
                collateral=n.collateral,min_amount=n.min_amount,max_amount=n.max_amount,min_months=n.min_months,
                max_months=n.max_months,rate_bps=n.rate_bps,fee_bps=n.fee_bps,fee_cap=n.fee_cap,method=n.method,
                min_income=n.min_income,max_emi_percent=n.max_emi_percent,min_score=n.min_score,
                min_stability_months=n.min_stability_months,prepayment_from_month=n.prepayment_from_month,
                prepayment_fee_bps=n.prepayment_fee_bps,late_fee=n.late_fee,grace_days=n.grace_days,
                risk_policy=n.risk_policy,updated_at=clock_timestamp()
            FROM jsonb_populate_record(NULL::loan_products,$2::jsonb) n WHERE p.slug=$1)",{slug,next.dump()});
        next = readProduct(db,slug);
        db.exec("INSERT INTO product_policy_changes(product_slug,admin_id,previous_policy,policy) VALUES($1,$2,$3::jsonb,$4::jsonb)",
                {slug,admin,previous.dump(),next.dump()});
        identityAudit(db,admin,"","product.updated",{{"slug",slug}});
    }
    tx.commit();
    return LoanFactory::make(std::move(next))->publicTerms();
}
Json calculator(Database& db, const Json& body) {
    if (!body.contains("product_slug")) return quote(body);
    auto product = loadProduct(db,field(body,"product_slug",36));
    const auto& policy = product->terms();
    const auto principal = integer(body,"principal",1,maxMoney);
    auto pricing = product->repaymentPricing(principal);
    Json input = body;
    for (auto key : {"rate_bps","fee_bps","method"}) if (!input.contains(key)) input[key] = policy.at(key);
    const auto fee = EMIEngine::basisPoints(principal,static_cast<int>(integer(input,"fee_bps",0,5000)));
    const Money cap = policy.at("fee_cap");
    pricing.processingFee = cap ? std::min(cap,fee) : fee;
    return EMIEngine::calculate(input,pricing);
}
}

std::unique_ptr<Loan> loadProduct(Database& db,const std::string& slug) {
    return LoanFactory::make(readProduct(db,slug));
}
Json productAssessment(Database& db,const std::string& id,const std::string& slug,
                       Money principal,int months,const std::string& purpose) {
    auto profile = getProfile(db,id), credit = assess(db,id,false);
    return loadProduct(db,slug)->evaluate(principal,months,purpose,&profile,&credit);
}
std::optional<Response> marketRoutes(Database& db,const Request& request) {
    const auto& path = request.path;
    if (path.empty()) return std::nullopt;
    if (path[0] == "products" && request.method == "GET") {
        if (path.size() == 2) return Response{loadProduct(db,path[1])->publicTerms()};
        if (path.size() == 1) {
            Json items = Json::array();
            for (auto& row : allProducts(db)) items.push_back(LoanFactory::make(std::move(row))->publicTerms());
            return Response{{{"items",std::move(items)}}};
        }
    }
    if (path.size() == 1 && request.method == "POST") {
        if (path[0] == "calculate") return Response{calculator(db,request.body)};
        if (path[0] == "compare") return Response{compareProducts(db,request.body)};
        if (path[0] == "recommendations") {
            auto user = authenticate(db,request,Permission::customerWorkspace);
            return Response{recommended(db,user.at("id").dump(),request.body)};
        }
    }
    if (path.size() == 3 && path[0] == "admin" && path[1] == "products" &&
        (request.method == "GET" || request.method == "PUT")) {
        auto admin = authenticate(db,request,Permission::administration);
        if (request.method == "GET") return Response{loadProduct(db,path[2])->publicTerms()};
        blockSharedDemoChange(admin,"product terms");
        return Response{updateProduct(db,admin.at("id").dump(),path[2],request.body)};
    }
    return std::nullopt;
}
}
