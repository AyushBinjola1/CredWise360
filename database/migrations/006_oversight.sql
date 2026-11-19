CREATE TABLE disputes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id),
    category text NOT NULL CHECK (category IN ('incorrect_record','assessment_challenge','application_reconsideration','payment_issue','other')),
    subject text NOT NULL CHECK (length(subject) BETWEEN 3 AND 140),
    description text NOT NULL CHECK (length(description) BETWEEN 10 AND 2000),
    application_id bigint REFERENCES loan_applications(id),
    loan_id bigint REFERENCES loans(id),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','awaiting_customer','resolved','rejected','withdrawn')),
    assignee_id bigint REFERENCES users(id),
    resolution text NOT NULL DEFAULT '',
    reconsidered boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
);
CREATE INDEX disputes_owner_idx ON disputes(user_id,id DESC);
CREATE INDEX disputes_queue_idx ON disputes(status,created_at);
CREATE TABLE dispute_messages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dispute_id bigint NOT NULL REFERENCES disputes(id),
    author_id bigint NOT NULL REFERENCES users(id),
    author_role text NOT NULL CHECK (author_role IN ('customer','admin')),
    kind text NOT NULL CHECK (kind IN ('message','status')),
    body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
    status text NOT NULL,
    document_id bigint REFERENCES synthetic_documents(id),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX dispute_messages_idx ON dispute_messages(dispute_id,id);

CREATE TABLE quiz_attempts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id),
    lesson text NOT NULL,
    language text NOT NULL CHECK (language IN ('en','hi')),
    choice integer NOT NULL CHECK (choice BETWEEN 0 AND 9),
    correct boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quiz_attempts_idx ON quiz_attempts(user_id,lesson);

CREATE TABLE reward_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id),
    kind text NOT NULL,
    points integer NOT NULL CHECK (points > 0),
    ref text NOT NULL,
    note text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id,ref)
);
CREATE TABLE reward_badges (
    user_id bigint NOT NULL REFERENCES users(id),
    badge text NOT NULL,
    awarded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id,badge)
);

CREATE TABLE distress_cases (
    user_id bigint PRIMARY KEY REFERENCES users(id),
    level text NOT NULL CHECK (level IN ('low','watch','elevated','high')),
    score integer NOT NULL,
    indicators jsonb NOT NULL,
    outreach text NOT NULL DEFAULT 'none' CHECK (outreach IN ('none','contacted','plan_agreed','resolved')),
    note text NOT NULL DEFAULT '',
    reviewer_id bigint REFERENCES users(id),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE fairness_runs (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_id bigint NOT NULL REFERENCES users(id),
    policy_id bigint NOT NULL REFERENCES scoring_policies(id),
    consistent boolean NOT NULL,
    result jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
