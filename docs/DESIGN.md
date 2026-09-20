# EvidenceLens — design record

Status: v0.1 prototype · September 2026 · Chris Smith

## 1. Problem

SentinelPoT's runtime gate produces a signed, hash-chained attestation for every consequential action an AI agent or automated system takes: what was requested, which policy applied, which checks ran, what was decided, who approved. Compliance officers, auditors and investigators need to ask questions of that record — *why was this approved, which searches lacked a case number, who approved transfers above the limit, what does the policy say* — without a data engineer, without seeing other customers' data, and with answers they can verify rather than trust.

## 2. Decisions

**D1. Two retrieval paths, deliberately separated.** Structured questions about records are answered by deterministic filters over the attestation store, never by vector similarity. Auditors need complete, reproducible record sets; nearest-neighbour search returns "the closest-looking records," which cannot be attested to. Semantic (embedding + lexical) retrieval is used only for unstructured policy text, and only within the policy versions that the retrieved records cite. Consequence: a model can help translate a question, but the set of records returned is a function of the query object alone and can be re-executed by anyone with the same authorization.

**D2. The model proposes; the application disposes.** The planner (rules or LLM) emits a `ConstrainedQuery`. `validateQuery` rejects any field not on a closed allow-list, any malformed id, any out-of-range limit. A model with a jailbroken prompt can at most produce a valid, narrower query. Tenant is not a query field at all.

**D3. Tenant comes from the verified principal, three times.** (1) The session token carries `tid`; the request body is never consulted. (2) The store filters by that tenant. (3) The service re-checks every returned record and throws `TenantBoundaryViolation` — aborting the request and writing a DENIED audit — if a foreign record ever appears. In PostgreSQL, row-level security policies keyed on `app.tenant_id` make (2) hold even if a query in the store forgot its WHERE clause.

**D4. Role scope is a second dimension, inside the tenant.** Compliance: all records. Investigator: records marked public, plus actions they performed. Citizen reviewer: public disclosures only. Applied after tenant scope, before any narration.

**D5. Refusals do not confirm existence.** Asking for a record id outside your scope returns "not available to you … including whether they exist," and the attempt is audited in *your* tenant, not the target's.

**D6. Citations are attached from retrieved material, not parsed from prose.** The narrator (template or LLM) receives only what was retrieved. The service builds `citations[]` from the same record and section objects, with their hashes. A wrong or invented citation in the prose is detectable because it will not match the attached list; `verifyCitation` lets a reader confirm any id/hash pair against the tenant's chain.

**D7. Integrity is checked on read.** Every answer re-verifies the tenant's hash chain. An altered record breaks the chain at that point and the answer carries an integrity warning naming the record.

**D8. The audit is itself a chain.** Each question, the exact query executed, the returned ids and the outcome are appended with `prevHash` → `hash`. The PostgreSQL table has a trigger forbidding UPDATE and DELETE.

**D9. Zero-dependency runtime.** `node:http`, `node:crypto`, `node:test`. PostgreSQL (`pg`) and OpenAI (via `fetch`) are optional adapters behind interfaces (`Store`, `Planner`, `Embedder`, `Narrator`). The pipeline is identical in every configuration, so what the tests prove offline holds when the adapters are swapped in.

**D10. TypeScript, not Python.** The surrounding product (pot-gateway, Netlify edge functions) is TypeScript; a second runtime would add deployment and dependency surface without benefit at this stage.

## 3. Data model

```
tenants(id, name, kind)
users(id, tenant_id, name, role)
attestations(tenant_id, id, seq, timestamp, actor, action, tier, policy_id, policy_version,
             purpose, case_id, approver, disposition, checks jsonb, params jsonb,
             cited_sections[], prev_hash, hash, visibility)         PK (tenant_id, id); UNIQUE (tenant_id, seq)
policy_versions(tenant_id, policy_id, version, title, effective_from, superseded_by)
policy_sections(tenant_id, id, policy_id, version, section, title, page, text, hash, tsv, embedding)
query_audits(id, tenant_id, user_id, role, timestamp, question, query jsonb, record_ids[],
             policy_section_ids[], outcome, reason, prev_hash, hash)   append-only
```

Attestation hash = SHA-256 over canonical JSON of every field except `hash` (including `prevHash`). Canonical JSON = sorted keys, no whitespace, so the hash is stable across languages and storage.

## 4. Request pipeline

```
token ─▶ Principal{userId, tenantId, role}
question ─▶ Planner ─▶ ConstrainedQuery ─▶ validateQuery (allow-list)        ← D2
Store.attestations(principal) ─▶ tenant re-check (abort on foreign)          ← D3
executeQuery: role filter → filters → sort → limit                           ← D4
ids requested but nothing returned ─▶ DENIED (no existence leak)             ← D5
verifyChain(tenant records)                                                  ← D7
if wantPolicyText: sections = Store.policySections(principal, cited versions)
                   prefer sections the records cite; hybrid search (lexical+embedding) top-3
Narrator(question, records, hits) ─▶ prose
citations = records ∪ hits (id, hash)                                        ← D6
appendAudit(question, query, ids, outcome) chained                           ← D8
```

## 5. Threats considered

| Threat | Control | Test |
|---|---|---|
| Cross-tenant read via crafted question or id | D3, D5, RLS | `cross-tenant request is refused…`, `store returning a foreign record aborts…` |
| Model widens the query (e.g. adds tenant filter) | D2 allow-list | `query validation rejects unknown fields…` |
| Prompt injection in a policy document | Narrator treats retrieved text as data; retrieval scope unaffected | `prompt injection inside a policy document…` |
| Fabricated citation / hash | D6, `verifyCitation` | `fabricated record id / hash is not confirmed` |
| Altered stored record | D7 | `altered attestation is detected…` |
| Superseded, more permissive policy version surfacing | Scope to cited version | `policy-version matching…` |
| Over-broad role access | D4 | `role scope…` |
| Unreproducible answer | Query object stored and re-executable | `reproducibility…` |
| Audit tampering | D8; DB trigger | `audit trail is hash-chained…` |

## 6. What is deliberately not here

No passwords or identity provider (demo tokens only). No document ingestion pipeline (policy sections are pre-chunked; production adds section-aware parsing of PDF/DOCX with the same metadata). No reranker (the scoped corpus is small; add one when policy corpora grow). No rate limiting or per-tenant quotas. No multi-region or encryption-at-rest configuration; those belong to the deployment, not the prototype.

## 7. Next steps toward production

1. Identity: verify IdP-issued tokens; map groups to roles; short-lived sessions.
2. Ingestion: section-aware chunking of policy documents with version metadata and hashes; embeddings stored in `policy_sections.embedding`; nightly re-index on policy change.
3. Planner evaluation set: fixed question → expected query pairs, run in CI, tracked per planner (rules vs. model).
4. Verifier bundle: export a tenant's chain and audit as a self-contained archive checkable with SentinelPoT's open verifier.
5. Deployment: container, Postgres with RLS as the only path to data, model API egress through an allow-list, OpenTelemetry traces keyed by `auditId`.
