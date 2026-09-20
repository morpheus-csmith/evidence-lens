/** Path 1 — deterministic retrieval over attestations.
 *  A ConstrainedQuery is validated against a strict allow-list of fields before execution,
 *  executed as plain filters, and stored verbatim in the audit so an auditor can re-run it. */
import type { Attestation, ConstrainedQuery, Disposition, Principal, Tier } from "../domain/types.js";

const DISPOSITIONS: Disposition[] = ["APPROVED", "ESCALATED", "BLOCKED"];
const TIERS: Tier[] = ["T0", "T1", "T2", "T3"];
const MAX_LIMIT = 200;
const ID_RE = /^A-\d{3,6}$/;
const TOKEN_RE = /^[\w.\-@ ()]{1,64}$/;

export class QueryValidationError extends Error {}

/** Returns a sanitized copy or throws. Unknown keys are rejected (never silently ignored). */
export function validateQuery(q: unknown): ConstrainedQuery {
  if (!q || typeof q !== "object") throw new QueryValidationError("query must be an object");
  const o = q as Record<string, unknown>;
  const allowed = new Set(["kind", "ids", "action", "actor", "disposition", "tier", "policyId", "purpose", "caseIdMissing", "checkFailed", "approverMissing", "amountGte", "from", "to", "limit", "wantPolicyText", "policyQuestion"]);
  for (const k of Object.keys(o)) if (!allowed.has(k)) throw new QueryValidationError(`unknown field: ${k}`);
  if (o.kind !== "attestations") throw new QueryValidationError("kind must be 'attestations'");
  const out: ConstrainedQuery = { kind: "attestations" };
  if (o.ids !== undefined) { if (!Array.isArray(o.ids) || o.ids.length > 50 || !o.ids.every(x => typeof x === "string" && ID_RE.test(x))) throw new QueryValidationError("ids invalid"); out.ids = o.ids as string[]; }
  for (const k of ["action", "actor", "policyId", "purpose", "checkFailed"] as const) if (o[k] !== undefined) { if (typeof o[k] !== "string" || !TOKEN_RE.test(o[k] as string)) throw new QueryValidationError(`${k} invalid`); out[k] = o[k] as string; }
  if (o.disposition !== undefined) { if (!Array.isArray(o.disposition) || !o.disposition.every(d => DISPOSITIONS.includes(d as Disposition))) throw new QueryValidationError("disposition invalid"); out.disposition = o.disposition as Disposition[]; }
  if (o.tier !== undefined) { if (!Array.isArray(o.tier) || !o.tier.every(t => TIERS.includes(t as Tier))) throw new QueryValidationError("tier invalid"); out.tier = o.tier as Tier[]; }
  for (const k of ["caseIdMissing", "approverMissing", "wantPolicyText"] as const) if (o[k] !== undefined) { if (typeof o[k] !== "boolean") throw new QueryValidationError(`${k} must be boolean`); out[k] = o[k] as boolean; }
  if (o.amountGte !== undefined) { if (typeof o.amountGte !== "number" || !isFinite(o.amountGte) || o.amountGte < 0) throw new QueryValidationError("amountGte invalid"); out.amountGte = o.amountGte; }
  for (const k of ["from", "to"] as const) if (o[k] !== undefined) { if (typeof o[k] !== "string" || isNaN(Date.parse(o[k] as string))) throw new QueryValidationError(`${k} must be ISO date`); out[k] = new Date(o[k] as string).toISOString(); }
  if (o.limit !== undefined) { if (typeof o.limit !== "number" || o.limit < 1) throw new QueryValidationError("limit invalid"); out.limit = Math.min(Math.floor(o.limit), MAX_LIMIT); }
  if (o.policyQuestion !== undefined) { if (typeof o.policyQuestion !== "string" || o.policyQuestion.length > 500) throw new QueryValidationError("policyQuestion invalid"); out.policyQuestion = o.policyQuestion; }
  return out;
}

/** Role scope: what a role may see within its own tenant. Tenant scope is applied by the store
 *  and re-checked in the service; this is the second dimension. */
export function roleFilter(p: Principal): (a: Attestation) => boolean {
  switch (p.role) {
    case "compliance": return () => true;                                   // everything in tenant
    case "investigator": return a => a.visibility === "public" || a.actor === p.userId; // public records + own actions
    case "citizen_reviewer": return a => a.visibility === "public";         // public disclosures only
  }
}

export function executeQuery(q: ConstrainedQuery, all: Attestation[], p: Principal): Attestation[] {
  // Fail closed: any record not belonging to the principal's tenant is dropped and flagged upstream.
  let rows = all.filter(a => a.tenantId === p.tenantId).filter(roleFilter(p));
  if (q.ids && q.ids.length) { const set = new Set(q.ids); return rows.filter(a => set.has(a.id)); }
  if (q.action) rows = rows.filter(a => a.action === q.action || a.action.startsWith(q.action + "."));
  if (q.actor) rows = rows.filter(a => a.actor === q.actor);
  if (q.disposition) rows = rows.filter(a => q.disposition!.includes(a.disposition));
  if (q.tier) rows = rows.filter(a => q.tier!.includes(a.tier));
  if (q.policyId) rows = rows.filter(a => a.policyId === q.policyId);
  if (q.purpose) rows = rows.filter(a => a.purpose === q.purpose);
  if (q.caseIdMissing) rows = rows.filter(a => !a.caseId);
  if (q.approverMissing) rows = rows.filter(a => !a.approver);
  if (q.checkFailed) rows = rows.filter(a => a.checks.some(c => c.outcome === "FAIL" && c.name.toLowerCase().includes(q.checkFailed!.toLowerCase())));
  if (q.amountGte !== undefined) rows = rows.filter(a => typeof a.params.amount === "number" && (a.params.amount as number) >= q.amountGte!);
  if (q.from) rows = rows.filter(a => a.timestamp >= q.from!);
  if (q.to) rows = rows.filter(a => a.timestamp <= q.to!);
  rows.sort((x, y) => x.timestamp < y.timestamp ? 1 : -1);
  return rows.slice(0, q.limit ?? 50);
}
