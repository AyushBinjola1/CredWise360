CREATE TABLE loan_applications (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id),
    product_slug text NOT NULL REFERENCES loan_products(slug),
    principal bigint NOT NULL CHECK (principal BETWEEN 1 AND 100000000000),
    months integer NOT NULL CHECK (months BETWEEN 1 AND 600),
    purpose text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft','submitted','under_review','requires_information','approved','rejected',
        'accepted','disbursed','active','closed','defaulted','withdrawn')),
    tracking_id text UNIQUE,
    assessment jsonb,
    offer jsonb,
    recovery jsonb,
    rejected_profile_hash text,
    preview_token text,
    offer_revision integer NOT NULL DEFAULT 0,
    revision bigint NOT NULL DEFAULT 1,
    loan_id bigint UNIQUE,
    reviewer_id bigint REFERENCES users(id),
    escalated boolean NOT NULL DEFAULT false,
    submitted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(id,user_id)
);
CREATE INDEX applications_borrower_idx ON loan_applications(user_id,id DESC);
CREATE INDEX applications_queue_idx ON loan_applications(status,escalated DESC,submitted_at,id);
CREATE INDEX applications_product_idx ON loan_applications(product_slug,status);
CREATE TABLE application_documents (
    application_id bigint NOT NULL,
    user_id bigint NOT NULL,
    kind text NOT NULL,
    document_id bigint NOT NULL,
    PRIMARY KEY (application_id,kind),
    FOREIGN KEY (application_id,user_id) REFERENCES loan_applications(id,user_id),
    FOREIGN KEY (document_id,user_id) REFERENCES synthetic_documents(id,user_id)
);
CREATE TABLE application_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id bigint NOT NULL REFERENCES loan_applications(id),
    actor_id bigint REFERENCES users(id),
    action text NOT NULL,
    status text NOT NULL,
    note text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX application_timeline_idx ON application_events(application_id,id);
CREATE TABLE application_decisions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id bigint NOT NULL REFERENCES loan_applications(id),
    reviewer_id bigint NOT NULL REFERENCES users(id),
    action text NOT NULL,
    note text NOT NULL,
    reason_code text,
    assessment jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX decisions_application_idx ON application_decisions(application_id,id DESC);
