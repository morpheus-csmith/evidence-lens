/** Seed PostgreSQL with the synthetic tenants, users, policies and attestations.
 *  Usage: DATABASE_URL=postgres://... npm run seed:pg   (run db/*.sql first) */
import { ATTESTATIONS, POLICIES, TENANTS, USERS } from "../src/data/synthetic.js";
const url = process.env.DATABASE_URL; if (!url) { console.error("DATABASE_URL required"); process.exit(1); }
const mod: any = await import("pg" as string); const Pool = mod.default?.Pool ?? mod.Pool; const pool = new Pool({ connectionString: url }); const c = await pool.connect();
try {
  await c.query("BEGIN");
  for (const t of TENANTS) await c.query("INSERT INTO tenants VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING", [t.id, t.name, t.kind]);
  for (const u of USERS) await c.query("INSERT INTO users VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING", [u.id, u.tenantId, u.name, u.role]);
  for (const p of POLICIES) {
    await c.query("INSERT INTO policy_versions VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING", [p.policyId, p.version, p.tenantId, p.title, p.effectiveFrom, p.supersededBy ?? null]);
    for (const s of p.sections) await c.query("INSERT INTO policy_sections (id,policy_id,version,tenant_id,section,title,page,text,hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING", [s.id, s.policyId, s.version, s.tenantId, s.section, s.title, s.page, s.text, s.hash]);
  }
  for (const a of ATTESTATIONS) await c.query(
    "INSERT INTO attestations (id,tenant_id,seq,timestamp,actor,action,tier,policy_id,policy_version,purpose,case_id,approver,disposition,checks,params,cited_sections,prev_hash,hash,visibility) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) ON CONFLICT DO NOTHING",
    [a.id, a.tenantId, a.seq, a.timestamp, a.actor, a.action, a.tier, a.policyId, a.policyVersion, a.purpose ?? null, a.caseId ?? null, a.approver ?? null, a.disposition, JSON.stringify(a.checks), JSON.stringify(a.params), a.citedSections, a.prevHash, a.hash, a.visibility]);
  await c.query("COMMIT"); console.log(`seeded ${TENANTS.length} tenants, ${USERS.length} users, ${POLICIES.length} policy versions, ${ATTESTATIONS.length} attestations`);
} catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); await pool.end(); }
