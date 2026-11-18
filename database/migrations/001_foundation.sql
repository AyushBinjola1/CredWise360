CREATE TABLE system_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind text NOT NULL,
    detail jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO system_events(kind,detail) VALUES ('initialized','{"currency":"INR","unit":"paise"}');
