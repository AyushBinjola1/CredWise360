#include "services/servicing.hpp"
#include "domain/repayment.hpp"
#include "security/accounts.hpp"
#include "services/assessment.hpp"
#include "services/identity.hpp"
#include "services/origination.hpp"
#include "services/engagement.hpp"
#include <charconv>
#include <cctype>
#include <set>

namespace cw {
namespace {
const char* headersSql = R"(
 SELECT l.id,l.application_id,l.user_id,u.name AS borrower_name,l.product_slug,l.product_terms->>'name' AS product_name,
        l.principal,l.outstanding,l.emi,l.rate_bps,l.months,l.principal-l.outstanding AS principal_paid,
        l.status,l.opened_on,l.closed_on,l.last_payment_date,l.defaulted_on,l.default_reason,
        coalesce(s.remaining_months,0) AS remaining_months,
        s.next_due_date,coalesce(s.next_due,0)+p.unpaid AS next_amount,
        t.interest_paid,t.fees_paid,t.total_paid,t.ledger_version,
        round(100.0*(l.principal-l.outstanding)/l.principal,2) AS progress
 FROM loans l JOIN users u ON u.id=l.user_id
 CROSS JOIN LATERAL (SELECT greatest((now() AT TIME ZONE 'Asia/Kolkata')::date,l.last_payment_date,l.defaulted_on) AS as_of) clock
 CROSS JOIN LATERAL (
     SELECT count(*) AS remaining_months,min(due_date) AS next_due_date,
            (array_agg(principal-principal_paid+interest-interest_paid ORDER BY month))[1] AS next_due
     FROM repayment_schedules WHERE loan_id=l.id AND active AND paid_on IS NULL) s
 CROSS JOIN LATERAL (
     SELECT coalesce(sum(coalesce(lp.amount-lp.paid,CASE WHEN r.active AND r.paid_on IS NULL
          AND r.due_date + (l.product_terms->>'grace_days')::integer < clock.as_of
          THEN (l.product_terms->>'late_fee')::bigint ELSE 0 END)),0)::bigint AS unpaid
     FROM repayment_schedules r LEFT JOIN loan_penalties lp USING(loan_id,month) WHERE r.loan_id=l.id) p
 CROSS JOIN LATERAL (
     SELECT coalesce(sum(interest),0)::bigint AS interest_paid,coalesce(sum(fee+penalty),0)::bigint AS fees_paid,
            coalesce(sum(CASE WHEN kind='disbursement' THEN fee ELSE amount END),0)::bigint AS total_paid,
            count(*) AS ledger_version FROM repayment_transactions WHERE loan_id=l.id) t
 WHERE ($1='' OR l.user_id=nullif($1,'')::bigint) AND ($2='' OR l.id=nullif($2,'')::bigint))";

std::string identifier(const std::string& value) {
    std::int64_t id = 0;
    const auto [end,error] = std::from_chars(value.data(),value.data()+value.size(),id);
    require(error == std::errc() && end == value.data()+value.size() && id > 0,"Enter a valid loan identifier.");
    return std::to_string(id);
}
Json header(Database& db,const std::string& id,const std::string& owner) { return db.one(headersSql,{owner,id}); }
Json rawLoan(Database& db,const std::string& id,const std::string& owner,bool lock=false) {
    const std::string sql = R"(
      SELECT l.*,greatest((now() AT TIME ZONE 'Asia/Kolkata')::date,l.last_payment_date,l.defaulted_on) AS view_date,
             greatest(l.opened_on,l.last_payment_date,l.defaulted_on) AS first_payment_date
      FROM loans l WHERE l.id=$1 AND ($2='' OR l.user_id=nullif($2,'')::bigint))";
    return db.one(sql+(lock?" FOR UPDATE":""),{id,owner});
}
std::string paymentDate(const Json& l,const Json& body) {
    auto value = body.contains("payment_date") ? field(body,"payment_date",10) : l.at("view_date").get<std::string>();
    auto day = calendarDay(value), opened = calendarDay(l.at("opened_on"));
    require(day >= calendarDay(l.at("first_payment_date")),
            "Choose a date on or after opening and the latest posted account activity.");
    require(day <= monthAnniversary(opened,l.at("months").get<int>()+120),
            "The simulation allows settlement up to ten years after contractual maturity.");
    return value;
}
Json schedule(Database& db,const std::string& id,const std::string& asOf) {
    return db.rows(R"(
     SELECT month,due_date,principal,interest,principal+interest AS payment,balance,principal_paid,interest_paid,
            principal-principal_paid+interest-interest_paid AS remaining,paid_on,
            CASE WHEN paid_on IS NOT NULL THEN 'paid' WHEN due_date<$2::date THEN 'overdue'
                 WHEN principal_paid+interest_paid>0 THEN 'partial' WHEN due_date=$2::date THEN 'due'
                 ELSE 'upcoming' END AS status
     FROM repayment_schedules WHERE loan_id=$1 AND active ORDER BY month)",{id,asOf});
}
Json penalties(Database& db,const std::string& id,const std::string& asOf) {
    return db.rows(R"(
      SELECT r.month,coalesce(p.amount,(l.product_terms->>'late_fee')::bigint) AS amount,coalesce(p.paid,0) AS paid,
             coalesce(p.assessed_on,r.due_date+(l.product_terms->>'grace_days')::int+1) AS assessed_on,
             p.loan_id IS NOT NULL AS posted
      FROM repayment_schedules r JOIN loans l ON r.loan_id=l.id LEFT JOIN loan_penalties p ON
          p.loan_id=r.loan_id AND p.month=r.month
      WHERE r.loan_id=$1 AND (p.loan_id IS NOT NULL OR (r.active AND r.paid_on IS NULL AND
          r.due_date+(l.product_terms->>'grace_days')::int<$2::date)) ORDER BY r.month)",{id,asOf});
}
void assessPenalties(Database& db,const std::string& id,const std::string& asOf) {
    db.exec(R"(
      INSERT INTO loan_penalties(loan_id,month,amount,assessed_on)
      SELECT r.loan_id,r.month,(l.product_terms->>'late_fee')::bigint,r.due_date+(l.product_terms->>'grace_days')::int+1
      FROM repayment_schedules r JOIN loans l ON l.id=r.loan_id WHERE r.loan_id=$1 AND r.active
          AND r.paid_on IS NULL AND r.due_date+(l.product_terms->>'grace_days')::int<$2::date
      ON CONFLICT (loan_id,month) DO NOTHING)",{id,asOf});
}
Json ledger(Database& db,const std::string& id,const std::string& txId="") {
    return db.rows(R"(
     SELECT id,'CW-T-'||id AS reference,kind,amount,principal,interest,penalty,fee,payment_date,allocations,created_at
     FROM repayment_transactions WHERE loan_id=$1 AND ($2='' OR id=nullif($2,'')::bigint)
     ORDER BY payment_date DESC,id DESC)",{id,txId});
}
Json payoff(const Json& loan,const Json& rows,const Json& fees,const std::string& asOf,Money extra,Money version) {
    Money billed=0, late=0, nextPrincipal=0, nextInterest=0, arrears=0;
    bool first=true;
    for (const auto& row:rows) {
        if (!row.at("paid_on").is_null()) continue;
        Money interest=row.at("interest").get<Money>()-row.at("interest_paid").get<Money>();
        if (first) {
            nextPrincipal=row.at("principal").get<Money>()-row.at("principal_paid").get<Money>();
            nextInterest=interest;first=false;
        }
        if (row.at("due_date").get<std::string>()<=asOf) arrears+=row.at("remaining").get<Money>();
        if (row.at("due_date").get<std::string>()<=asOf || row.at("principal_paid")!=0 || row.at("interest_paid")!=0)
            billed+=interest;
    }
    for (const auto& row:fees) late+=row.at("amount").get<Money>()-row.at("paid").get<Money>();
    Money principal=loan.at("outstanding"); const auto& product=loan.at("product_terms");
    const int rate=product.at("prepayment_fee_bps");
    const Money fee=EMIEngine::basisPoints(principal,rate);
    const std::string earliest=isoDate(monthAnniversary(calendarDay(loan.at("opened_on")),product.at("prepayment_from_month").get<int>()-1));
    return {{"as_of",asOf},{"principal",principal},{"interest",billed},{"penalties",late},{"fee",fee},
            {"total",principal+billed+late+fee},{"allowed",loan.at("status")!="closed" && asOf>=earliest},
            {"earliest_prepayment_date",earliest},{"payment_earliest_date",loan.at("first_payment_date")},
            {"next_principal",nextPrincipal},{"next_interest",nextInterest},{"next_amount",nextPrincipal+nextInterest+late},
            {"prepayment_fee",EMIEngine::basisPoints(extra,rate)},{"prepayment_total",extra+EMIEngine::basisPoints(extra,rate)+(extra==principal?billed+late:0)},
            {"scheduled_due",arrears},{"prepayment_allowed",loan.at("status")!="closed" && asOf>=earliest && (extra==principal || (!arrears && !late))},
            {"ledger_version",version}};
}
void saveSchedule(Database& db,const std::string& id,const Json& rows) {
    db.exec(R"(
      INSERT INTO repayment_schedules(loan_id,month,due_date,principal,interest,balance)
      SELECT $1,month,due_date,principal,interest,balance FROM jsonb_to_recordset($2::jsonb)
          x(month integer,due_date date,principal bigint,interest bigint,balance bigint)
      ON CONFLICT(loan_id,month) DO UPDATE SET active=true,principal=excluded.principal,interest=excluded.interest,balance=excluded.balance)",
      {id,rows.dump()});
}
void collectPenalties(Database& db,const std::string& id,const Json& pending,Money& available,Repayment& payment) {
    for (const auto& item:pending) {
        const Money owed=item.at("amount").get<Money>()-item.at("paid").get<Money>();
        const Money pay=std::min(owed,available);
        if (!pay) continue;
        db.exec("UPDATE loan_penalties SET paid=paid+$3::bigint WHERE loan_id=$1 AND month=$2",{id,item.at("month").dump(),std::to_string(pay)});
        available-=pay;payment.penalty+=pay;
        payment.allocations.push_back({{"month",item.at("month")},{"penalty",pay}});
    }
}
void applyScheduled(Database& db,const std::string& id,const std::string& day,const Json& rows,Money& available,Repayment& payment) {
    for (const auto& row:rows) {
        if (!available) break;
        const Money interest=std::min(available,row.at("interest").get<Money>()-row.at("interest_paid").get<Money>());
        const Money principal=std::min(available-interest,row.at("principal").get<Money>()-row.at("principal_paid").get<Money>());
        if (!principal && !interest) continue;
        db.exec(R"(
         UPDATE repayment_schedules SET interest_paid=interest_paid+$3::bigint,principal_paid=principal_paid+$4::bigint,
         paid_on=CASE WHEN interest_paid+$3::bigint=interest AND principal_paid+$4::bigint=principal THEN $5::date END,
         settlement=CASE WHEN interest_paid+$3::bigint=interest AND principal_paid+$4::bigint=principal THEN 'scheduled' END
         WHERE loan_id=$1 AND month=$2)",{id,row.at("month").dump(),std::to_string(interest),std::to_string(principal),day});
        payment.interest+=interest;payment.principal+=principal;available-=principal+interest;
        payment.allocations.push_back({{"month",row.at("month")},{"interest",interest},{"principal",principal}});
    }
}
void settleEarly(Database& db,const Json& l,const Json& quote,const Json& rows,const Json& late,
                 const std::string& day,Money principal,Repayment& payment) {
    const std::string id=l.at("id").dump();
    if (!quote.at("allowed").get<bool>()) throw Error(409,"prepayment_timing","The product’s prepayment period has not started.");
    require(principal>0 && principal<=l.at("outstanding").get<Money>(),"Choose extra principal within the remaining balance.");
    payment.principal=principal;
    payment.fee=EMIEngine::basisPoints(principal,l.at("product_terms").at("prepayment_fee_bps"));
    if (principal == l.at("outstanding")) {
        Money payLate=quote.at("penalties");
        collectPenalties(db,id,late,payLate,payment);
        payment.interest=quote.at("interest");
        // Future unbilled interest is released. Preserve actual receipts and settled historical rows.
        db.exec(R"(
          UPDATE repayment_schedules SET active=false,settlement='foreclosure' WHERE loan_id=$1 AND active
          AND paid_on IS NULL AND due_date>$2::date AND interest_paid=0 AND principal_paid=0)",{id,day});
        db.exec(R"(
          UPDATE repayment_schedules SET principal_paid=principal,interest_paid=interest,paid_on=$2::date,
          settlement='foreclosure',balance=0 WHERE loan_id=$1 AND active AND paid_on IS NULL)",{id,day});
    } else {
        if (quote.at("scheduled_due")!=0 || quote.at("penalties")!=0)
            throw Error(409,"scheduled_due","Settle due instalments and penalties before making an extra principal payment.");
        auto first=std::find_if(rows.begin(),rows.end(),[](const Json& row){return row.at("paid_on").is_null();});
        require(first!=rows.end(),"The loan has no outstanding instalment.");
        auto revised=recastInstallments(l,*first,l.at("outstanding").get<Money>()-principal);
        db.exec("UPDATE repayment_schedules SET active=false WHERE loan_id=$1 AND active AND paid_on IS NULL",{id});
        saveSchedule(db,id,revised);
    }
    payment.allocations.push_back({{"principal_prepayment",principal},{"interest",payment.interest},{"prepayment_fee",payment.fee}});
}
void certify(Database& db,const Json& loan) {
    auto id=loan.at("id").dump();
    Json document={{"reference","CW-C-"+id},{"loan_id",loan.at("id")},{"application_id",loan.at("application_id")},
        {"borrower_name",loan.at("borrower_name")},{"product_name",loan.at("product_name")},
        {"original_principal",loan.at("principal")},{"principal_paid",loan.at("principal_paid")},
        {"interest_paid",loan.at("interest_paid")},{"fees_paid",loan.at("fees_paid")},{"total_paid",loan.at("total_paid")},
        {"closed_on",loan.at("closed_on")},{"title","Loan closure certificate"},
        {"disclaimer","Issued for a synthetic educational simulation."}};
    db.exec("INSERT INTO closure_certificates(loan_id,reference,certificate) VALUES($1,$2,$3::jsonb)",
            {id,document.at("reference"),document.dump()});
}
Response postPayment(Database& db,const Request& req,const std::string& id,const std::string& owner) {
    const auto& key=req.idempotencyKey;
    require(key.size()>=8 && key.size()<=128 && std::all_of(key.begin(),key.end(),[](unsigned char c){
        return (c<128 && std::isalnum(c)) || c=='.' || c=='_' || c==':' || c=='-';
    }),"Supply an Idempotency-Key of 8–128 letters, digits, dots, underscores, colons or hyphens.");
    const auto kind=field(req.body,"kind",20);
    static const std::set<std::string> kinds={"emi","partial","advance","prepayment","foreclosure"};
    require(kinds.contains(kind),"Choose a supported payment kind.");
    if (kind!="emi" && kind!="partial")
        blockSharedDemoChange(db.one("SELECT email FROM users WHERE id=$1",{owner}),"the demonstration loan balances");
    for (const auto& [fieldName,value]:req.body.items())
        require(fieldName=="kind" || fieldName=="amount" || fieldName=="payment_date" || fieldName=="expected_version","Unknown payment field.");
    Transaction tx(db);
    // All borrower financial writes lock profile, application and loan in this order.
    db.one("SELECT user_id FROM financial_profiles WHERE user_id=$1 FOR UPDATE",{owner});
    auto target=db.one("SELECT application_id FROM loans WHERE id=$1 AND user_id=$2",{id,owner});
    auto original=db.rows("SELECT loan_id,request_payload,receipt FROM repayment_transactions WHERE user_id=$1 AND idempotency_key=$2",{owner,key});
    if (!original.empty()) {
        if (original.front().at("loan_id").dump()!=id || original.front().at("request_payload")!=req.body)
            throw Error(409,"idempotency_conflict","This payment key is already associated with a different request.");
        tx.commit();return {original.front().at("receipt")};
    }
    db.one("SELECT id FROM loan_applications WHERE id=$1 FOR UPDATE",{target.at("application_id").dump()});
    auto l=rawLoan(db,id,owner,true);
    Money version=db.one("SELECT count(*) AS version FROM repayment_transactions WHERE loan_id=$1",{id}).at("version");
    if (req.body.contains("expected_version") && integer(req.body,"expected_version",0,INT64_MAX)!=version)
        throw Error(409,"stale_quote","The ledger has changed. Review the current payment quote.");
    if (l.at("status")=="closed") throw Error(409,"loan_state","This loan is already settled.");
    auto day=paymentDate(l,req.body);
    assessPenalties(db,id,day);
    auto rows=schedule(db,id,day), late=penalties(db,id,day);
    bool given=req.body.contains("amount");
    Money offered=given?integer(req.body,"amount",1,INT64_MAX):0;
    auto quote=payoff(l,rows,late,day,kind=="prepayment"?std::min(offered,l.at("outstanding").get<Money>()):0,version);
    Repayment payment;
    if (kind=="prepayment" || kind=="foreclosure") {
        if (kind=="foreclosure" && given && offered!=quote.at("total"))
            throw Error(409,"stale_quote","Review the current full settlement amount.");
        settleEarly(db,l,quote,rows,late,day,kind=="foreclosure"?l.at("outstanding").get<Money>():offered,payment);
    } else {
        const Money next=quote.at("next_amount");
        Money available=kind=="emi"?next:offered;
        require(available>0,"Enter a positive payment amount.");
        if (kind=="emi" && given && offered!=next) throw Error(409,"stale_quote","Review the current instalment amount.");
        require(kind!="partial" || available<=next,"Use an advance payment to cover more than the next instalment.");
        collectPenalties(db,id,late,available,payment);
        applyScheduled(db,id,day,rows,available,payment);
        require(!available,"The payment exceeds all remaining scheduled amounts.");
    }
    auto remaining=l.at("outstanding").get<Money>()-payment.principal;
    require(remaining>=0 && payment.amount()>0,"The payment cannot be allocated to this loan.");
    db.exec(R"(
        UPDATE loans SET outstanding=$2,last_payment_date=$3::date,updated_at=now(),
        status=CASE WHEN $2::bigint=0 THEN 'closed' ELSE status END,
        closed_on=CASE WHEN $2::bigint=0 THEN $3::date END WHERE id=$1)",{id,std::to_string(remaining),day});
    auto posting=db.one(R"(
        INSERT INTO repayment_transactions(loan_id,user_id,idempotency_key,request_payload,kind,amount,principal,interest,fee,penalty,payment_date,allocations)
        VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10,$11::date,$12::jsonb) RETURNING id)",
        {id,owner,key,req.body.dump(),kind,std::to_string(payment.amount()),std::to_string(payment.principal),
         std::to_string(payment.interest),std::to_string(payment.fee),std::to_string(payment.penalty),day,payment.allocations.dump()});
    auto summary=header(db,id,owner);
    if (!remaining) {
        closeLoanApplication(db,l.at("application_id").dump(),owner,false);
        certify(db,summary);
    }
    recordProfileAssessment(db,owner,getProfile(db,owner).at("profile"));
    identityAudit(db,owner,owner,"loan.payment_posted",{{"loan_id",l.at("id")},{"transaction_id",posting.at("id")}});
    notify(db,owner,"payment","Payment recorded","Reference CW-T-"+posting.at("id").dump()+" for loan "+id+".","/app/loans/"+id);
    Json receipt={{"transaction",ledger(db,id,posting.at("id").dump()).front()},{"loan",summary}};
    db.exec("UPDATE repayment_transactions SET receipt=$2::jsonb WHERE id=$1",{posting.at("id").dump(),receipt.dump()});
    tx.commit();
    return {std::move(receipt),201};
}
Json detail(Database& db,const std::string& id,const std::string& owner) {
    auto info=header(db,id,owner), l=rawLoan(db,id,owner);
    const std::string asOf=l.at("view_date");
    auto docs=db.rows("SELECT certificate FROM closure_certificates WHERE loan_id=$1",{id});
    return {{"loan",std::move(info)},{"schedule",schedule(db,id,asOf)},{"transactions",ledger(db,id)},{"penalties",penalties(db,id,asOf)},
            {"certificate",docs.empty()?Json(nullptr):docs.front().at("certificate")},{"product",l.at("product_terms")}};
}
Response documentDefault(Database& db,const std::string& id,const std::string& admin,const Json& body) {
    auto note=field(body,"note",600), asOf=field(body,"as_of",10);
    Transaction tx(db);
    auto ids=db.one("SELECT user_id,application_id FROM loans WHERE id=$1",{id});
    auto owner=ids.at("user_id").dump(), app=ids.at("application_id").dump();
    db.one("SELECT user_id FROM financial_profiles WHERE user_id=$1 FOR UPDATE",{owner});
    db.one("SELECT id FROM loan_applications WHERE id=$1 FOR UPDATE",{app});
    auto l=rawLoan(db,id,owner,true);
    if (l.at("status")!="active") throw Error(409,"loan_state","Only an active loan can receive a default decision.");
    paymentDate(l,Json{{"payment_date",asOf}});
    auto overdue=db.rows(R"(
       SELECT month FROM repayment_schedules WHERE loan_id=$1 AND active AND paid_on IS NULL AND
           principal+interest>principal_paid+interest_paid AND due_date+90<=$2::date ORDER BY month LIMIT 1)",{id,asOf});
    if (overdue.empty()) throw Error(409,"no_qualifying_arrears","An unpaid instalment must be at least 90 days past its contractual due date.");
    assessPenalties(db,id,asOf);
    db.exec("UPDATE loans SET status='defaulted',defaulted_on=$2::date,defaulted_by=$3,default_reason=$4,updated_at=now() WHERE id=$1",
            {id,asOf,admin,note});
    closeLoanApplication(db,app,admin,true);
    identityAudit(db,admin,owner,"loan.default_documented",{{"loan_id",l.at("id")},{"reason",note},{"as_of",asOf},{"oldest_month",overdue.front().at("month")}});
    recordProfileAssessment(db,owner,getProfile(db,owner).at("profile"));
    auto result=header(db,id,owner);
    tx.commit();return Response{{{"loan",result}}};
}
}

