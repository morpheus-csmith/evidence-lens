/** Minimal HTTP server (node:http, no framework).
 *  POST /api/login    { userId }                → { token }         (demo: pick a synthetic user; no passwords)
 *  GET  /api/me                                  → principal + tenant
 *  GET  /api/users                               → demo users (for the role switcher)
 *  POST /api/ask      { question } | { query }   → Answer
 *  POST /api/verify   { id, hash }               → { known, matches }
 *  GET  /api/audit                               → QueryAudit[] (compliance role only)
 *  GET  /                                        → ui/index.html */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildApp } from "./app.js";
import { issueToken, verifyToken } from "./auth/session.js";
import { USERS, TENANTS } from "./data/synthetic.js";
import { TenantBoundaryViolation } from "./service/evidenceLens.js";

const PORT = Number(process.env.PORT ?? 8787);
const SECRET = process.env.SESSION_SECRET ?? "prototype-only-secret";
const here = dirname(fileURLToPath(import.meta.url));
const UI = join(here, "..", "..", "ui", "index.html");   // dist/src/server.js → ui/index.html

const json = (res: ServerResponse, code: number, body: unknown) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(body)); };
const readBody = (req: IncomingMessage) => new Promise<any>((resolve, reject) => { let s = ""; req.on("data", c => { s += c; if (s.length > 64 * 1024) { reject(new Error("body too large")); req.destroy(); } }); req.on("end", () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } }); });

const { lens, store, mode } = await buildApp({ databaseUrl: process.env.DATABASE_URL || undefined, openaiKey: process.env.OPENAI_API_KEY || undefined, openaiModel: process.env.OPENAI_MODEL, openaiEmbedModel: process.env.OPENAI_EMBED_MODEL });

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://x");
    if (req.method === "GET" && url.pathname === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(await readFile(UI)); return; }
    if (req.method === "GET" && url.pathname === "/api/users") return json(res, 200, { users: USERS.map(u => ({ ...u, tenant: TENANTS.find(t => t.id === u.tenantId)?.name })), mode });
    if (req.method === "POST" && url.pathname === "/api/login") {
      const { userId } = await readBody(req); const u = await store.userById(String(userId ?? ""));
      if (!u) return json(res, 401, { error: "unknown user" });
      return json(res, 200, { token: issueToken(SECRET, { sub: u.id, tid: u.tenantId, role: u.role, name: u.name }) });
    }
    // Everything below requires a verified principal. The tenant comes from the token only.
    const auth = req.headers.authorization ?? ""; const p = auth.startsWith("Bearer ") ? verifyToken(SECRET, auth.slice(7)) : null;
    if (!p) return json(res, 401, { error: "unauthorized" });
    if (req.method === "GET" && url.pathname === "/api/me") return json(res, 200, { principal: p, tenant: TENANTS.find(t => t.id === p.tenantId) });
    if (req.method === "POST" && url.pathname === "/api/ask") {
      const b = await readBody(req); const question = String(b.question ?? "").slice(0, 500);
      if (!question && !b.query) return json(res, 400, { error: "question or query required" });
      return json(res, 200, await lens.ask(p, question || "(re-run stored query)", b.query));
    }
    if (req.method === "POST" && url.pathname === "/api/verify") { const b = await readBody(req); return json(res, 200, await lens.verifyCitation(p, String(b.id ?? ""), String(b.hash ?? ""))); }
    if (req.method === "GET" && url.pathname === "/api/audit") { if (p.role !== "compliance") return json(res, 403, { error: "compliance role required" }); return json(res, 200, { audits: await lens.auditTrail(p) }); }
    json(res, 404, { error: "not found" });
  } catch (e: any) {
    if (e instanceof TenantBoundaryViolation) console.error("TENANT BOUNDARY VIOLATION", e.message); else console.error(e);
    if (!res.headersSent) json(res, 500, { error: e instanceof TenantBoundaryViolation ? "request aborted: tenant boundary violation recorded" : "internal error" }); else res.end();
  }
}).listen(PORT, () => console.log(`EvidenceLens prototype on http://localhost:${PORT}  mode=${JSON.stringify(mode)}`));
