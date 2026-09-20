/** Composition root: builds an EvidenceLens from environment. No env → fully offline prototype. */
import { EvidenceLens } from "./service/evidenceLens.js";
import { MemoryStore } from "./store/memory.js";
import { PostgresStore } from "./store/postgres.js";
import type { Store } from "./store/store.js";
import { OpenAIPlanner, RulePlanner } from "./retrieval/planner.js";
import { LocalEmbedder, OpenAIEmbedder, SemanticIndex } from "./retrieval/semantic.js";
import { OpenAINarrator, TemplateNarrator } from "./retrieval/narrator.js";

export interface AppConfig { databaseUrl?: string; openaiKey?: string; openaiModel?: string; openaiEmbedModel?: string; }

export async function buildApp(cfg: AppConfig = {}): Promise<{ lens: EvidenceLens; store: Store; mode: Record<string, string> }> {
  const store: Store = cfg.databaseUrl ? await PostgresStore.connect(cfg.databaseUrl) : new MemoryStore();
  const planner = cfg.openaiKey ? new OpenAIPlanner(cfg.openaiKey, cfg.openaiModel ?? "gpt-4o-mini") : new RulePlanner();
  const embedder = cfg.openaiKey ? new OpenAIEmbedder(cfg.openaiKey, cfg.openaiEmbedModel ?? "text-embedding-3-small") : new LocalEmbedder();
  const narrator = cfg.openaiKey ? new OpenAINarrator(cfg.openaiKey, cfg.openaiModel ?? "gpt-4o-mini") : new TemplateNarrator();
  const lens = new EvidenceLens({ store, planner, index: new SemanticIndex(embedder), narrator });
  return { lens, store, mode: { store: cfg.databaseUrl ? "postgres" : "memory(synthetic)", planner: cfg.openaiKey ? "openai" : "rules", embedder: embedder.name, narrator: cfg.openaiKey ? "openai" : "template" } };
}
