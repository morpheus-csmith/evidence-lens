-- Row-level security: the database enforces the tenant boundary even if application code fails.
-- The application runs each request in a transaction after: SELECT set_config('app.tenant_id', $tenant, true);
-- Connect as a role that is NOT the table owner / superuser (owners bypass RLS unless FORCE is set).
CREATE ROLE evidence_app NOINHERIT LOGIN PASSWORD 'change-me';
GRANT USAGE ON SCHEMA public TO evidence_app;
GRANT SELECT ON tenants, users, attestations, policy_versions, policy_sections TO evidence_app;
GRANT SELECT, INSERT ON query_audits TO evidence_app;

ALTER TABLE attestations     ENABLE ROW LEVEL SECURITY; ALTER TABLE attestations     FORCE ROW LEVEL SECURITY;
ALTER TABLE policy_sections  ENABLE ROW LEVEL SECURITY; ALTER TABLE policy_sections  FORCE ROW LEVEL SECURITY;
ALTER TABLE policy_versions  ENABLE ROW LEVEL SECURITY; ALTER TABLE policy_versions  FORCE ROW LEVEL SECURITY;
ALTER TABLE query_audits     ENABLE ROW LEVEL SECURITY; ALTER TABLE query_audits     FORCE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY; ALTER TABLE users            FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_att ON attestations    USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_sec ON policy_sections USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_pv  ON policy_versions USING (tenant_id = current_setting('app.tenant_id', true));
CREATE POLICY tenant_isolation_aud ON query_audits    USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));
-- users: login lookup by id must work before a tenant is set, so allow reads of the single row by id via a SECURITY DEFINER function in production; prototype allows tenant-scoped reads only.
CREATE POLICY tenant_isolation_usr ON users USING (tenant_id = current_setting('app.tenant_id', true));
