#include "services/origination.hpp"
#include "services/assessment.hpp"
#include "services/identity.hpp"
#include "services/market.hpp"
#include "services/servicing.hpp"
#include "services/engagement.hpp"
#include "domain/application.hpp"
#include "security/accounts.hpp"
#include "security/credentials.hpp"
#include "security/synthetic_document.hpp"
#include <charconv>
#include <map>
#include <set>

namespace cw {
namespace {
std::string idOf(const Json& row) { return row.at("id").dump(); }
std::string ownerOf(const Json& row) { return row.at("user_id").dump(); }
std::string numericId(const std::string& input) {
    std::int64_t value = 0;
    auto [end,error] = std::from_chars(input.data(),input.data()+input.size(),value);
    require(error == std::errc() && end == input.data()+input.size() && value >= 1,"Enter a valid record number.");
    return std::to_string(value);
}
Json application(Database& db,const std::string& id,const std::string& owner,bool lock=false) {
    return db.one(std::string(R"(
        SELECT a.*,u.name AS applicant_name,p.name AS product_name FROM loan_applications a
        JOIN users u ON u.id=a.user_id JOIN loan_products p ON p.slug=a.product_slug
        WHERE a.id=$1 AND ($2='' OR a.user_id=NULLIF($2,'')::bigint))") + (lock ? " FOR UPDATE OF a" : ""),{id,owner});
}
void profileLock(Database& db,const std::string& uid) {
    db.one("SELECT user_id FROM financial_profiles WHERE user_id=$1 FOR UPDATE",{uid});
}
Json kyc(Database& db,const std::string& uid) {
    auto rows=db.rows("SELECT status,reason,updated_at FROM kyc_records WHERE user_id=$1",{uid});
    return rows.empty()?Json(nullptr):rows.front();
}
Json documents(Database& db,const std::string& id) {
    return db.rows(R"(SELECT d.id,ad.kind,d.name,d.mime,octet_length(d.contents) AS size,d.sha256
        FROM application_documents ad JOIN synthetic_documents d ON d.id=ad.document_id
        WHERE ad.application_id=$1 ORDER BY ad.kind)",{id});
}
Json document(Database& db,const std::string& id,const std::string& docId) {
    return db.one(R"(SELECT d.name,d.mime,replace(encode(d.contents,'base64'),chr(10),'') AS content_base64
        FROM application_documents a JOIN synthetic_documents d ON d.id=a.document_id
        WHERE a.application_id=$1 AND d.id=$2)",{id,docId});
}
Json signalEvidence(Database& db,const std::string& uid) {
    Json alerts=Json::array();
    auto counts=db.one(R"(SELECT
        (SELECT count(*) FROM kyc_records peer JOIN kyc_records own ON own.pan=peer.pan
         WHERE own.user_id=$1 AND peer.user_id<>own.user_id) AS matches,
        (SELECT count(*) FROM loan_applications WHERE user_id=$1 AND submitted_at>now()-interval '1 hour') AS recent)",{uid});
    if (counts.at("matches").get<int>()>0)
        alerts.push_back({{"rule","shared_synthetic_identity"},{"severity","review"},
                          {"evidence","Another simulated account reported the same synthetic PAN."}});
    if (counts.at("recent").get<int>()>=3)
        alerts.push_back({{"rule","repeated_submissions"},{"severity","review"},
                          {"evidence",counts.at("recent").dump()+" applications submitted in the past hour."}});
    return alerts;
}
std::string financialFingerprint(const Json& profile) {
    return security::digest(profile.at("effective_profile").dump());
}
Json snapshot(Database&,const Json&);
std::string previewKey(const Json&,const Json&);
Json detail(Database& db,Json row,bool admin) {
    const auto id=idOf(row), uid=ownerOf(row);
    auto recovery=row.at("recovery");
    auto profile=getProfile(db,uid);
    bool stale=false;
    if ((row.at("status")=="draft" || row.at("status")=="requires_information") && !row.at("preview_token").is_null()) {
        stale=row.at("preview_token")!=previewKey(row,snapshot(db,row));
        if (stale) {
            row["preview_token"]=nullptr;
            row["assessment"]=nullptr;
        }
    }
    if (recovery.is_object()) recovery["reassessment_eligible"]=row.at("status")=="rejected" &&
        row.at("rejected_profile_hash")!=financialFingerprint(profile);
    auto result=Json{
        {"documents",documents(db,id)},{"assessment",row.at("assessment")},{"offer",row.at("offer")},
        {"recovery",recovery},{"preview_stale",stale},{"kyc",kyc(db,uid)},{"profile",profile},{"credit",assess(db,uid,false)},
        {"required_documents",loadProduct(db,row.at("product_slug"))->terms().at("documents")},
        {"fraud_alerts",admin?signalEvidence(db,uid):Json::array()},
        {"timeline",db.rows(R"(SELECT e.id,e.status,e.action,e.note,COALESCE(u.name,'Automated assessment') AS actor_name,e.created_at
            FROM application_events e LEFT JOIN users u ON u.id=e.actor_id WHERE e.application_id=$1 ORDER BY e.id)",{id})}
    };
    for (const auto* internal:{"assessment","offer","recovery","rejected_profile_hash"}) row.erase(internal);
    result["application"]=std::move(row);
    return result;
}
void activity(Database& db,const Json& row,const std::string& actor,const std::string& action,const std::string& message) {
    db.exec("INSERT INTO application_events(application_id,actor_id,action,status,note) VALUES($1,NULLIF($2,'')::bigint,$3,$4,$5)",
            {idOf(row),actor,action,row.at("status"),message});
    identityAudit(db,actor,ownerOf(row),"application."+action,{{"application_id",row.at("id")},{"status",row.at("status")}});
    static const std::map<std::string,std::string> titles={
        {"approved","Your loan application was approved"},{"rejected","Your loan application needs attention"},
        {"information_requested","More information is needed"},{"activated","Your loan is now active"},
        {"closed","Your loan is fully repaid"},{"defaulted","A loan was recorded as defaulted"}};
    if (auto title=titles.find(action);title!=titles.end())
        notify(db,ownerOf(row),"application",title->second,message,"/app/applications/"+idOf(row));
}
void transition(Database& db,Json& row,const std::string& next,const std::string& actor,const std::string& action,const std::string& note) {
    LoanApplication(row.at("status")).checkTransition(next);
    db.exec("UPDATE loan_applications SET status=$2,revision=revision+1,updated_at=now() WHERE id=$1",{idOf(row),next});
    row["status"]=next;
    activity(db,row,actor,action,note);
}
Json snapshot(Database& db,const Json& row) {
    auto result=productAssessment(db,ownerOf(row),row.at("product_slug"),row.at("principal"),row.at("months"),row.at("purpose"));
    auto credit=assess(db,ownerOf(row),false);
    credit.erase("history");
    credit.erase("change");
    credit.erase("prior_score");
    result["credit"]=std::move(credit);
    auto identity=kyc(db,ownerOf(row));
    result["kyc_status"]=identity.is_null()?Json("not_started"):identity.at("status");
    return result;
}
std::string previewKey(const Json& row,const Json& evaluation) {
    return security::digest(Json{{"application",row.at("id")},{"purpose",row.at("purpose")},
                                 {"evaluation",evaluation}}.dump());
}
void validateDocs(const Json& required,const Json& provided) {
    std::set<std::string> labels;
    for (const auto& item:provided) labels.insert(item.at("kind").get<std::string>());
    for (const auto& label:required)
        require(labels.contains(label.get<std::string>()),"Upload the required document: "+label.get<std::string>()+".");
}
void editable(const Json& row) {
    if (row.at("status")!="draft" && row.at("status")!="requires_information")
        throw Error(409,"application_state","Only a draft or an information request can be edited.");
}
void updateDraft(Database& db,Json& row,const Json& body,const std::string& actor) {
    editable(row);
    require(!body.empty(),"Choose a draft field to update.");
    if (body.contains("revision") && row.at("revision")!=body.at("revision"))
        throw Error(409,"revision_changed","Reload the latest draft before saving.");
    for (const auto& [key,value]:body.items())
        require(key=="revision"||key=="product_slug"||key=="principal"||key=="months"||key=="purpose"||key=="documents",
                "Unknown draft field.");
    std::string slug=body.contains("product_slug")?field(body,"product_slug",36):row.at("product_slug").get<std::string>();
    auto term=loadProduct(db,slug)->publicTerms();
    Money principal=body.contains("principal")?integer(body,"principal",1,maxMoney):row.at("principal").get<Money>();
    int months=body.contains("months")?int(integer(body,"months",1,600)):row.at("months").get<int>();
    auto purpose=body.contains("purpose")?field(body,"purpose",240,true):row.at("purpose").get<std::string>();
    bool productChanged=row.at("product_slug")!=slug;
    bool changed=productChanged || row.at("principal")!=principal || row.at("months")!=months || row.at("purpose")!=purpose;
    if (productChanged) db.exec("DELETE FROM application_documents WHERE application_id=$1",{idOf(row)});
    db.exec(R"(UPDATE loan_applications SET product_slug=$2,principal=$3,months=$4,purpose=$5,
               preview_token=CASE WHEN $6::boolean THEN NULL ELSE preview_token END,
               assessment=CASE WHEN $6::boolean THEN NULL ELSE assessment END,
               revision=revision+1,updated_at=now() WHERE id=$1)",
            {idOf(row),slug,std::to_string(principal),std::to_string(months),purpose,changed?"true":"false"});
    if (body.contains("documents")) {
        const auto& submitted=body.at("documents");
        require(submitted.is_array() && !submitted.empty() && submitted.size()<=8,"Attach one or more required documents.");
        for (const auto& doc:submitted) {
            auto kind=field(doc,"kind",120);
            const auto& allowed=term.at("documents");
            require(std::find(allowed.begin(),allowed.end(),Json(kind))!=allowed.end(),"Choose a document required by this product.");
            auto stored=storeSyntheticDocument(db,ownerOf(row),doc);
            db.exec(R"(INSERT INTO application_documents(application_id,user_id,kind,document_id) VALUES($1,$2,$3,$4)
                ON CONFLICT(application_id,kind) DO UPDATE SET document_id=excluded.document_id)",{idOf(row),ownerOf(row),kind,idOf(stored)});
        }
    }
    activity(db,row,actor,"draft_saved",body.contains("documents")?"Saved synthetic application evidence.":"Saved the updated request.");
}
std::string tracking() { return "CW-"+security::token(7); }
void submit(Database& db,Json& row,const Request& req,bool again) {
    if (row.at("status")!=(again?"requires_information":"draft"))
        throw Error(409,"application_state","This application cannot be submitted in its current state.");
    require(req.body.value("confirmed",false),"Confirm the quoted terms before submitting.");
    auto evaluation=snapshot(db,row);
    require(evaluation.at("kyc_status")=="verified","Complete simulated identity verification before submitting.");
    require(!row.at("purpose").get<std::string>().empty(),"Describe the purpose of the loan.");
    validateDocs(evaluation.at("product").at("documents"),documents(db,idOf(row)));
    const auto token=field(req.body,"preview_token",64);
    if (row.at("preview_token")!=token || previewKey(row,evaluation)!=token)
        throw Error(409,"quote_changed","Refresh and confirm the current application preview.");
    const auto id=idOf(row), uid=ownerOf(row);
    db.exec("UPDATE loan_applications SET tracking_id=COALESCE(tracking_id,$2),submitted_at=COALESCE(submitted_at,now()) WHERE id=$1",
            {id,tracking()});
    transition(db,row,"submitted",uid,again?"resubmitted":"submitted","The borrower confirmed the quoted terms and submitted the evidence.");
    recordCreditInquiry(db,uid,id);
    evaluation=snapshot(db,row);
    db.exec("UPDATE loan_applications SET assessment=$2::jsonb WHERE id=$1",{id,evaluation.dump()});
    transition(db,row,"under_review","","automated_assessment",evaluation.at("eligible")==true
               ?"The product checks ran. An underwriter will review the supporting evidence."
               :"The product checks identified eligibility concerns for the underwriter.");
}
std::string rupees(Money amount) {
    return "INR "+std::to_string(amount/100)+"."+std::to_string(100+amount%100).substr(1);
}
Json recoveryPlan(Database& db,const Json& row,const Json& a,const std::string& note,const std::string& reasonCode) {
    Json reasons={note}, codes={reasonCode}, milestones=Json::array(), alternatives=Json::array();
    const auto& product=a.at("product");
    const auto& credit=a.at("credit");
    const auto profile=getProfile(db,ownerOf(row));
    auto milestone=[&](std::string code,std::string title,std::string detail) {
        if (std::find(codes.begin(),codes.end(),Json(code))==codes.end()) codes.push_back(code);
        reasons.push_back(detail);
        milestones.push_back({{"title",title},{"detail",detail}});
    };
    auto emi=a.at("quote").at("emi").get<Money>(),capacity=credit.at("capacity").get<Money>();
    if (emi>capacity) milestone("affordability","Test a manageable monthly instalment",
        "The proposed EMI exceeds available monthly capacity by "+rupees(emi-capacity)+". Test a lower principal or updated commitments.");
    if (product.at("min_income")>profile.at("metrics").at("income"))
        milestone("income_requirement","Review recurring income","This product requires monthly income of at least "+rupees(product.at("min_income"))+".");
    if (credit.at("score").is_null()) milestone("limited_evidence","Provide available repayment evidence",
        "A reviewer can consider consented evidence of rent, utilities or consistent income.");
    else if (credit.at("score")<product.at("min_score")) milestone("score_threshold","Explore a credit scenario",
        "The product's simulated reference score is "+product.at("min_score").dump()+". Review the digital twin factor breakdown.");
    if (milestones.empty()) milestones.push_back({{"title","Review the decision note"},{"detail","Update the relevant profile evidence or request a human reconsideration with supporting context."}});
    for (auto& candidate:db.rows("SELECT * FROM loan_products WHERE slug<>$1 ORDER BY display_order",{row.at("product_slug")})) {
        auto loan=LoanFactory::make(std::move(candidate));
        if (!loan->matchesPurpose(row.at("purpose"))) continue;
        auto other=loan->evaluate(row.at("principal"),row.at("months"),row.at("purpose"),&profile,&credit);
        if (other.at("eligible")==true) alternatives.push_back({{"slug",other["product"]["slug"]},{"name",other["product"]["name"]}});
    }
    return {{"reason_codes",codes},{"reasons",reasons},{"milestones",milestones},{"alternatives",alternatives},{"reassessment_eligible",false}};
}

void decide(Database& db,Json& row,const std::string& reviewer,const Json& body) {
    auto action=field(body,"action",32),note=field(body,"note",600);
    const auto id=idOf(row);
    if (row.at("status")!="under_review" && row.at("status")!="submitted")
        throw Error(409,"application_state","This case is outside the underwriting queue.");
    auto evaluation=snapshot(db,row);
    auto code=body.contains("reason_code")?field(body,"reason_code",48):"underwriting_review";
    require(std::all_of(code.begin(),code.end(),[](char c){return (c>='a'&&c<='z')||(c>='0'&&c<='9')||c=='_';}),
            "Select a valid decision reason code.");
    if (row.at("status")=="submitted") transition(db,row,"under_review",reviewer,"review_started","The underwriter opened the case.");
    if (action=="approve") {
        require(evaluation.at("eligible")==true,"Resolve the product eligibility concerns before approving.");
        require(evaluation.at("kyc_status")=="verified","Verified synthetic KYC is required for approval.");
        validateDocs(evaluation.at("product").at("documents"),documents(db,id));
        db.exec(R"(UPDATE loan_applications SET offer_revision=offer_revision+1,recovery=NULL,
            offer=jsonb_build_object('version',offer_revision+1,'quote',$2::jsonb,'product',$3::jsonb,'issued_at',now())
            WHERE id=$1)",{id,evaluation.at("quote").dump(),evaluation.at("product").dump()});
        transition(db,row,"approved",reviewer,"approved",note);
    } else if (action=="reject") {
        auto recovery=recoveryPlan(db,row,evaluation,note,code);
        auto fingerprint=financialFingerprint(getProfile(db,ownerOf(row)));
        db.exec("UPDATE loan_applications SET recovery=$2::jsonb,rejected_profile_hash=$3,offer=NULL WHERE id=$1",{id,recovery.dump(),fingerprint});
        transition(db,row,"rejected",reviewer,"rejected",note);
    } else if (action=="request_information") {
        db.exec("UPDATE loan_applications SET preview_token=NULL,offer=NULL WHERE id=$1",{id});
        transition(db,row,"requires_information",reviewer,"information_requested",note);
    } else if (action=="escalate" || action=="review") {
        db.exec("UPDATE loan_applications SET escalated=escalated OR $2::boolean,revision=revision+1,updated_at=now() WHERE id=$1",
                {id,action=="escalate"?"true":"false"});
        activity(db,row,reviewer,action=="escalate"?"escalated":"review_note",note);
    } else throw Error(422,"validation","Choose a supported underwriting action.");
    db.exec("UPDATE loan_applications SET reviewer_id=$2,assessment=$3::jsonb WHERE id=$1",{id,reviewer,evaluation.dump()});
    db.exec(R"(INSERT INTO application_decisions(application_id,reviewer_id,action,note,reason_code,assessment)
        VALUES($1,$2,$3,$4,$5,$6::jsonb))",{id,reviewer,action,note,code,evaluation.dump()});
}

void fund(Database& db,Json& row) {
    if (!row.at("loan_id").is_null() && (row.at("status")=="active" || row.at("status")=="closed" || row.at("status")=="defaulted")) return;
    LoanApplication(row.at("status")).checkTransition("disbursed");
    const auto id=idOf(row), uid=ownerOf(row);
    auto identity=kyc(db,uid), profile=getProfile(db,uid),credit=assess(db,uid,false);
    const auto& offer=row.at("offer");
    auto product=LoanFactory::make(offer.at("product"));
    auto fresh=product->evaluate(row.at("principal"),row.at("months"),row.at("purpose"),&profile,&credit);
    if (identity.is_null() || identity.at("status")!="verified" || fresh.at("eligible")!=true) {
        db.exec("UPDATE loan_applications SET offer=NULL,assessment=$2::jsonb WHERE id=$1",
                {id,snapshot(db,row).dump()});
        transition(db,row,"under_review","","funding_review","Current identity or affordability evidence needs a new underwriting review before simulated disbursement.");
        return;
    }
    const auto loanId=openLoan(db,row,offer.at("quote"),offer.at("product"));
    db.exec("UPDATE loan_applications SET loan_id=$2 WHERE id=$1",{id,std::to_string(loanId)});
    transition(db,row,"disbursed",uid,"disbursed","Simulated proceeds were recorded under the accepted offer.");
    transition(db,row,"active","","activated","The active loan and dated repayment schedule are available.");
    recordProfileAssessment(db,uid,getProfile(db,uid).at("profile"));
}
void borrowerAction(Database& db,Json& row,const Request& req,const std::string& action) {
    const auto id=idOf(row),uid=ownerOf(row);
    if (action=="preview") {
        editable(row);
        require(!row.at("purpose").get<std::string>().empty(),"Describe the loan purpose before requesting a preview.");
        auto evaluation=snapshot(db,row);
        db.exec("UPDATE loan_applications SET assessment=$2::jsonb,preview_token=$3 WHERE id=$1",
                {id,evaluation.dump(),previewKey(row,evaluation)});
    } else if (action=="submit" || action=="resubmit") submit(db,row,req,action=="resubmit");
    else if (action=="withdraw") transition(db,row,"withdrawn",uid,"withdrawn","The borrower withdrew the application.");
    else if (action=="accept") {
        LoanApplication(row.at("status")).checkTransition("accepted");
        require(req.body.value("confirmed",false),"Confirm the simulated offer and its repayment terms.");
        if (!req.body.contains("offer_version") || req.body.at("offer_version")!=row.at("offer").at("version"))
            throw Error(409,"offer_changed","Review the latest offered terms before accepting.");
        transition(db,row,"accepted",uid,"accepted","The borrower accepted the frozen product terms and repayment schedule.");
    } else if (action=="disburse") fund(db,row);
    else if (action=="reassess" || action=="appeal") {
        if (row.at("status")!="rejected") throw Error(409,"application_state","Only rejected applications can request reconsideration.");
        std::string note="The borrower submitted updated financial information for reassessment.";
        if (action=="reassess") {
            const auto fingerprint=financialFingerprint(getProfile(db,uid));
            if (row.at("rejected_profile_hash")==fingerprint)
                throw Error(409,"evidence_unchanged","Update the relevant profile information, or appeal the existing decision.");
        } else note=field(req.body,"note",600);
        auto evaluation=snapshot(db,row);
        db.exec("UPDATE loan_applications SET assessment=$2::jsonb,escalated=$3::boolean WHERE id=$1",
                {id,evaluation.dump(),action=="appeal"?"true":"false"});
        transition(db,row,"under_review",uid,action=="appeal"?"human_review_requested":"reassessment_requested",note);
    } else throw Error(404,"not_found","Unknown application action.");
}
Json list(Database& db,const Request& req,const std::string& uid,bool admin) {
    auto param=[&](const char* key,const std::string& fallback=""){
        auto it=req.query.find(key);return it==req.query.end()?fallback:it->second;
    };
    auto page=std::stoll(numericId(param("page","1"))),size=std::stoll(numericId(param("page_size","25")));
    require(page<=1000000 && size<=100,"Choose a supported page and page size.");
    const auto priority=param("priority");
    require(priority.empty() || priority=="escalated","Choose a valid priority.");
    const std::string source=R"( FROM loan_applications a JOIN loan_products p ON p.slug=a.product_slug
        JOIN users u ON u.id=a.user_id WHERE ($1='' OR a.user_id=NULLIF($1,'')::bigint)
        AND ($2='' OR a.status=$2) AND ($3='' OR a.product_slug=$3)
        AND ($4='' OR a.assessment->'credit'->>'risk'=$4) AND ($5='' OR a.escalated)
        AND ($6='' OR strpos(lower(concat_ws(' ',a.tracking_id,a.purpose,u.name,u.email,p.name)),lower($6))>0))";
    Params values={uid,param("status"),param("product"),param("risk"),priority,param("q")};
    for (const auto& value:values) require(value.size()<=160,"Shorten the queue filter.");
    const auto total=db.one("SELECT count(*) AS total"+source,values).at("total");
    std::string order=admin?
        " ORDER BY (a.status IN ('submitted','under_review')) DESC,a.escalated DESC,a.submitted_at ASC NULLS LAST,a.id":
        " ORDER BY a.updated_at DESC,a.id DESC";
    // An explicit sort replaces the default queue order. Only whitelisted columns are ever placed in the query text.
    const auto sort=param("sort"),direction=param("dir","asc");
    if (!sort.empty()) {
        static const std::map<std::string,std::string> columns={{"amount","a.principal"},{"status","a.status"},{"updated","a.updated_at"},
            {"applicant","u.name"},{"product","p.name"},{"submitted","a.submitted_at"}};
        const auto column=columns.find(sort);
        require(column!=columns.end(),"Choose a valid sort column.");
        require(direction=="asc"||direction=="desc","Choose a valid sort direction.");
        order=" ORDER BY "+column->second+(direction=="asc"?" ASC":" DESC")+" NULLS LAST,a.id DESC";
    }
    values.emplace_back(std::to_string(size));values.emplace_back(std::to_string((page-1)*size));
    auto items=db.rows(R"(SELECT a.id,a.user_id,a.product_slug,a.principal,a.months,a.purpose,a.status,a.tracking_id,
        a.loan_id,a.escalated,a.revision,a.created_at,a.updated_at,a.submitted_at,u.name AS applicant_name,
        p.name AS product_name,a.assessment->'credit'->>'risk' AS risk)"+source+order+" LIMIT $7 OFFSET $8",values);
    return {{"items",items},{"total",total},{"page",page},{"page_size",size}};
}
}

void closeLoanApplication(Database& db,const std::string& id,const std::string& actor,bool defaulted) {
    auto row=application(db,id,"",true);
    auto target=defaulted?"defaulted":"closed";
    if (row.at("status")==target) return;
    transition(db,row,target,actor,target,defaulted?"The servicing review recorded a default.":"The loan principal and outstanding charges are fully settled.");
}
void reconsiderApplication(Database& db,const std::string& id,const std::string& actor,const std::string& note) {
    auto owner=ownerOf(application(db,id,""));
    profileLock(db,owner);
    auto row=application(db,id,"",true);
    if (row.at("status")!="rejected") throw Error(409,"application_state","Only a rejected application can be reconsidered.");
    db.exec("UPDATE loan_applications SET assessment=$2::jsonb,escalated=true WHERE id=$1",{id,snapshot(db,row).dump()});
    transition(db,row,"under_review",actor,"reconsideration_requested",note);
}
std::optional<Response> originationRoutes(Database& db,const Request& req) {
    if (req.path.empty()) return std::nullopt;
    const bool admin=req.path.size()>=2 && req.path[0]=="admin" && req.path[1]=="applications";
    if (!admin && req.path[0]!="applications") return std::nullopt;
    const size_t base=admin?2:1;
    auto actor=authenticate(db,req,admin?Permission::administration:Permission::customerWorkspace);
    const auto actorId=idOf(actor),scope=admin?std::string():actorId;
    if (req.method=="GET") {
        Transaction tx(db);
        db.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
        Json result;
        if (req.path.size()==base) result=list(db,req,scope,admin);
        else {
            const auto id=numericId(req.path[base]);
            auto row=application(db,id,scope);
            if (req.path.size()==base+1) result=detail(db,std::move(row),admin);
            else if (req.path.size()==base+3 && req.path[base+1]=="documents") result=document(db,id,numericId(req.path[base+2]));
            else return std::nullopt;
        }
        tx.commit();
        return Response{std::move(result)};
    }
    if (req.path.size()==base && req.method=="POST" && !admin) {
        const auto slug=field(req.body,"product_slug",36);
        auto product=loadProduct(db,slug);
        const auto& terms=product->terms();
        const auto principal=req.body.contains("principal")?integer(req.body,"principal",1,maxMoney):terms.at("min_amount").get<Money>();
        const auto months=req.body.contains("months")?integer(req.body,"months",1,600):terms.at("min_months").get<int>();
        auto purpose=field(req.body,"purpose",240,true);
        Transaction tx(db);
        profileLock(db,actorId);
        const auto saved=db.one("INSERT INTO loan_applications(user_id,product_slug,principal,months,purpose) VALUES($1,$2,$3,$4,$5) RETURNING id",
                                {actorId,slug,std::to_string(principal),std::to_string(months),purpose});
        auto row=application(db,idOf(saved),scope);
        activity(db,row,actorId,"draft_created","Started a new application draft.");
        if (req.body.contains("documents")) updateDraft(db,row,{{"documents",req.body.at("documents")}},actorId);
        auto result=detail(db,application(db,idOf(saved),scope),false);
        tx.commit();
        return Response{result,201};
    }
    if (req.path.size()<=base) return std::nullopt;
    const auto id=numericId(req.path[base]);
    auto row=application(db,id,scope);
    const bool edit=!admin && req.method=="PUT" && req.path.size()==base+1;
    const bool act=req.method=="POST" && req.path.size()==base+2;
    if (!edit && !act) return std::nullopt;
    Transaction tx(db);
    profileLock(db,ownerOf(row));
    row=application(db,id,scope,true);
    db.one("SELECT slug FROM loan_products WHERE slug=$1 FOR SHARE",{row.at("product_slug")});
    db.exec("SELECT pg_advisory_xact_lock_shared(36804362)");
    if (edit) updateDraft(db,row,req.body,actorId);
    else if (admin) {
        if (req.path.back()!="decision") return std::nullopt;
        decide(db,row,actorId,req.body);
    } else borrowerAction(db,row,req,req.path.back());
    auto result=detail(db,application(db,id,scope),admin);
    tx.commit();
    return Response{result};
}
}
