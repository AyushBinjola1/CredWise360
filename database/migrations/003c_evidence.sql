ALTER TABLE financial_profiles
    ALTER COLUMN rent DROP NOT NULL,
    ALTER COLUMN rent DROP DEFAULT,
    ALTER COLUMN utilities DROP NOT NULL,
    ALTER COLUMN utilities DROP DEFAULT,
    ALTER COLUMN income_regularity DROP NOT NULL,
    ALTER COLUMN income_regularity DROP DEFAULT,
    ADD COLUMN savings_reported boolean NOT NULL DEFAULT false,
    ADD COLUMN emi_reported boolean NOT NULL DEFAULT false;

-- Original zero defaults did not record whether the borrower supplied them.
-- Positive values are attributable evidence, while an ambiguous zero is unknown.
UPDATE financial_profiles p SET
    rent=NULLIF(rent,0), utilities=NULLIF(utilities,0), income_regularity=NULLIF(income_regularity,0),
    savings_reported=EXISTS(SELECT 1 FROM financial_entries e
                            WHERE e.user_id=p.user_id AND e.kind='savings' AND e.amount>0),
    emi_reported=EXISTS(SELECT 1 FROM financial_entries e
                         WHERE e.user_id=p.user_id AND e.kind='existing_emi' AND e.amount>0);
