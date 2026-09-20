# Sentinel EvidenceLens — prototype

**Ask questions. Trace the evidence. Verify every answer.**

EvidenceLens is a permission-aware, evidence-bound retrieval layer over hash-chained attestation records and the policy documents they cite. It is a feature of SentinelPoT's Sentinel Runtime, built here as a standalone zero-to-one prototype: multi-tenant data model, two separated retrieval paths (deterministic over signed records, semantic over tenant-scoped policy text), retrieval-time authorization, source-level citations with hashes, reproducible queries, and an append-only audit of every question asked.

It runs with **no database, no API key and no npm dependencies** — synthetic data for three fictional tenants is built in. PostgreSQL (with row-level security and pgvector) and OpenAI adapters plug in through environment variables without changing the pipeline.

> Everything in this repository is synthetic. No real jurisdictions, people, plates, funds or policies.

## Quick start

```bash
git clone <this repo> && cd evidence-lens
npm install          # installs typescript only (pg is optional)
npm test             # builds and runs the 17-case suite
npm start            # http://localhost:8787
```

Open the page, pick a user from the *Acting as* menu, sign in, and click an example question. The three-role demonstration:

1. Sign in as **Westford County Sheriff — investigator** and click *Ask about A-1042 (Harbor Capital record)*. The request is refused without confirming whether the record exists.
2. Sign in as **Harbor Capital — Chief Compliance Officer** and ask *Why was A-1042 approved, and where does the policy authorize it?* You get the record, its hash, the two policy sections with page numbers, and the exact query that was executed.
3. Sign in as **Westford County Sheriff — L. Brandt (Audit)**. The denied attempt from step 1 is in the audit trail, hash-chained, with the query it tried to run.

## What is being demonstrated

| Requirement | Where it lives | How to check it |
|---|---|---|
| Zero-to-one architecture | `docs/DESIGN.md`, `src/domain/types.ts` | Data model, retrieval paths, security model and trade-offs are written down before code |
| Multi-tenant customer data | `src/store/*`, `db/002_rls.sql`, `src/service/evidenceLens.ts` | Tenant derived from the verified token only; store scopes every read; service re-checks and aborts on any foreign record; RLS enforces it in the database |
| Deterministic retrieval over signed records | `src/retrieval/query.ts` | Strict allow-list validation, reproducible query object stored in the audit, hard limits |
| Semantic retrieval (RAG path) | `src/retrieval/semantic.ts`, `db/003_vector.sql` | Hybrid lexical + embedding search, scoped to the policy versions the retrieved records cite; pluggable embedder |
| Grounded generation | `src/retrieval/narrator.ts` | Narrator sees only retrieved material; citations attached from that material, never parsed from prose |
| Integrity | `src/domain/hash.ts` | SHA-256 hash chain per tenant; altered record → chain fails → answer carries a warning |
| Evaluation | `test/evidenceLens.test.ts` | 17 cases: cross-tenant leakage, defence-in-depth abort, role scope, NL filters, policy-version matching, citation correctness, fabricated hashes, unsupported questions, allow-list enforcement, reproducibility, tamper detection, prompt injection inside a policy document, audit chaining |

## Architecture in one paragraph

A question arrives with a verified session token. The **planner** (rule-based by default; OpenAI structured output optionally) proposes a `ConstrainedQuery`; the application **validates** it against a closed field list, so a model can only fill in fields, never widen them. The **store** returns the principal's tenant only, and the **service** re-checks every record's `tenantId` and aborts the request if a foreign record ever appears. A **role filter** narrows further (compliance sees everything in the tenant; investigators see public records and their own actions; citizen reviewers see public disclosures only). The tenant's **hash chain** is verified. If the question asks *why* or about policy, the **semantic index** searches only the policy versions the retrieved records cite (or, for a policy-only question, only the tenant's own policies), preferring sections the records explicitly reference. The **narrator** produces prose from that material alone; **citations** — record ids and policy sections, each with its hash — are attached independently. The question, the exact query, the record ids, the section ids and the outcome are written to an **append-only, hash-chained audit** visible to the tenant's compliance role.

## Configuration

Copy `.env.example` to `.env`. With nothing set you get: in-memory synthetic store, rule planner, local hashed-bag-of-words embedder, template narrator.

| Variable | Effect |
|---|---|
| `OPENAI_API_KEY` | Enables the LLM planner (structured output → still validated), OpenAI embeddings for the policy path, and an LLM narrator grounded on the same retrieved material. All three fall back to the offline components on any error. |
| `DATABASE_URL` | Switches the store to PostgreSQL. Run `db/001_schema.sql`, `db/002_rls.sql`, `db/003_vector.sql` (needs the pgvector extension), then `npm run seed:pg`. Connect as the `evidence_app` role so row-level security applies. |

Free options for PostgreSQL: local Docker (`docker run -e POSTGRES_PASSWORD=dev -p 5432:5432 pgvector/pgvector:pg17`), or the Supabase / Neon free tiers, both of which ship pgvector.

## API

```
POST /api/login   { userId }              → { token }        demo users only; no passwords
GET  /api/me                              → principal, tenant
POST /api/ask     { question } | { query } → Answer          `query` re-executes a stored ConstrainedQuery verbatim
POST /api/verify  { id, hash }            → { known, matches }
GET  /api/audit                           → QueryAudit[]     compliance role only
```

`Answer` contains `narrative`, `citations[]` (id, hash, label), `records[]`, `policyHits[]`, `query` (the exact object executed), `chainVerified`, and `auditId`.

## What this is not

It is not a chatbot over documents. Structured questions never touch the embedding index; policy retrieval never leaves the tenant or the cited policy versions; and the narrator cannot introduce material that was not retrieved. It also does not make surveillance data easier to search — it lets an authorized reviewer establish whether data and AI-assisted decisions were used according to policy.

## Layout

```
src/domain        types, canonical JSON, SHA-256 chain + verifier
src/data          synthetic tenants, users, policies, attestations
src/auth          prototype HS256 session tokens → Principal
src/store         Store interface; MemoryStore; PostgresStore (RLS)
src/retrieval     query (validate/execute), planner, semantic index, narrator
src/service       EvidenceLens: the pipeline, fail-closed
src/server.ts     node:http API + static UI
ui/index.html     single-file UI with role switcher and audit panel
db/               schema, RLS policies, pgvector migration, seed
test/             node:test suite
docs/DESIGN.md    design record
```

## Status and honesty

Prototype, built in one day as a zero-to-one demonstration. Not production: sessions are demo tokens without passwords, the rule planner covers the example vocabulary, and the local embedder is a stand-in for a real model. The architecture — tenant derivation, allow-listed queries, scoped semantic retrieval, independent citations, chained audit — is the part intended to survive into production unchanged.

© 2026 Chris Smith / SentinelPoT. Provided for evaluation.
