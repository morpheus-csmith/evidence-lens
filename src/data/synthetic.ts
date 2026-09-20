/** Entirely fictional tenants, users, policies and attestations. No real jurisdictions, people or plates. */
import { attestationHash, sha256 } from "../domain/hash.js";
import type { Attestation, AttestationCheck, PolicySection, PolicyVersion, Tenant, User } from "../domain/types.js";

export const TENANTS: Tenant[] = [
  { id: "t-northbridge", name: "City of Northbridge", kind: "municipality" },
  { id: "t-westford", name: "Westford County Sheriff", kind: "municipality" },
  { id: "t-harbor", name: "Harbor Capital Partners", kind: "fund" },
];

export const USERS: User[] = [
  { id: "u-nb-inv", tenantId: "t-northbridge", name: "Det. R. Alvarez", role: "investigator" },
  { id: "u-nb-comp", tenantId: "t-northbridge", name: "M. Okafor (Compliance)", role: "compliance" },
  { id: "u-nb-cit", tenantId: "t-northbridge", name: "Public Reviewer", role: "citizen_reviewer" },
  { id: "u-wf-inv", tenantId: "t-westford", name: "Dep. T. Nguyen", role: "investigator" },
  { id: "u-wf-comp", tenantId: "t-westford", name: "L. Brandt (Audit)", role: "compliance" },
  { id: "u-hc-inv", tenantId: "t-harbor", name: "Fund Ops Analyst", role: "investigator" },
  { id: "u-hc-comp", tenantId: "t-harbor", name: "Chief Compliance Officer", role: "compliance" },
];

function sec(tenantId: string, policyId: string, version: string, section: string, title: string, page: number, text: string): PolicySection {
  const id = `${policyId}@${version}#${section}`;
  return { id, policyId, version, tenantId, section, title, page, text, hash: sha256(`${id}|${text}`) };
}

