/** Question → ConstrainedQuery.
 *  Default: a rule-based planner (no network, deterministic, testable).
 *  Optional: an LLM planner using structured output; its proposal still passes validateQuery,
 *  so the model can never widen the allow-list — it can only fill in fields. */
import type { ConstrainedQuery } from "../domain/types.js";
import { validateQuery } from "./query.js";

export interface Planner { plan(question: string): Promise<{ query: ConstrainedQuery | null; reason?: string; policyOnly?: boolean }>; }

const ID_RE = /\bA-\d{3,6}\b/g;

export class RulePlanner implements Planner {
  async plan(question: string) {
    const q = question.toLowerCase();
    const ids = question.match(ID_RE) ?? [];
    const out: Record<string, unknown> = { kind: "attestations" };
    const wantsPolicy = /\b(policy|section|authoriz|permit|allow|require|retention|exception|justif|where does|what does)\b/.test(q);

    if (ids.length) { out.ids = ids; if (wantsPolicy || /\bwhy\b/.test(q)) { out.wantPolicyText = true; out.policyQuestion = question; } return { query: validateQuery(out) }; }

    // Pure policy questions with no record reference (e.g. "what does the retention policy require?")
    const mentionsRecords = /\b(action|actions|search|searches|query|queries|transfer|transfers|share|shares|shared|stop|stops|record|records|attestation|attestations|export|approved|blocked|escalated|denied|purge|mint|upgrade|distribution)\b/.test(q);
    if (wantsPolicy && !mentionsRecords) return { query: validateQuery({ kind: "attestations", limit: 1, wantPolicyText: true, policyQuestion: question }), policyOnly: true };

    if (/\bblocked|denied\b/.test(q)) out.disposition = ["BLOCKED"];
    else if (/\bescalat|held|pending\b/.test(q)) out.disposition = ["ESCALATED"];
    else if (/\bapproved\b/.test(q)) out.disposition = ["APPROVED"];

    if (/\bwithout (a )?case|no case|missing case|lack(ed|ing)? (a )?case/.test(q)) out.caseIdMissing = true;
    if (/\bwithout (an )?approv|no approver|unapproved/.test(q)) out.approverMissing = true;

    if (/\b(share|shares|shared|sharing|disclos)/.test(q)) out.action = "alpr.share";
    else if (/\barea search|wide (search|quer)/.test(q)) out.action = "alpr.area_search";
    else if (/\bbulk export/.test(q)) out.action = "alpr.bulk_export";
    else if (/\bstop|stops\b/.test(q)) out.action = "dispatch.initiate_stop";
    else if (/\bpurge|retention/.test(q) && mentionsRecords) out.action = "alpr.purge";
    else if (/\btransfer/.test(q)) out.action = "treasury.transfer";
    else if (/\bdistribution/.test(q)) out.action = "token.distribute";
    else if (/\bmint|issuance/.test(q)) out.action = "token.mint";
    else if (/\bupgrade/.test(q)) out.action = "proxy.upgradeTo";
    else if (/\b(plate|lookup|search|searches|quer)/.test(q)) out.action = "alpr.lookup";

    const amt = q.match(/\b(?:over|above|more than|>=?)\s*\$?\s*([\d,]+(?:\.\d+)?)\s*(k|m)?\b/);
    if (amt) { let n = parseFloat(amt[1].replace(/,/g, "")); if (amt[2] === "k") n *= 1e3; if (amt[2] === "m") n *= 1e6; out.amountGte = n; }

    const m = q.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b(?:\s+(\d{4}))?/);
    if (m) { const mi = ["january","february","march","april","may","june","july","august","september","october","november","december"].indexOf(m[1]); const y = m[2] ? +m[2] : 2026; out.from = new Date(Date.UTC(y, mi, 1)).toISOString(); out.to = new Date(Date.UTC(y, mi + 1, 1) - 1).toISOString(); }
    if (/\blast quarter|q3\b/.test(q)) { out.from = "2026-07-01T00:00:00Z"; out.to = "2026-09-30T23:59:59Z"; }

    const cf = q.match(/\bfailed\s+([a-z ]{3,30}?)\s+check/); if (cf) out.checkFailed = cf[1].trim();
    if (/\binjection|provenance/.test(q)) out.checkFailed = "provenance";
    if (/\bconfidence/.test(q)) out.checkFailed = "confidence";

    if (wantsPolicy) { out.wantPolicyText = true; out.policyQuestion = question; }

    const hasFilter = Object.keys(out).some(k => !["kind", "wantPolicyText", "policyQuestion"].includes(k));
    if (!hasFilter && !mentionsRecords) return { query: null, reason: "I can answer questions about attestation records (actions, approvals, blocks, checks, approvers, amounts, dates) and the policy sections they cite. Try naming a record id, an action type, or a disposition." };
    return { query: validateQuery(out) };
  }
}

/** Optional LLM planner (OpenAI Responses API with JSON schema). Falls back to the rule planner on any failure. */
export class OpenAIPlanner implements Planner {
  constructor(private apiKey: string, private model: string, private fallback: Planner = new RulePlanner()) {}
  async plan(question: string) {
    try {
      const schema = { type: "object", additionalProperties: false, properties: {
        kind: { type: "string", enum: ["attestations"] }, ids: { type: "array", items: { type: "string" } }, action: { type: "string" }, actor: { type: "string" },
        disposition: { type: "array", items: { type: "string", enum: ["APPROVED", "ESCALATED", "BLOCKED"] } }, tier: { type: "array", items: { type: "string", enum: ["T0", "T1", "T2", "T3"] } },
        policyId: { type: "string" }, purpose: { type: "string" }, caseIdMissing: { type: "boolean" }, checkFailed: { type: "string" }, approverMissing: { type: "boolean" },
        amountGte: { type: "number" }, from: { type: "string" }, to: { type: "string" }, limit: { type: "number" }, wantPolicyText: { type: "boolean" }, policyQuestion: { type: "string" } }, required: ["kind"] };
      const res = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({ model: this.model, input: [
          { role: "system", content: "Translate the user's question into a ConstrainedQuery over attestation records. Only use the fields in the schema. Omit fields you are not sure about. Actions include alpr.lookup, alpr.area_search, alpr.share, alpr.bulk_export, alpr.purge, dispatch.initiate_stop, treasury.transfer, token.distribute, token.mint, proxy.upgradeTo. Set wantPolicyText=true and policyQuestion when the user asks why, or about policy language." },
          { role: "user", content: question }],
          text: { format: { type: "json_schema", name: "constrained_query", schema, strict: false } } }) });
      if (!res.ok) throw new Error(`planner http ${res.status}`);
      const data: any = await res.json();
      const text = data.output_text ?? data.output?.flatMap((o: any) => o.content ?? []).find((c: any) => c.type === "output_text")?.text;
      return { query: validateQuery(JSON.parse(text)) };
    } catch { return this.fallback.plan(question); }
  }
}
