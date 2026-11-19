CREATE TABLE loans (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id bigint NOT NULL UNIQUE REFERENCES loan_applications(id),
    user_id bigint NOT NULL REFERENCES users(id),
    product_slug text NOT NULL REFERENCES loan_products(slug),
    principal bigint NOT NULL CHECK (principal > 0),
    outstanding bigint NOT NULL CHECK (outstanding BETWEEN 0 AND principal),
    months integer NOT NULL CHECK (months BETWEEN 1 AND 600),
    emi bigint NOT NULL CHECK (emi > 0),
    rate_bps integer NOT NULL CHECK (rate_bps BETWEEN 0 AND 6000),
    product_terms jsonb NOT NULL,
    offer_quote jsonb NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed','defaulted')),
    opened_on date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date,
    closed_on date,
    last_payment_date date,
    defaulted_on date,
    defaulted_by bigint REFERENCES users(id),
    default_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id,user_id)
);
CREATE INDEX loans_owner_status_idx ON loans(user_id,status,id);

CREATE TABLE repayment_schedules (
    loan_id bigint NOT NULL REFERENCES loans(id),
    month integer NOT NULL CHECK (month > 0),
    due_date date NOT NULL,
    principal bigint NOT NULL CHECK (principal >= 0),
    interest bigint NOT NULL CHECK (interest >= 0),
    balance bigint NOT NULL CHECK (balance >= 0),
    principal_paid bigint NOT NULL DEFAULT 0 CHECK (principal_paid BETWEEN 0 AND principal),
    interest_paid bigint NOT NULL DEFAULT 0 CHECK (interest_paid BETWEEN 0 AND interest),
    paid_on date,
    settlement text CHECK (settlement IN ('scheduled','foreclosure')),
    active boolean NOT NULL DEFAULT true,
    PRIMARY KEY (loan_id,month)
);
CREATE INDEX schedule_due_idx ON repayment_schedules(due_date,loan_id) WHERE active AND paid_on IS NULL;

CREATE TABLE repayment_transactions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    loan_id bigint NOT NULL,
    user_id bigint NOT NULL,
    idempotency_key text,
    request_payload jsonb NOT NULL DEFAULT '{}',
    kind text NOT NULL CHECK (kind IN ('disbursement','emi','partial','advance','prepayment','foreclosure')),
    amount bigint NOT NULL CHECK (amount > 0),
    principal bigint NOT NULL CHECK (principal >= 0),
    interest bigint NOT NULL DEFAULT 0 CHECK (interest >= 0),
    fee bigint NOT NULL DEFAULT 0 CHECK (fee >= 0),
    penalty bigint NOT NULL DEFAULT 0 CHECK (penalty >= 0),
    payment_date date NOT NULL,
    allocations jsonb NOT NULL DEFAULT '[]',
    receipt jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY (loan_id,user_id) REFERENCES loans(id,user_id),
    UNIQUE (user_id,idempotency_key),
    CHECK ((kind='disbursement' AND idempotency_key IS NULL) OR
           (kind<>'disbursement' AND idempotency_key IS NOT NULL AND amount=principal+interest+fee+penalty))
);
CREATE UNIQUE INDEX one_disbursement_per_loan_idx ON repayment_transactions(loan_id) WHERE kind='disbursement';
CREATE INDEX repayment_ledger_idx ON repayment_transactions(loan_id,payment_date,id);

CREATE TABLE loan_penalties (
    loan_id bigint NOT NULL,
    month integer NOT NULL,
    amount bigint NOT NULL CHECK (amount >= 0),
    paid bigint NOT NULL DEFAULT 0 CHECK (paid BETWEEN 0 AND amount),
    assessed_on date NOT NULL,
    PRIMARY KEY (loan_id,month),
    FOREIGN KEY (loan_id,month) REFERENCES repayment_schedules(loan_id,month)
);

CREATE TABLE closure_certificates (
    loan_id bigint PRIMARY KEY REFERENCES loans(id),
    reference text NOT NULL UNIQUE,
    certificate jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
