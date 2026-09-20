-- EvidenceLens schema. Every customer-owned table carries tenant_id.
CREATE TABLE IF NOT EXISTS tenants (id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('investigator','compliance','citizen_reviewer')));

CREATE TABLE IF NOT EXISTS attestations (
  id TEXT NOT NULL, tenant_id TEXT NOT NULL REFERENCES tenants(id), seq INTEGER NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, tier TEXT NOT NULL CHECK (tier IN ('T0','T1','T2','T3')),
  policy_id TEXT NOT NULL, policy_version TEXT NOT NULL, purpose TEXT, case_id TEXT, approver TEXT,
  disposition TEXT NOT NULL CHECK (disposition IN ('APPROVED','ESCALATED','BLOCKED')),
  checks JSONB NOT NULL, params JSONB NOT NULL, cited_sections TEXT[] NOT NULL DEFAULT '{}',
  prev_hash TEXT NOT NULL, hash TEXT NOT NULL, visibility TEXT NOT NULL CHECK (visibility IN ('internal','public')),
  PRIMARY KEY (tenant_id, id), UNIQUE (tenant_id, seq), UNIQUE (tenant_id, hash)
);
CREATE INDEX IF NOT EXISTS attestations_tenant_ts ON attestations (tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS attestations_tenant_action ON attestations (tenant_id, action);
CREATE INDEX IF NOT EXISTS attestations_checks_gin ON attestations USING GIN (checks);

CREATE TABLE IF NOT EXISTS policy_versions (
  policy_id TEXT NOT NULL, version TEXT NOT NULL, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL, effective_from DATE NOT NULL, superseded_by TEXT, PRIMARY KEY (tenant_id, policy_id, version)
);
CREATE TABLE IF NOT EXISTS policy_sections (
  id TEXT NOT NULL, policy_id TEXT NOT NULL, version TEXT NOT NULL, tenant_id TEXT NOT NULL REFERENCES tenants(id),
  section TEXT NOT NULL, title TEXT NOT NULL, page INTEGER NOT NULL, text TEXT NOT NULL, hash TEXT NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', title || ' ' || text)) STORED,
  PRIMARY KEY (tenant_id, id), FOREIGN KEY (tenant_id, policy_id, version) REFERENCES policy_versions (tenant_id, policy_id, version)
);
CREATE INDEX IF NOT EXISTS policy_sections_tsv ON policy_sections USING GIN (tsv);

-- Append-only audit of every question asked, the exact query executed, and what was returned.
CREATE TABLE IF NOT EXISTS query_audits (
  id UUID PRIMARY KEY, tenant_id TEXT NOT NULL REFERENCES tenants(id), user_id TEXT NOT NULL, role TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL, question TEXT NOT NULL, query JSONB, record_ids TEXT[] NOT NULL, policy_section_ids TEXT[] NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('ANSWERED','DENIED','UNSUPPORTED')), reason TEXT, prev_hash TEXT NOT NULL, hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS query_audits_tenant_ts ON query_audits (tenant_id, timestamp);
-- No UPDATE/DELETE on audits, ever.
CREATE OR REPLACE FUNCTION forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'query_audits is append-only'; END $$;
DROP TRIGGER IF EXISTS query_audits_immutable ON query_audits;
CREATE TRIGGER query_audits_immutable BEFORE UPDATE OR DELETE ON query_audits FOR EACH ROW EXECUTE FUNCTION forbid_change();
