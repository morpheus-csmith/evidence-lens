import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Attestation, QueryAudit } from "./types.js";

export function sha256(s: string): string { return createHash("sha256").update(s).digest("hex"); }
export function hmac(secret: string, s: string): string { return createHmac("sha256", secret).update(s).digest("hex"); }
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Canonical JSON: sorted keys, no whitespace. Stable across runtimes. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).sort().map(k => JSON.stringify(k) + ":" + canonical(o[k])).join(",") + "}";
}

/** The attestation body that is hashed: everything except hash itself. */
export function attestationBody(a: Omit<Attestation, "hash">): string {
  const { ...b } = a;
  return canonical(b);
}
export function attestationHash(a: Omit<Attestation, "hash">): string { return sha256(attestationBody(a)); }

/** Verify a tenant's chain: each record's hash recomputes and links to the previous. */
export function verifyChain(records: Attestation[]): { ok: boolean; brokenAt?: string; reason?: string } {
  const sorted = [...records].sort((x, y) => x.seq - y.seq);
  let prev = "GENESIS";
  for (const r of sorted) {
    const { hash, ...body } = r;
    if (r.prevHash !== prev) return { ok: false, brokenAt: r.id, reason: `prevHash mismatch (expected ${prev.slice(0, 12)}…)` };
    const h = sha256(canonical(body));
    if (h !== hash) return { ok: false, brokenAt: r.id, reason: "hash does not recompute — record altered" };
    prev = hash;
  }
  return { ok: true };
}

export function auditHash(a: Omit<QueryAudit, "hash">): string { return sha256(canonical(a)); }
