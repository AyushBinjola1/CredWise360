#include "domain/loan.hpp"
#include <cctype>
#include <iomanip>
#include <sstream>
#include <unordered_map>

namespace cw {
namespace {
std::string words(const std::string& text) {
    std::string normalized = " ";
    for (const unsigned char c : text) {
        if (std::isalnum(c)) normalized += static_cast<char>(std::tolower(c));
        else if (normalized.back() != ' ') normalized += ' ';
    }
    if (normalized.back() != ' ') normalized += ' ';
    return normalized;
}
std::string percentLabel(int bps) {
    std::ostringstream out;
    out << std::fixed << std::setprecision(2) << bps / 100.0 << '%';
    return out.str();
}
template<class T> std::unique_ptr<Loan> construct(Json row) {
    return std::make_unique<T>(std::move(row));
}
}
void EligibilityResult::decline(std::string message) {
    eligible = false;
    reasons.push_back(std::move(message));
}
void EligibilityResult::review(std::string message) {
    humanReview = true;
    warnings.push_back(std::move(message));
}
Json Loan::publicTerms() const {
    Json result = terms_;
    result["prepayment_terms"] = "Extra principal payments are available from month " +
        terms_.at("prepayment_from_month").dump() + ". The fee is " +
        percentLabel(terms_.at("prepayment_fee_bps")) + " of the extra principal.";
    result["eligibility_requirements"] = "The simulated review considers the requested term, available monthly income, "
                                         "existing instalments and available repayment evidence.";
    return result;
}
bool Loan::matchesPurpose(const std::string& purpose) const {
    const auto query = words(purpose);
    for (const auto& tag : terms_.at("purposes")) {
        if (query.find(words(tag.get<std::string>())) != std::string::npos) return true;
    }
    return false;
}
Money Loan::processingFee(Money principal) const {
    const Money calculated = EMIEngine::basisPoints(principal, terms_.at("fee_bps"));
    const Money cap = terms_.at("fee_cap");
    return cap ? std::min(calculated,cap) : calculated;
}
RepaymentPricing Loan::repaymentPricing(Money principal) const {
    return {processingFee(principal),terms_.at("prepayment_from_month"),terms_.at("prepayment_fee_bps")};
}
EligibilityResult Loan::validate(Money principal,int months) const {
    EligibilityResult decision;
    if (principal < terms_.at("min_amount").get<Money>() || principal > terms_.at("max_amount").get<Money>())
        decision.decline("The requested amount is outside this product’s principal range.");
    if (months < terms_.at("min_months").get<int>() || months > terms_.at("max_months").get<int>())
        decision.decline("The requested repayment term is outside this product’s tenure range.");
    return decision;
}
Json Loan::quote(Money principal,int months,const Json& scenario) const {
    Json input = {{"principal",principal},{"months",months},{"rate_bps",terms_.at("rate_bps")},{"method",terms_.at("method")}};
    for (const auto* key : {"prepayment","prepay_month","next_rate_bps","rate_month"})
        if (scenario.contains(key)) input[key] = scenario.at(key);
    return EMIEngine::calculate(input,repaymentPricing(principal));
}
Json Loan::evaluate(Money principal,int months,const std::string& purpose,const Json* profile,const Json* credit) const {
    auto decision = validate(principal,months);
    auto proposal = quote(principal,months);
    decision.compatibility = decision.eligible ? 35 : 10;
    if (profile && credit) {
        if (matchesPurpose(purpose)) {
            decision.compatibility += 35;
            decision.reasons.push_back("The stated purpose matches this product.");
        } else decision.decline("The stated purpose falls outside this product’s intended uses.");
        const auto& values = profile->at("profile");
        const auto& metrics = profile->at("metrics");
        const Money income = metrics.at("income");
        const Money emi = proposal.at("emi");
        const Money afterCommitments = income * terms_.at("max_emi_percent").get<int>() / 100 - values.at("existing_emi").get<Money>();
        const Money capacity = std::min({afterCommitments, metrics.at("disposable").get<Money>(), credit->at("capacity").get<Money>()});
        if (income < terms_.at("min_income").get<Money>()) decision.decline("Declared monthly income is below this product’s minimum.");
        if (!income && reviewWithoutIncome()) {
            decision.review("A reviewer needs the proposed source of repayments before affordability can be established.");
        } else if (emi > capacity) {
            decision.decline("The estimated instalment exceeds the room in the current monthly budget.");
        } else {
            decision.compatibility += 20 + static_cast<int>(10 * (capacity-emi) / std::max<Money>(1,capacity));
            decision.reasons.push_back("The estimated instalment fits the current income and commitment limits.");
        }
        if (credit->at("score").is_null() || credit->at("human_review").get<bool>())
            decision.review("Available credit evidence needs a human review.");
        else if (credit->at("score").get<int>() < terms_.at("min_score").get<int>())
            decision.decline("The current simulated assessment is below this product’s configured threshold.");
        if (credit->at("risk") == "high") decision.review("A reviewer should examine the repayment risk factors.");
        if (values.at("stability_months").get<int>() < terms_.at("min_stability_months").get<int>())
            decision.review("A reviewer needs more evidence of income continuity for this product.");
        checkUse(values,decision);
    } else if (decision.eligible) {
        decision.reasons.push_back("The amount and tenure fit this product’s published limits.");
        decision.warnings.push_back("Personal affordability and credit evidence are assessed in the borrower workspace.");
    }
    if (!decision.eligible) decision.compatibility = std::min(49,decision.compatibility);
    return {{"product",publicTerms()},{"quote",std::move(proposal)},{"eligible",decision.eligible},
            {"human_review",decision.humanReview},{"compatibility",decision.compatibility},
            {"eligibility_scope",profile?"financial_profile":"amount_and_term"},
            {"reasons",decision.reasons},{"warnings",decision.warnings}};
}

void PersonalLoan::checkUse(const Json& p, EligibilityResult& d) const {
    if (p.at("salary") == 0 && p.at("business_income") == 0)
        d.review("Document the recurring income source supporting an unsecured personal loan.");
}
void EducationLoan::checkUse(const Json&, EligibilityResult& d) const {
    d.review("A reviewer checks the admission evidence and course costs. Use the education planner for staged tuition.");
}
void HomeLoan::checkUse(const Json&, EligibilityResult& d) const {
    d.review("The synthetic property title and security valuation need review before approval.");
}
void VehicleLoan::checkUse(const Json&, EligibilityResult& d) const {
    d.review("Review the synthetic vehicle invoice and the amount to be secured.");
}
void BusinessLoan::checkUse(const Json& p, EligibilityResult& d) const {
    if (p.at("business_income") == 0) d.review("Supply a synthetic business cash-flow plan for the proposed funding.");
}
void GoldLoan::checkUse(const Json&, EligibilityResult& d) const {
    d.review("A reviewer must check the synthetic pledged-gold valuation and ownership record.");
}
void EmergencyLoan::checkUse(const Json&, EligibilityResult& d) const {
    if (!d.eligible) d.warnings.push_back("Review essential expenses and the support options before taking on an urgent payment.");
}
void MicrofinanceLoan::checkUse(const Json& p, EligibilityResult& d) const {
    if (!p.at("consent").get<bool>() && p.at("credit_months") == 0)
        d.review("A human reviewer can consider a synthetic household budget when alternative evidence is unavailable.");
    d.warnings.push_back("The flat-interest policy accrues interest on original principal in each open month.");
}
std::unique_ptr<Loan> LoanFactory::make(Json storedPolicy) {
    using Creator = std::unique_ptr<Loan>(*)(Json);
    static const std::unordered_map<std::string,Creator> creators = {
        {"personal",construct<PersonalLoan>},{"education",construct<EducationLoan>},{"home",construct<HomeLoan>},
        {"vehicle",construct<VehicleLoan>},{"business",construct<BusinessLoan>},{"gold",construct<GoldLoan>},
        {"emergency",construct<EmergencyLoan>},{"microfinance",construct<MicrofinanceLoan>}
    };
    const auto found = creators.find(storedPolicy.at("slug").get<std::string>());
    if (found == creators.end()) throw Error(422,"product_policy","This product type is not supported.");
    return found->second(std::move(storedPolicy));
}
}
