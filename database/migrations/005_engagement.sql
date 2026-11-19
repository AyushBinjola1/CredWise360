CREATE TABLE planning_scenarios (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id),
    kind text NOT NULL CHECK (kind IN ('twin','stress','debt','education')),
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
    input jsonb NOT NULL,
    result jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX planning_scenarios_owner_idx ON planning_scenarios(user_id,id DESC);

CREATE TABLE notifications (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id),
    kind text NOT NULL,
    title text NOT NULL,
    body text NOT NULL DEFAULT '',
    link text NOT NULL DEFAULT '',
    dedupe_key text NOT NULL,
    read_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id,dedupe_key)
);
CREATE INDEX notifications_owner_idx ON notifications(user_id,id DESC);

CREATE TABLE fraud_cases (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES users(id),
    rule text NOT NULL,
    subject text NOT NULL DEFAULT '',
    severity text NOT NULL CHECK (severity IN ('review','high')),
    evidence text NOT NULL,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','cleared','confirmed')),
    note text NOT NULL DEFAULT '',
    reviewer_id bigint REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id,rule,subject)
);
CREATE INDEX fraud_cases_status_idx ON fraud_cases(status,id DESC);
