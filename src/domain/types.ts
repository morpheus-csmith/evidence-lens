/** Core domain types for EvidenceLens.
 *  Every customer-owned record carries a tenantId. The tenant is always derived from the
 *  verified principal, never from a request parameter. */

export type Role = "investigator" | "compliance" | "citizen_reviewer";

export interface Tenant { id: string; name: string; kind: "municipality" | "fund" | "enterprise"; }

export interface User { id: string; tenantId: string; name: string; role: Role; }

export type Tier = "T0" | "T1" | "T2" | "T3";
export type Disposition = "APPROVED" | "ESCALATED" | "BLOCKED";
export type CheckOutcome = "PASS" | "FAIL";

export interface AttestationCheck { dimension: "PoG" | "PoE" | "PoR" | "PoC"; name: string; outcome: CheckOutcome; detail: string; }

export interface Attestation {
  id: string;                 // e.g. A-1042
  tenantId: string;
  seq: number;                // position in the tenant's chain
  timestamp: string;          // ISO
  actor: string;              // agent or user that requested the action
  action: string;             // e.g. treasury.transfer, alpr.lookup
  tier: Tier;
  policyId: string;           // e.g. TREASURY-03
  policyVersion: string;      // e.g. 4.2
  purpose?: string;           // e.g. criminal_investigation
  caseId?: string | null;     // required by some policies
  approver?: string | null;
  disposition: Disposition;
  checks: AttestationCheck[];
  params: Record<string, string | number | boolean | null>;
  citedSections: string[];    // policy section ids this attestation relied on
  prevHash: string;           // hash of previous attestation in tenant chain ("GENESIS" for first)
  hash: string;               // sha256 over canonical body + prevHash
  /** Visibility beyond the owning tenant's investigators/compliance. Citizen reviewers see only 'public' records. */
  visibility: "internal" | "public";
}

export interface PolicySection { id: string; policyId: string; version: string; tenantId: string; section: string; title: string; page: number; text: string; hash: string; }

export interface PolicyVersion { policyId: string; version: string; tenantId: string; title: string; effectiveFrom: string; supersededBy?: string | null; sections: PolicySection[]; }

/** A constrained, validated query the application executes. The model (or the rule planner)
 *  proposes it; application code validates it against the schema and the principal's scope. */
export interface ConstrainedQuery {
  kind: "attestations";
  /** Exact record ids. If present, other filters are ignored except tenant/role scope. */
  ids?: string[];
  action?: string;
  actor?: string;
  disposition?: Disposition[];
  tier?: Tier[];
  policyId?: string;
  purpose?: string;
  caseIdMissing?: boolean;
  checkFailed?: string;         // name of a check that failed
  approverMissing?: boolean;
  amountGte?: number;           // params.amount >= x
  from?: string; to?: string;   // ISO bounds on timestamp
  limit?: number;               // hard-capped by the executor
  wantPolicyText?: boolean;     // whether to run the scoped semantic path
  policyQuestion?: string;      // natural-language question for the policy path
}

export interface Principal { userId: string; tenantId: string; role: Role; name: string; }

export interface Citation { kind: "attestation" | "policy_section"; id: string; hash: string; label: string; }

export interface PolicyHit { section: PolicySection; score: number; lexical: number; semantic: number; }

export interface Answer {
  ok: boolean;
  question: string;
  query: ConstrainedQuery | null;       // the exact query executed (reproducible)
  records: Attestation[];               // authorized records only
  policyHits: PolicyHit[];              // scoped to policies cited by the records
  narrative: string;
  citations: Citation[];
  denied?: { reason: string };
  auditId: string;
  chainVerified: boolean;
}

export interface QueryAudit {
  id: string; tenantId: string; userId: string; role: Role; timestamp: string;
  question: string; query: ConstrainedQuery | null; recordIds: string[]; policySectionIds: string[];
  outcome: "ANSWERED" | "DENIED" | "UNSUPPORTED"; reason?: string; prevHash: string; hash: string;
}