export const POLICIES: PolicyVersion[] = [
  { policyId: "ALPR-USE", version: "2.1", tenantId: "t-northbridge", title: "Northbridge Automated Plate Reader Use Policy", effectiveFrom: "2026-03-01", supersededBy: null, sections: [
    sec("t-northbridge", "ALPR-USE", "2.1", "3.1", "Permitted purposes", 4, "Plate-reader data may be queried only for a criminal investigation, a felony warrant, a missing or endangered person, or a stolen vehicle. Data shall not be used for the enforcement of traffic violations. Each query shall state one of these purposes."),
    sec("t-northbridge", "ALPR-USE", "2.1", "3.2", "Case linkage", 4, "A query shall be linked to an open case number in the records management system before it is executed. A query without a case number shall not run. Supervisors may not waive this requirement."),
    sec("t-northbridge", "ALPR-USE", "2.1", "4.1", "Scope and supervisor approval", 6, "A query covering more than one plate, more than 72 hours, or a geographic area rather than a plate is a wide query and requires approval by a supervisor of rank sergeant or above before execution. Bulk export requires approval by the chief or designee."),
    sec("t-northbridge", "ALPR-USE", "2.1", "5.1", "Sharing with other agencies", 8, "Records may be disclosed to another criminal justice agency only on a written request that states a legitimate law enforcement purpose and only if that agency appears in the city's sharing registry. Disclosure for immigration enforcement is prohibited."),
    sec("t-northbridge", "ALPR-USE", "2.1", "6.1", "Retention", 9, "Captured data shall be purged thirty days after capture unless preserved by a written preservation request or a search warrant. The system shall produce a proof of purge at each retention boundary."),
    sec("t-northbridge", "ALPR-USE", "2.1", "7.1", "Automated stops", 11, "No stop shall be initiated from a plate-reader alert unless the read confidence exceeds 0.90, the hotlist entry was refreshed within 24 hours, and the officer has visually confirmed the plate and state."),
    sec("t-northbridge", "ALPR-USE", "2.1", "8.1", "Audit", 12, "Every query, share and purge shall be recorded in a tamper-evident log. The compliance officer shall audit the log quarterly and publish aggregate figures that can be verified against the log."),
  ]},
  { policyId: "ALPR-USE", version: "2.0", tenantId: "t-northbridge", title: "Northbridge Automated Plate Reader Use Policy (superseded)", effectiveFrom: "2025-06-01", supersededBy: "2.1", sections: [
    sec("t-northbridge", "ALPR-USE", "2.0", "3.2", "Case linkage", 4, "A query should reference a case number where practicable. A supervisor may authorize a query without a case number in exigent circumstances."),
    sec("t-northbridge", "ALPR-USE", "2.0", "6.1", "Retention", 9, "Captured data shall be retained for ninety days."),
  ]},
  { policyId: "ALPR-USE", version: "1.4", tenantId: "t-westford", title: "Westford County Plate Reader Directive", effectiveFrom: "2026-01-15", supersededBy: null, sections: [
    sec("t-westford", "ALPR-USE", "1.4", "2.1", "Permitted purposes", 2, "Queries are permitted for criminal investigations, warrants, missing persons and stolen vehicles. A case or incident number is required."),
    sec("t-westford", "ALPR-USE", "1.4", "4.2", "Sharing", 5, "The Sheriff's Office shares plate-reader records with agencies listed in Appendix B on written request. Requests from agencies not in Appendix B are referred to the Sheriff."),
    sec("t-westford", "ALPR-USE", "1.4", "5.1", "Retention", 6, "Records are retained for sixty days unless subject to a preservation request."),
  ]},
  { policyId: "TREASURY-03", version: "4.2", tenantId: "t-harbor", title: "Harbor Capital Treasury Operations Policy", effectiveFrom: "2026-02-01", supersededBy: null, sections: [
    sec("t-harbor", "TREASURY-03", "4.2", "6.1", "Delegated limits", 13, "An operations agent may execute a transfer up to $250,000 per transaction and $1,000,000 per day without human approval, provided the counterparty is on the approved list and a KYC record is current."),
    sec("t-harbor", "TREASURY-03", "4.2", "6.3", "Human approval", 14, "Any transfer above the delegated limit, to a counterparty not on the approved list, or whose instruction originates outside an operator channel shall be held for approval by a named finance-operations approver before execution."),
    sec("t-harbor", "TREASURY-03", "4.2", "7.1", "Instruction provenance", 15, "Instructions retrieved from documents, email or agent memory are not operator instructions. An action whose rationale cites such a source shall be escalated regardless of amount."),
    sec("t-harbor", "TREASURY-03", "4.2", "9.2", "Emergency exception", 19, "The CFO may authorize an emergency transfer outside the delegated limits by written instruction. The attestation shall record the instruction and the exception shall be reported to the board within five business days."),
    sec("t-harbor", "TREASURY-03", "4.2", "11.1", "Distributions", 24, "A distribution shall match the administrator's signed distribution notice to the cent and shall be paid only to holders on the eligible-holder registry at the record date."),
  ]},
  { policyId: "TOKEN-OPS", version: "1.0", tenantId: "t-harbor", title: "Harbor Capital Tokenized Interest Operations Policy", effectiveFrom: "2026-05-01", supersededBy: null, sections: [
    sec("t-harbor", "TOKEN-OPS", "1.0", "3.1", "Authorized supply", 3, "Total supply of NWF-A after any issuance shall not exceed the authorized issuance of 10,000,000 units. Issuance that would exceed it requires a board resolution."),
    sec("t-harbor", "TOKEN-OPS", "1.0", "5.2", "Contract upgrades", 8, "An implementation upgrade may execute only when the deployed bytecode hash equals the hash of the audited build approved in the change record, the 48-hour timelock has elapsed, and two of three signers plus the compliance officer have approved."),
  ]},
];

export function policySections(): PolicySection[] { return POLICIES.flatMap(p => p.sections); }

