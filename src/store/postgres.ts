/** PostgreSQL store. Loads `pg` lazily so the prototype runs without it installed.
 *  Tenant isolation is enforced twice: by the WHERE clause here and by row-level security
 *  policies in db/002_rls.sql, which read the tenant from `SET LOCAL app.tenant_id`.
 *  Even if a query in this file forgot its WHERE clause, RLS would return no foreign rows. */
import type { Attestation, PolicySection, Principal, QueryAudit, Tenant, User } from "../domain/types.js";
import type { Store } from "./store.js";

type PgClient = { query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>; release(): void };
type PgPool = { connect(): Promise<PgClient> };

export class PostgresStore implements Store {
  private pool!: PgPool;
  private constructor() {}
  static async connect(databaseUrl: string): Promise<PostgresStore> {
    const mod: any = await import("pg" as string).catch(() => { throw new Error("The 'pg' package is not installed. Run: npm install pg"); });
    const Pool = mod.default?.Pool ?? mod.Pool;
    const s = new PostgresStore(); s.pool = new Pool({ connectionString: databaseUrl }); return s;
  }
  /** Run fn inside a transaction with the tenant set for RLS. */
  private async withTenant<T>(tenantId: string, fn: (c: PgClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      const r = await fn(c); await c.query("COMMIT"); return r;
    } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
  }
  async tenants(): Promise<Tenant[]> { const c = await this.pool.connect(); try { return (await c.query("SELECT id, name, kind FROM tenants ORDER BY id")).rows; } finally { c.release(); } }
  async userById(id: string): Promise<User | undefined> { const c = await this.pool.connect(); try { return (await c.query("SELECT id, tenant_id AS \"tenantId\", name, role FROM users WHERE id=$1", [id])).rows[0]; } finally { c.release(); } }
  async usersForTenant(tenantId: string): Promise<User[]> { return this.withTenant(tenantId, async c => (await c.query("SELECT id, tenant_id AS \"tenantId\", name, role FROM users WHERE tenant_id=$1", [tenantId])).rows); }
  async attestations(p: Principal): Promise<Attestation[]> {
    return this.withTenant(p.tenantId, async c => (await c.query(
      `SELECT id, tenant_id AS "tenantId", seq, timestamp, actor, action, tier, policy_id AS "policyId", policy_version AS "policyVersion", purpose, case_id AS "caseId", approver, disposition, checks, params, cited_sections AS "citedSections", prev_hash AS "prevHash", hash, visibility
       FROM attestations WHERE tenant_id=$1 ORDER BY seq`, [p.tenantId])).rows.map(r => ({ ...r, timestamp: new Date(r.timestamp).toISOString() })));
  }
  async policySections(p: Principal, pv?: { policyId: string; version: string }[]): Promise<PolicySection[]> {
    return this.withTenant(p.tenantId, async c => {
      const base = `SELECT id, policy_id AS "policyId", version, tenant_id AS "tenantId", section, title, page, text, hash FROM policy_sections WHERE tenant_id=$1`;
      if (!pv || pv.length === 0) return (await c.query(base, [p.tenantId])).rows;
      const conds = pv.map((_, i) => `(policy_id=$${i * 2 + 2} AND version=$${i * 2 + 3})`).join(" OR ");
      return (await c.query(`${base} AND (${conds})`, [p.tenantId, ...pv.flatMap(x => [x.policyId, x.version])])).rows;
    });
  }
  async appendAudit(a: QueryAudit): Promise<void> {
    await this.withTenant(a.tenantId, async c => { await c.query(
      `INSERT INTO query_audits (id, tenant_id, user_id, role, timestamp, question, query, record_ids, policy_section_ids, outcome, reason, prev_hash, hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [a.id, a.tenantId, a.userId, a.role, a.timestamp, a.question, JSON.stringify(a.query), a.recordIds, a.policySectionIds, a.outcome, a.reason ?? null, a.prevHash, a.hash]); });
  }
  async audits(p: Principal): Promise<QueryAudit[]> {
    return this.withTenant(p.tenantId, async c => (await c.query(
      `SELECT id, tenant_id AS "tenantId", user_id AS "userId", role, timestamp, question, query, record_ids AS "recordIds", policy_section_ids AS "policySectionIds", outcome, reason, prev_hash AS "prevHash", hash FROM query_audits WHERE tenant_id=$1 ORDER BY timestamp`, [p.tenantId])).rows);
  }
  async lastAuditHash(tenantId: string): Promise<string> {
    return this.withTenant(tenantId, async c => (await c.query(`SELECT hash FROM query_audits WHERE tenant_id=$1 ORDER BY timestamp DESC LIMIT 1`, [tenantId])).rows[0]?.hash ?? "GENESIS");
  }
}