std::int64_t openLoan(Database& db,const Json& app,const Json& quote,const Json& product) {
    auto existing=db.rows("SELECT id FROM loans WHERE application_id=$1",{app.at("id").dump()});
    if (!existing.empty()) return existing.front().at("id").get<std::int64_t>();
    require(app.at("principal")==quote.at("principal") && app.at("months")==quote.at("months") &&
            app.at("product_slug")==product.at("slug"),"The accepted terms must match the application.");
    auto l=db.one(R"(
        INSERT INTO loans(application_id,user_id,product_slug,principal,outstanding,months,emi,rate_bps,product_terms,offer_quote)
        VALUES($1,$2,$3,$4,$4,$5,$6,$7,$8::jsonb,$9::jsonb) RETURNING id,opened_on)",
        {app.at("id").dump(),app.at("user_id").dump(),product.at("slug"),app.at("principal").dump(),
         app.at("months").dump(),quote.at("emi").dump(),product.at("rate_bps").dump(),product.dump(),quote.dump()});
    const auto number=l.at("id").dump(); auto opened=calendarDay(l.at("opened_on"));
    Json rows=quote.at("schedule");
    for (auto& row:rows) row["due_date"]=isoDate(monthAnniversary(opened,row.at("month")));
    saveSchedule(db,number,rows);
    db.exec(R"(
       INSERT INTO repayment_transactions(loan_id,user_id,kind,amount,principal,fee,payment_date)
       VALUES($1,$2,'disbursement',$3,$4,$5,$6::date))",
       {number,app.at("user_id").dump(),quote.at("net_proceeds").dump(),app.at("principal").dump(),
        std::to_string(quote.at("fee").get<Money>()+quote.at("upfront").get<Money>()),l.at("opened_on")});
    return l.at("id").get<std::int64_t>();
}
Json portfolioCommitments(Database& db,std::string userId) {
    return db.one(R"(
     WITH portfolio AS (
        SELECT l.*,greatest((now() AT TIME ZONE 'Asia/Kolkata')::date,l.last_payment_date,l.defaulted_on) AS eval_date,
               coalesce((SELECT s.principal+s.interest FROM repayment_schedules s WHERE s.loan_id=l.id
                         AND s.active AND s.paid_on IS NULL ORDER BY s.month LIMIT 1),0) AS scheduled_emi
        FROM loans l WHERE user_id=$1), limits AS (
        SELECT coalesce(sum(outstanding) FILTER(WHERE status IN ('active','defaulted')),0)::bigint AS debt,
               coalesce(sum(scheduled_emi) FILTER(WHERE status IN ('active','defaulted')),0)::bigint AS existing_emi,
               coalesce(max(extract(year FROM age(coalesce(closed_on,eval_date),opened_on))*12+
                            extract(month FROM age(coalesce(closed_on,eval_date),opened_on))),0)::integer AS credit_months FROM portfolio),
     history AS (
        SELECT count(*) FILTER(WHERE s.settlement='scheduled' AND s.due_date<=l.eval_date AND
               s.paid_on<=s.due_date+(l.product_terms->>'grace_days')::int) AS on_time,
               count(*) FILTER(WHERE p.loan_id IS NOT NULL OR s.paid_on>s.due_date+(l.product_terms->>'grace_days')::int OR
               (s.active AND s.paid_on IS NULL AND s.due_date+(l.product_terms->>'grace_days')::int<l.eval_date)) AS missed
        FROM portfolio l JOIN repayment_schedules s ON s.loan_id=l.id LEFT JOIN loan_penalties p USING(loan_id,month))
     SELECT * FROM limits CROSS JOIN history)",{userId});
}
std::optional<Response> servicingRoutes(Database& db,const Request& req) {
    if (req.path.empty()) return std::nullopt;
    const bool admin=req.path.size()>=2 && req.path[0]=="admin" && req.path[1]=="loans";
    if (!admin && req.path[0]!="loans") return std::nullopt;
    std::size_t offset=admin?2:1;
    const bool markDefault=admin && req.path.size()==4 && req.path[3]=="default" && req.method=="POST";
    if (admin && req.method!="GET" && !markDefault) return std::nullopt;
    const auto actor=authenticate(db,req,admin?Permission::administration:Permission::customerWorkspace);
    const std::string owner=admin?"":actor.at("id").dump();
    if (req.path.size()==offset && req.method=="GET")
        return Response{{{"items",db.rows(std::string(headersSql)+" ORDER BY l.id DESC",{owner,""})}}};
    if (req.path.size()<=offset) return std::nullopt;
    const auto id=identifier(req.path[offset]);
    if (markDefault) return documentDefault(db,id,actor.at("id").dump(),req.body);
    if (req.path.size()==offset+2 && req.method=="POST" && req.path.back()=="payments")
        return postPayment(db,req,id,owner);
    Transaction tx(db);
    db.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    Json result;
    if (req.path.size()==offset+1 && req.method=="GET") result=detail(db,id,owner);
    else if (req.path.size()==offset+2 && req.path.back()=="certificate" && req.method=="GET") {
        auto l=rawLoan(db,id,owner);
        if (l.at("status")!="closed") throw Error(409,"loan_state","The closure certificate is available after settlement.");
        result=db.one("SELECT certificate FROM closure_certificates WHERE loan_id=$1",{id}).at("certificate");
    } else if (req.path.size()==offset+2 && req.path.back()=="payoff" && req.method=="POST" && !admin) {
        auto l=rawLoan(db,id,owner);
        auto day=paymentDate(l,req.body);
        Money extra=req.body.contains("amount")?integer(req.body,"amount",0,l.at("outstanding")):0;
        const Money version=db.one("SELECT count(*) AS version FROM repayment_transactions WHERE loan_id=$1",{id}).at("version");
        result=payoff(l,schedule(db,id,day),penalties(db,id,day),day,extra,version);
    } else return std::nullopt;
    tx.commit();return Response{result};
}
}