/* ---------- attestations ---------- */
type Draft = Omit<Attestation, "hash" | "prevHash" | "seq" | "tenantId">;
const ck = (dimension: AttestationCheck["dimension"], name: string, outcome: AttestationCheck["outcome"], detail: string): AttestationCheck => ({ dimension, name, outcome, detail });

function chain(tenantId: string, drafts: Draft[]): Attestation[] {
  let prev = "GENESIS"; const out: Attestation[] = [];
  drafts.forEach((d, i) => {
    const body: Omit<Attestation, "hash"> = { ...d, tenantId, seq: i + 1, prevHash: prev };
    const hash = attestationHash(body);
    const a: Attestation = { ...body, hash };
    out.push(a); prev = hash;
  });
  return out;
}

const NB: Draft[] = [
  { id: "A-2001", timestamp: "2026-07-02T14:11:00Z", actor: "u-nb-inv", action: "alpr.lookup", tier: "T1", policyId: "ALPR-USE", policyVersion: "2.1", purpose: "criminal_investigation", caseId: "NB-26-04471", approver: null, disposition: "APPROVED", visibility: "public",
    checks: [ck("PoC", "Case linkage", "PASS", "Case NB-26-04471 open in RMS."), ck("PoG", "Scope", "PASS", "Single plate, 48h window."), ck("PoC", "Purpose", "PASS", "criminal_investigation is a permitted purpose (§3.1)."), ck("PoR", "Repeat-query pattern", "PASS", "No prior queries of this plate by requester.")],
    params: { plate: "SYN-4471", windowHours: 48 }, citedSections: ["ALPR-USE@2.1#3.1", "ALPR-USE@2.1#3.2"] },
  { id: "A-2002", timestamp: "2026-07-03T09:30:00Z", actor: "u-nb-inv", action: "alpr.lookup", tier: "T2", policyId: "ALPR-USE", policyVersion: "2.1", purpose: "criminal_investigation", caseId: null, approver: null, disposition: "BLOCKED", visibility: "public",
    checks: [ck("PoC", "Case linkage", "FAIL", "No case number supplied; §3.2 requires one before execution."), ck("PoG", "Scope", "PASS", "Single plate.")],
    params: { plate: "SYN-8812", windowHours: 24 }, citedSections: ["ALPR-USE@2.1#3.2"] },
  { id: "A-2003", timestamp: "2026-07-05T16:45:00Z", actor: "u-nb-inv", action: "alpr.area_search", tier: "T2", policyId: "ALPR-USE", policyVersion: "2.1", purpose: "criminal_investigation", caseId: "NB-26-04502", approver: "sgt-kim", disposition: "APPROVED", visibility: "public",
    checks: [ck("PoC", "Case linkage", "PASS", "Case NB-26-04502 open."), ck("PoG", "Scope", "PASS", "Wide query (area, 30 days) approved by Sgt. Kim per §4.1."), ck("PoC", "Sensitive locations", "PASS", "Area excludes registered sensitive sites.")],
    params: { area: "grid-17", windowDays: 30, vehiclesReturned: 1840 }, citedSections: ["ALPR-USE@2.1#4.1", "ALPR-USE@2.1#3.2"] },
  { id: "A-2004", timestamp: "2026-07-09T11:02:00Z", actor: "u-nb-inv", action: "alpr.area_search", tier: "T2", policyId: "ALPR-USE", policyVersion: "2.1", purpose: "criminal_investigation", caseId: "NB-26-04502", approver: null, disposition: "ESCALATED", visibility: "public",
    checks: [ck("PoG", "Scope", "FAIL", "Wide query without supervisor approval; held per §4.1."), ck("PoC", "Case linkage", "PASS", "Case open.")],
    params: { area: "grid-18", windowDays: 14 }, citedSections: ["ALPR-USE@2.1#4.1"] },
  { id: "A-2005", timestamp: "2026-07-12T08:20:00Z", actor: "svc-share", action: "alpr.share", tier: "T2", policyId: "ALPR-USE", policyVersion: "2.1", purpose: "criminal_investigation", caseId: "NB-26-04471", approver: "u-nb-comp", disposition: "APPROVED", visibility: "public",
    checks: [ck("PoC", "Sharing registry", "PASS", "Westford County Sheriff is in the sharing registry; written request WR-118 on file (§5.1)."), ck("PoC", "Prohibited purpose", "PASS", "Purpose is not immigration enforcement.")],
    params: { recipient: "t-westford", records: 3, writtenRequest: "WR-118" }, citedSections: ["ALPR-USE@2.1#5.1"] },
  { id: "A-2006", timestamp: "2026-07-14T19:55:00Z", actor: "svc-share", action: "alpr.share", tier: "T3", policyId: "ALPR-USE", policyVersion: "2.1", purpose: "other", caseId: null, approver: null, disposition: "BLOCKED", visibility: "public",
    checks: [ck("PoC", "Sharing registry", "FAIL", "Requesting agency 'Federal Task Force 9' is not in the sharing registry."), ck("PoC", "Prohibited purpose", "FAIL", "Stated purpose falls under immigration enforcement; prohibited by §5.1.")],
    params: { recipient: "ext-ftf9", records: 412 }, citedSections: ["ALPR-USE@2.1#5.1"] },
  { id: "A-2007", timestamp: "2026-07-20T03:14:00Z", actor: "svc-hotlist", action: "dispatch.initiate_stop", tier: "T3", policyId: "ALPR-USE", policyVersion: "2.1", purpose: "stolen_vehicle", caseId: "NB-26-04610", approver: null, disposition: "BLOCKED", visibility: "public",
    checks: [ck("PoR", "Read confidence", "FAIL", "Read confidence 0.71 < 0.90 threshold (§7.1)."), ck("PoR", "Hotlist freshness", "FAIL", "Hotlist entry last refreshed 9 days ago; vehicle reported recovered."), ck("PoG", "Visual confirmation", "FAIL", "No officer confirmation recorded.")],
    params: { plate: "SYN-2290", confidence: 0.71, hotlistAgeHours: 216 }, citedSections: ["ALPR-USE@2.1#7.1"] },
  { id: "A-2008", timestamp: "2026-07-31T00:00:00Z", actor: "svc-retention", action: "alpr.purge", tier: "T1", policyId: "ALPR-USE", policyVersion: "2.1", purpose: "retention", caseId: null, approver: null, disposition: "APPROVED", visibility: "public",
    checks: [ck("PoC", "Retention boundary", "PASS", "Purged 91,204 captures older than 30 days; 12 preserved under warrants (§6.1)."), ck("PoR", "Proof of purge", "PASS", "Purge digest recorded.")],
    params: { purged: 91204, preserved: 12 }, citedSections: ["ALPR-USE@2.1#6.1"] },
  { id: "A-2009", timestamp: "2026-08-02T10:10:00Z", actor: "u-nb-inv", action: "alpr.lookup", tier: "T1", policyId: "ALPR-USE", policyVersion: "2.1", purpose: "criminal_investigation", caseId: "NB-26-04471", approver: null, disposition: "ESCALATED", visibility: "internal",
    checks: [ck("PoR", "Repeat-query pattern", "FAIL", "Fourth query of plate SYN-4471 by same requester in 30 days without new case activity; referred to compliance."), ck("PoC", "Case linkage", "PASS", "Case open.")],
    params: { plate: "SYN-4471", windowHours: 24 }, citedSections: ["ALPR-USE@2.1#3.2", "ALPR-USE@2.1#8.1"] },
  { id: "A-2010", timestamp: "2026-08-15T13:00:00Z", actor: "u-nb-inv", action: "alpr.bulk_export", tier: "T3", policyId: "ALPR-USE", policyVersion: "2.1", purpose: "criminal_investigation", caseId: "NB-26-04688", approver: "chief-designee", disposition: "APPROVED", visibility: "public",
    checks: [ck("PoG", "Scope", "PASS", "Bulk export approved by chief's designee (§4.1)."), ck("PoC", "Case linkage", "PASS", "Case open."), ck("PoC", "Data minimization", "PASS", "Export limited to 3 plates over 7 days.")],
    params: { plates: 3, windowDays: 7 }, citedSections: ["ALPR-USE@2.1#4.1"] },
];

