import type { Attestation, PolicySection, Principal, QueryAudit, Tenant, User } from "../domain/types.js";
import type { Store } from "./store.js";
import { ATTESTATIONS, POLICIES, TENANTS, USERS, policySections } from "../data/synthetic.js";

/** In-memory store seeded with synthetic data. Tenant scoping is applied on every read. */
export class MemoryStore implements Store {
  private atts: Attestation[];
  private secs: PolicySection[];
  private auditLog: QueryAudit[] = [];
  constructor(seed?: { attestations?: Attestation[]; sections?: PolicySection[] }) {
    this.atts = structuredClone(seed?.attestations ?? ATTESTATIONS);
    this.secs = structuredClone(seed?.sections ?? policySections());
  }
  async tenants() { return TENANTS; }
  async userById(id: string) { return USERS.find(u => u.id === id); }
  async usersForTenant(tenantId: string) { return USERS.filter(u => u.tenantId === tenantId); }
  async attestations(p: Principal) { return this.atts.filter(a => a.tenantId === p.tenantId); }
  async policySections(p: Principal, pv?: { policyId: string; version: string }[]) {
    const mine = this.secs.filter(s => s.tenantId === p.tenantId);
    if (!pv || pv.length === 0) return mine;
    return mine.filter(s => pv.some(x => x.policyId === s.policyId && x.version === s.version));
  }
  async appendAudit(a: QueryAudit) { this.auditLog.push(a); }
  async audits(p: Principal) { return this.auditLog.filter(a => a.tenantId === p.tenantId); }
  async lastAuditHash(tenantId: string) { const t = this.auditLog.filter(a => a.tenantId === tenantId); return t.length ? t[t.length - 1].hash : "GENESIS"; }

  /** Test hook: tamper with a stored record to demonstrate chain-break detection. */
  _tamper(id: string, mutate: (a: Attestation) => void) { const a = this.atts.find(x => x.id === id); if (a) mutate(a); }
  /** Test hook: inject a policy section (e.g. one containing a prompt-injection attempt). */
  _addSection(s: PolicySection) { this.secs.push(s); }
  static policyVersionsFor(tenantId: string) { return POLICIES.filter(p => p.tenantId === tenantId).map(p => ({ policyId: p.policyId, version: p.version, supersededBy: p.supersededBy ?? null })); }
}
