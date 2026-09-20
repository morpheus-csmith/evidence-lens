-- Semantic path storage. Enable pgvector (available on Supabase/Neon free tiers and the pgvector/pgvector Docker image).
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE policy_sections ADD COLUMN IF NOT EXISTS embedding vector(1536);   -- text-embedding-3-small; change dims if you use another model
CREATE INDEX IF NOT EXISTS policy_sections_embedding ON policy_sections USING hnsw (embedding vector_cosine_ops);

-- Hybrid retrieval, scoped: the application passes the tenant (via RLS), the policy versions cited by the retrieved
-- attestations, the query embedding and the query text. Never search across tenants or unrelated policies.
-- Example:
--   SELECT id, section, title, page,
--          0.55 * ts_rank(tsv, plainto_tsquery('english', $1)) / NULLIF(max(ts_rank(tsv, plainto_tsquery('english', $1))) OVER (), 0)
--        + 0.45 * (1 - (embedding <=> $2::vector)) AS score
--   FROM policy_sections
--   WHERE (policy_id, version) IN (($3,$4), ($5,$6))
--   ORDER BY score DESC LIMIT 3;
