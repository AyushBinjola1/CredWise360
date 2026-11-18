CREATE TABLE scoring_policies (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conventional_weights jsonb NOT NULL,
    alternative_weights jsonb NOT NULL,
    thresholds jsonb NOT NULL,
    note text NOT NULL,
    created_by bigint REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO scoring_policies(conventional_weights,alternative_weights,thresholds,note) VALUES (
    '{"repayment":35,"utilization":20,"obligations":10,"history":10,"inquiries":10,"consistency":8,"resilience":7}',
    '{"rent":25,"utilities":20,"cashflow":20,"savings":20,"commitments":15}',
    '{"min_conventional_payments":3,"min_history_months":3,"history_target_months":60,
      "inquiry_window_days":90,"max_recent_inquiries":5,"full_reserve_months":6,"full_savings_pct":20,
      "max_debt_to_annual_pct":100,"emi_cap_pct":40,"cashflow_share_pct":70,
      "low_risk_score":740,"moderate_risk_score":620,"alt_min_evidence":3,
      "positive_factor_min":75,"negative_factor_max":45}',
    'Initial transparent policy for the local lending simulation.'
);
CREATE TABLE credit_assessments (
    user_id bigint PRIMARY KEY REFERENCES users(id),
    policy_id bigint NOT NULL REFERENCES scoring_policies(id),
    assessment jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE credit_score_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id),
    policy_id bigint NOT NULL REFERENCES scoring_policies(id),
    score integer CHECK (score BETWEEN 300 AND 900),
    strategy text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_history_user_idx ON credit_score_history(user_id,id DESC);
CREATE TABLE credit_inquiries (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id),
    application_ref text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(user_id,application_ref)
);
CREATE INDEX credit_inquiries_window_idx ON credit_inquiries(user_id,created_at DESC);