const WF: Draft[] = [
  { id: "A-3001", timestamp: "2026-07-06T12:00:00Z", actor: "u-wf-inv", action: "alpr.lookup", tier: "T1", policyId: "ALPR-USE", policyVersion: "1.4", purpose: "warrant", caseId: "WF-26-0910", approver: null, disposition: "APPROVED", visibility: "public",
    checks: [ck("PoC", "Case linkage", "PASS", "Incident WF-26-0910 open."), ck("PoC", "Purpose", "PASS", "warrant permitted (§2.1).")],
    params: { plate: "SYN-5150", windowHours: 72 }, citedSections: ["ALPR-USE@1.4#2.1"] },
  { id: "A-3002", timestamp: "2026-07-12T08:25:00Z", actor: "svc-share", action: "alpr.receive", tier: "T1", policyId: "ALPR-USE", policyVersion: "1.4", purpose: "criminal_investigation", caseId: "WF-26-0915", approver: null, disposition: "APPROVED", visibility: "public",
    checks: [ck("PoC", "Sharing", "PASS", "Received 3 records from Northbridge under WR-118 (§4.2).")],
    params: { source: "t-northbridge", records: 3 }, citedSections: ["ALPR-USE@1.4#4.2"] },
  { id: "A-3003", timestamp: "2026-08-01T17:40:00Z", actor: "u-wf-inv", action: "alpr.lookup", tier: "T1", policyId: "ALPR-USE", policyVersion: "1.4", purpose: "criminal_investigation", caseId: null, approver: null, disposition: "BLOCKED", visibility: "public",
    checks: [ck("PoC", "Case linkage", "FAIL", "No incident number (§2.1).")],
    params: { plate: "SYN-7777", windowHours: 24 }, citedSections: ["ALPR-USE@1.4#2.1"] },
];

