CREATE TABLE roles (name text PRIMARY KEY);
INSERT INTO roles VALUES ('customer'), ('admin');

CREATE TABLE users (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email text UNIQUE NOT NULL CHECK (email = lower(email)),
    name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
    role text NOT NULL DEFAULT 'customer' REFERENCES roles(name),
    active boolean NOT NULL DEFAULT true,
    password_hash text NOT NULL,
    recovery_hash text NOT NULL,
    preferences jsonb NOT NULL DEFAULT '{"theme":"system","language":"en","notifications":{"applications":true,"payments":true,"learning":true,"distress":true}}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
    token_hash char(64) PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE auth_attempts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email_hash char(64) NOT NULL,
    remote_hash char(64) NOT NULL,
    action text NOT NULL CHECK (action IN ('login','recover','register')),
    success boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_email_window_idx ON auth_attempts(email_hash, action, created_at DESC);
CREATE INDEX auth_remote_window_idx ON auth_attempts(remote_hash, action, created_at DESC);
CREATE TABLE identity_audit (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id bigint REFERENCES users(id),
    subject_id bigint REFERENCES users(id),
    action text NOT NULL,
    detail jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX identity_audit_subject_idx ON identity_audit(subject_id, created_at DESC);

CREATE TABLE financial_profiles (
    user_id bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    employment text NOT NULL DEFAULT 'Not specified',
    stability_months integer NOT NULL DEFAULT 0 CHECK (stability_months BETWEEN 0 AND 1200),
    credit_months integer NOT NULL DEFAULT 0 CHECK (credit_months BETWEEN 0 AND 1200),
    utilization integer NOT NULL DEFAULT 0 CHECK (utilization BETWEEN 0 AND 100),
    on_time integer NOT NULL DEFAULT 0 CHECK (on_time BETWEEN 0 AND 12000),
    missed integer NOT NULL DEFAULT 0 CHECK (missed BETWEEN 0 AND 12000),
    income_regularity integer NOT NULL DEFAULT 0 CHECK (income_regularity BETWEEN 0 AND 100),
    rent integer NOT NULL DEFAULT 0 CHECK (rent BETWEEN 0 AND 100),
    utilities integer NOT NULL DEFAULT 0 CHECK (utilities BETWEEN 0 AND 100),
    consent boolean NOT NULL DEFAULT false,
    goal text NOT NULL DEFAULT '',
    goal_amount bigint NOT NULL DEFAULT 0 CHECK (goal_amount BETWEEN 0 AND 100000000000),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE financial_entries (
    user_id bigint NOT NULL REFERENCES financial_profiles(user_id) ON DELETE CASCADE,
    kind text NOT NULL CHECK (kind IN ('salary','business_income','other_income','essential','discretionary','savings','existing_emi','debt','assets','liabilities','reserves')),
    amount bigint NOT NULL CHECK (amount BETWEEN 0 AND 100000000000),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, kind)
);
CREATE TABLE financial_snapshots (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES financial_profiles(user_id) ON DELETE CASCADE,
    profile jsonb NOT NULL,
    metrics jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX financial_snapshots_user_idx ON financial_snapshots(user_id, id DESC);

CREATE TABLE synthetic_documents (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id),
    name text NOT NULL,
    mime text NOT NULL CHECK (mime IN ('text/plain','application/pdf')),
    contents bytea NOT NULL CHECK (octet_length(contents) BETWEEN 1 AND 262144),
    sha256 char(64) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(id, user_id)
);
CREATE TABLE kyc_records (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL UNIQUE REFERENCES users(id),
    legal_name text NOT NULL,
    address text NOT NULL,
    employment text NOT NULL,
    pan text NOT NULL CHECK (pan ~ '^DEMO[A-Z][0-9]{4}[A-Z]$'),
    document_id bigint NOT NULL,
    status text NOT NULL CHECK (status IN ('pending','verified','rejected')),
    reason text NOT NULL DEFAULT '',
    reviewer_id bigint REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    FOREIGN KEY(document_id, user_id) REFERENCES synthetic_documents(id, user_id)
);
CREATE INDEX kyc_queue_idx ON kyc_records(status, updated_at);
CREATE INDEX kyc_pan_idx ON kyc_records(pan);
CREATE TABLE kyc_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kyc_id bigint NOT NULL REFERENCES kyc_records(id),
    document_id bigint NOT NULL REFERENCES synthetic_documents(id),
    actor_id bigint NOT NULL REFERENCES users(id),
    status text NOT NULL,
    reason text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now()
);
