/** Path 2 — semantic retrieval over policy sections, scoped to the policy versions the
 *  retrieved attestations actually cite. Hybrid score = lexical (BM25-lite) + cosine(embedding).
 *
 *  Embedder is pluggable. The default LocalEmbedder is a deterministic hashed bag-of-words
 *  vector (no network, no key) — good enough to demonstrate the retrieval path and to run tests
 *  offline. OpenAIEmbedder swaps in real embeddings; the rest of the pipeline is unchanged. */
import { createHash } from "node:crypto";
import type { PolicyHit, PolicySection } from "../domain/types.js";

export interface Embedder { readonly name: string; readonly dims: number; embed(texts: string[]): Promise<number[][]>; }

const STOP = new Set("a an the of to in on for and or is are be by with as at from that this it its shall may not no any each only than".split(" "));
export function tokens(s: string): string[] { return s.toLowerCase().replace(/[^a-z0-9$.%]+/g, " ").split(" ").filter(t => t && !STOP.has(t)).map(t => t.replace(/s$/, "")); }

export class LocalEmbedder implements Embedder {
  readonly name = "local-hashed-bow"; readonly dims = 256;
  async embed(texts: string[]) { return texts.map(t => {
    const v = new Array(this.dims).fill(0);
    for (const tok of tokens(t)) { const h = createHash("sha1").update(tok).digest(); const i = h.readUInt16BE(0) % this.dims; v[i] += (h[2] & 1) ? 1 : -1; }
    // bigrams add a little phrase sensitivity
    const ts = tokens(t); for (let i = 0; i + 1 < ts.length; i++) { const h = createHash("sha1").update(ts[i] + "_" + ts[i + 1]).digest(); v[h.readUInt16BE(0) % this.dims] += 0.5; }
    const n = Math.hypot(...v) || 1; return v.map(x => x / n);
  }); }
}

export class OpenAIEmbedder implements Embedder {
  readonly name: string; readonly dims = 1536;
  constructor(private apiKey: string, private model = "text-embedding-3-small") { this.name = `openai:${model}`; }
  async embed(texts: string[]) {
    const res = await fetch("https://api.openai.com/v1/embeddings", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` }, body: JSON.stringify({ model: this.model, input: texts }) });
    if (!res.ok) throw new Error(`embeddings http ${res.status}`);
    const data: any = await res.json(); return data.data.map((d: any) => d.embedding as number[]);
  }
}

export function cosine(a: number[], b: number[]) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }

/** BM25-lite lexical score over a small corpus. */
function lexical(query: string, docs: PolicySection[]): number[] {
  const qt = tokens(query); const N = docs.length; const dt = docs.map(d => tokens(d.title + " " + d.text));
  const avg = dt.reduce((s, t) => s + t.length, 0) / Math.max(1, N);
  const df = new Map<string, number>(); for (const t of dt) for (const u of new Set(t)) df.set(u, (df.get(u) ?? 0) + 1);
  return dt.map(t => { const tf = new Map<string, number>(); for (const u of t) tf.set(u, (tf.get(u) ?? 0) + 1);
    let s = 0; for (const q of qt) { const f = tf.get(q) ?? 0; if (!f) continue; const idf = Math.log(1 + (N - (df.get(q) ?? 0) + 0.5) / ((df.get(q) ?? 0) + 0.5)); s += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * t.length / avg)); } return s; });
}

export class SemanticIndex {
  private vecs = new Map<string, number[]>();
  constructor(private embedder: Embedder) {}
  async index(sections: PolicySection[]) {
    const missing = sections.filter(s => !this.vecs.has(s.id));
    if (!missing.length) return;
    const v = await this.embedder.embed(missing.map(s => s.title + ". " + s.text));
    missing.forEach((s, i) => this.vecs.set(s.id, v[i]));
  }
  /** Search only within `scope` (already tenant- and policy-version-filtered by the caller). */
  async search(question: string, scope: PolicySection[], k = 3): Promise<PolicyHit[]> {
    if (!scope.length) return [];
    await this.index(scope);
    const [qv] = await this.embedder.embed([question]);
    const lex = lexical(question, scope); const lmax = Math.max(1e-9, ...lex);
    const hits = scope.map((s, i) => { const sem = cosine(qv, this.vecs.get(s.id)!); const l = lex[i] / lmax; return { section: s, semantic: sem, lexical: l, score: 0.55 * l + 0.45 * Math.max(0, sem) }; });
    return hits.filter(h => h.score > 0.08).sort((a, b) => b.score - a.score).slice(0, k);
  }
}
