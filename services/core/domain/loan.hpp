#pragma once
#include "engines/emi.hpp"
#include <memory>

namespace cw {
struct EligibilityResult {
    bool eligible = true;
    bool humanReview = false;
    int compatibility = 0;
    std::vector<std::string> reasons, warnings;
    void decline(std::string reason);
    void review(std::string reason);
};

class EligibilityPolicy {
public:
    virtual ~EligibilityPolicy() = default;
    virtual void checkUse(const Json& profile, EligibilityResult& decision) const = 0;
};

class Loan : public EligibilityPolicy {
    Json terms_;
protected:
    virtual bool reviewWithoutIncome() const { return false; }
public:
    explicit Loan(Json terms) : terms_(std::move(terms)) {}
    ~Loan() override = default;
    const Json& terms() const { return terms_; }
    Json publicTerms() const;
    bool matchesPurpose(const std::string& purpose) const;
    virtual Money processingFee(Money principal) const;
    virtual RepaymentPricing repaymentPricing(Money principal) const;
    virtual EligibilityResult validate(Money principal, int months) const;
    Json quote(Money principal, int months, const Json& scenario = Json::object()) const;
    Json evaluate(Money principal, int months, const std::string& purpose,
                  const Json* profile = nullptr, const Json* credit = nullptr) const;
};

class PersonalLoan final : public Loan {
public: using Loan::Loan; void checkUse(const Json&, EligibilityResult&) const override;
};
class EducationLoan final : public Loan {
    bool reviewWithoutIncome() const override { return true; }
public: using Loan::Loan; void checkUse(const Json&, EligibilityResult&) const override;
};
class HomeLoan final : public Loan {
public: using Loan::Loan; void checkUse(const Json&, EligibilityResult&) const override;
};
class VehicleLoan final : public Loan {
public: using Loan::Loan; void checkUse(const Json&, EligibilityResult&) const override;
};
class BusinessLoan final : public Loan {
public: using Loan::Loan; void checkUse(const Json&, EligibilityResult&) const override;
};
class GoldLoan final : public Loan {
public: using Loan::Loan; void checkUse(const Json&, EligibilityResult&) const override;
};
class EmergencyLoan final : public Loan {
public: using Loan::Loan; void checkUse(const Json&, EligibilityResult&) const override;
};
class MicrofinanceLoan final : public Loan {
public: using Loan::Loan; void checkUse(const Json&, EligibilityResult&) const override;
};

class LoanFactory {
public:
    static std::unique_ptr<Loan> make(Json storedPolicy);
};
}
