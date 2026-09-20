/** EvidenceLens service: authenticate → plan → validate → execute (tenant + role scoped) →
 *  scoped policy retrieval → narrate → cite → audit. Fails closed at every boundary. */
import { randomUUID } from "node:crypto";
import { auditHash, verifyChain } from "../domain/hash.js";
import type { Answer, Attestation, Citation, ConstrainedQuery, PolicyHit, Principal, QueryAudit } from "../domain/types.js";
import type { Planner } from "../retrieval/planner.js";
import { executeQuery, QueryValidationError, validateQuery } from "../retrieval/query.js";
import type { SemanticIndex } from "../retrieval/semantic.js";
import type { Narrator } from "../retrieval/narrator.js";
import type { Store } from "../store/store.js";

export class TenantBoundaryViolation extends Error {}

export interface Deps { store: Store; planner: Planner; index: SemanticIndex; narrator: Narrator; }

export class EvidenceLens {
  constructor(private d: Deps) {}

  /** Ask a question as a verified principal. `queryOverride` lets an auditor re-run a stored query verbatim. */
  async ask(p: Principal, question: string, queryOverride?: unknown): Promise<Answer> {
    const auditId = randomUUID();
    const deny = async (reason: string, outcome: "DENIED" | "UNSUPPORTED", query: ConstrainedQuery | null = null): Promise<Answer> => {
      await this.audit(p, auditId, question, query, [], [], outcome, reason);
      return { ok: false, question, query, records: [], policyHits: [], narrative: reason, citations: [], denied: { reason }, auditId, chainVerified: false };
    };

    // 1. Plan or accept an override; either way it is validated against the allow-list.
    let query: ConstrainedQuery | null; let policyOnly = false;
    try {
      if (queryOverride !== undefined) query = validateQuery(queryOverride);
      else { const plan = await this.d.planner.plan(question); query = plan.query; policyOnly = !!plan.policyOnly; if (!query) return deny(plan.reason ?? "Unsupported question.", "UNSUPPORTED"); }
    } catch (e) { if (e instanceof QueryValidationError) return deny(`Query rejected: ${e.message}`, "DENIED"); throw e; }

    // 2. Retrieve within tenant. Defence in depth: if the store ever returns a foreign record, abort.
    const all = await this.d.store.attestations(p);
    const foreign = all.find(a => a.tenantId !== p.tenantId);
    if (foreign) { await this.audit(p, auditId, question, query, [], [], "DENIED", "tenant boundary violation detected in store output"); throw new TenantBoundaryViolation(`store returned record ${foreign.id} from tenant ${foreign.tenantId}`); }

    // 3. Detect explicit cross-tenant asks (ids that exist elsewhere) and record the attempt.
    const records = policyOnly ? [] : executeQuery(query, all, p);
    if (query.ids?.length && records.length === 0) {
      return deny(`No record ${query.ids.join(", ")} is available to you. Records outside your tenant or role scope are not disclosed, including whether they exist.`, "DENIED", query);
    }

    // 4. Integrity: verify the tenant chain that these records belong to.
    const chain = verifyChain(all);

    // 5. Scoped semantic retrieval: only the policy versions the retrieved records cite.
    let hits: PolicyHit[] = [];
    if (query.wantPolicyText && query.policyQuestion) {
      const scope = policyOnly
        ? await this.d.store.policySections(p)                                    // all of the tenant's own policies, current or not
        : await this.d.store.policySections(p, uniq(records.map(r => ({ policyId: r.policyId, version: r.policyVersion }))));
      const scoped = scope.filter(s => s.tenantId === p.tenantId);                // belt and braces
      // Prefer the sections the records explicitly cite; fall back to hybrid search over the scoped versions.
      const cited = new Set(records.flatMap(r => r.citedSections));
      const preferred = scoped.filter(s => cited.has(s.id));
      hits = await this.d.index.search(query.policyQuestion, preferred.length ? preferred : scoped, 3);
      if (preferred.length && hits.length < 2) { const extra = await this.d.index.search(query.policyQuestion, scoped.filter(s => !cited.has(s.id)), 2); hits = [...hits, ...extra].slice(0, 3); }
    }

    // 6. Narrate from retrieved material only; citations are attached from the material, not parsed from prose.
    const narrative = await this.d.narrator.narrate(question, records, hits);
    const citations: Citation[] = [
      ...records.map(r => ({ kind: "attestation" as const, id: r.id, hash: r.hash, label: `${r.id} · ${r.action} · ${r.disposition}` })),
      ...hits.map(h => ({ kind: "policy_section" as const, id: h.section.id, hash: h.section.hash, label: `${h.section.policyId} v${h.section.version} §${h.section.section} p.${h.section.page}` })),
    ];
    const chainNote = chain.ok ? "" : `\n\nIntegrity warning: the attestation chain for this tenant does not verify at ${chain.brokenAt} (${chain.reason}). Treat these records as unverified until the discrepancy is resolved.`;

    await this.audit(p, auditId, question, query, records.map(r => r.id), hits.map(h => h.section.id), "ANSWERED");
    return { ok: true, question, query, records, policyHits: hits, narrative: narrative + chainNote, citations, auditId, chainVerified: chain.ok };
  }

  /** Verify a citation the user pastes back: does this id still hash to this value within my tenant? */
  async verifyCitation(p: Principal, id: string, hash: string): Promise<{ known: boolean; matches: boolean }> {
    const all = await this.d.store.attestations(p); const a = all.find(x => x.id === id);
    if (!a) return { known: false, matches: false };
    return { known: true, matches: a.hash === hash };
  }

  async auditTrail(p: Principal): Promise<QueryAudit[]> {
    if (p.role !== "compliance") return [];
    return this.d.store.audits(p);
  }

  private async audit(p: Principal, id: string, question: string, query: ConstrainedQuery | null, recordIds: string[], policySectionIds: string[], outcome: QueryAudit["outcome"], reason?: string) {
    const prevHash = await this.d.store.lastAuditHash(p.tenantId);
    const body: Omit<QueryAudit, "hash"> = { id, tenantId: p.tenantId, userId: p.userId, role: p.role, timestamp: new Date().toISOString(), question, query, recordIds, policySectionIds, outcome, reason, prevHash };
    await this.d.store.appendAudit({ ...body, hash: auditHash(body) });
  }
}

function uniq(xs: { policyId: string; version: string }[]) { const seen = new Set<string>(); return xs.filter(x => { const k = x.policyId + "@" + x.version; if (seen.has(k)) return false; seen.add(k); return true; }); }
export type { Attestation };