const HC: Draft[] = [
  { id: "A-1041", timestamp: "2026-08-04T15:02:00Z", actor: "finance-ops-agent", action: "treasury.transfer", tier: "T2", policyId: "TREASURY-03", policyVersion: "4.2", purpose: "vendor_payment", caseId: "INV-2291", approver: null, disposition: "APPROVED", visibility: "internal",
    checks: [ck("PoG", "Delegated limit", "PASS", "$125,000 within $250,000 per-transaction limit (§6.1)."), ck("PoC", "Counterparty", "PASS", "Northwind Capital on approved list; KYC current."), ck("PoE", "Rationale traceability", "PASS", "Traces to INV-2291 and payment schedule."), ck("PoR", "Instruction provenance", "PASS", "Operator channel.")],
    params: { amount: 125000, counterparty: "Northwind Capital", origin: "operator" }, citedSections: ["TREASURY-03@4.2#6.1"] },
  { id: "A-1042", timestamp: "2026-08-05T10:47:00Z", actor: "finance-ops-agent", action: "treasury.transfer", tier: "T3", policyId: "TREASURY-03", policyVersion: "4.2", purpose: "vendor_payment", caseId: "INV-2304", approver: "j.hale (finance-ops)", disposition: "APPROVED", visibility: "internal",
    checks: [ck("PoG", "Delegated limit", "FAIL", "$1,200,000 exceeds $250,000 per-transaction limit (§6.1); held for approval."), ck("PoG", "Human approval", "PASS", "Approved by j.hale, finance-ops approver (§6.3)."), ck("PoC", "Counterparty", "PASS", "Approved list; KYC current."), ck("PoR", "Instruction provenance", "PASS", "Operator channel.")],
    params: { amount: 1200000, counterparty: "Northwind Capital", origin: "operator" }, citedSections: ["TREASURY-03@4.2#6.1", "TREASURY-03@4.2#6.3"] },
  { id: "A-1043", timestamp: "2026-08-06T09:12:00Z", actor: "finance-ops-agent", action: "treasury.transfer", tier: "T3", policyId: "TREASURY-03", policyVersion: "4.2", purpose: "vendor_payment", caseId: "vendor-invoice-0917.pdf", approver: null, disposition: "BLOCKED", visibility: "internal",
    checks: [ck("PoR", "Instruction provenance", "FAIL", "Instruction originates in retrieved PDF; matches injection signature IPI-0417 (§7.1)."), ck("PoC", "Counterparty", "FAIL", "0xd4e9…77 not on approved list; no KYC record."), ck("PoE", "Rationale traceability", "FAIL", "Rationale cites document text, not schedule.")],
    params: { amount: 340000, counterparty: "0xd4e9…77", origin: "retrieved_document" }, citedSections: ["TREASURY-03@4.2#7.1", "TREASURY-03@4.2#6.3"] },
  { id: "A-1044", timestamp: "2026-08-12T18:30:00Z", actor: "cfo", action: "treasury.transfer", tier: "T3", policyId: "TREASURY-03", policyVersion: "4.2", purpose: "emergency", caseId: "CFO-EX-07", approver: "cfo", disposition: "APPROVED", visibility: "internal",
    checks: [ck("PoG", "Delegated limit", "FAIL", "$2,000,000 exceeds limits."), ck("PoC", "Emergency exception", "PASS", "CFO written instruction CFO-EX-07 recorded; board report due within 5 business days (§9.2).")],
    params: { amount: 2000000, counterparty: "Custodian settlement", origin: "operator" }, citedSections: ["TREASURY-03@4.2#9.2"] },
  { id: "A-1045", timestamp: "2026-08-20T14:00:00Z", actor: "fund-ops-agent", action: "token.distribute", tier: "T2", policyId: "TREASURY-03", policyVersion: "4.2", purpose: "distribution", caseId: "DN-2026-Q2", approver: "administrator", disposition: "APPROVED", visibility: "internal",
    checks: [ck("PoG", "Notice reconciliation", "PASS", "$412,500 matches DN-2026-Q2 (§11.1)."), ck("PoC", "Eligible holders", "PASS", "118/118 recipients on registry at record date.")],
    params: { amount: 412500, holders: 118 }, citedSections: ["TREASURY-03@4.2#11.1"] },
  { id: "A-1046", timestamp: "2026-08-22T11:11:00Z", actor: "platform-agent", action: "proxy.upgradeTo", tier: "T3", policyId: "TOKEN-OPS", policyVersion: "1.0", purpose: "change_request", caseId: "CR-118", approver: null, disposition: "BLOCKED", visibility: "internal",
    checks: [ck("PoR", "Artifact provenance", "FAIL", "Deployed hash sha256:e3a0…118f ≠ audited build sha256:9b1e…4c7a (§5.2)."), ck("PoG", "Timelock", "PASS", "48h elapsed."), ck("PoC", "Approvals", "PASS", "2-of-3 signers + compliance present.")],
    params: { build: "v2.4.0", deployedHash: "sha256:e3a0…118f", approvedHash: "sha256:9b1e…4c7a" }, citedSections: ["TOKEN-OPS@1.0#5.2"] },
  { id: "A-1047", timestamp: "2026-08-25T16:20:00Z", actor: "transfer-agent", action: "token.mint", tier: "T3", policyId: "TOKEN-OPS", policyVersion: "1.0", purpose: "subscription", caseId: "SUB-0419", approver: null, disposition: "BLOCKED", visibility: "internal",
    checks: [ck("PoG", "Authorized supply", "FAIL", "Post-mint supply 10,450,000 > 10,000,000 authorized (§3.1); board resolution required.")],
    params: { units: 1250000, supplyAfter: 10450000 }, citedSections: ["TOKEN-OPS@1.0#3.1"] },
];

export const ATTESTATIONS: Attestation[] = [...chain("t-northbridge", NB), ...chain("t-westford", WF), ...chain("t-harbor", HC)];
