/** Prototype session tokens: HS256 JWT-shaped tokens signed with SESSION_SECRET.
 *  Claims carry sub (user id), tid (tenant id), role, name. The Principal is derived ONLY
 *  from the verified token — the tenant is never read from the request body or URL.
 *  Production: replace with the identity provider's tokens and verify its signature/issuer. */
import { hmac, safeEqual } from "../domain/hash.js";
import type { Principal, Role } from "../domain/types.js";

const b64u = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const fromB64u = (s: string) => Buffer.from(s, "base64url").toString("utf8");

export interface Claims { sub: string; tid: string; role: Role; name: string; iat: number; exp: number; }

export function issueToken(secret: string, c: Omit<Claims, "iat" | "exp">, ttlSeconds = 8 * 3600): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64u(JSON.stringify({ ...c, iat: now, exp: now + ttlSeconds }));
  const sig = b64u(Buffer.from(hmac(secret, `${header}.${payload}`), "hex"));
  return `${header}.${payload}.${sig}`;
}

export function verifyToken(secret: string, token: string): Principal | null {
  const parts = token.split("."); if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const expected = b64u(Buffer.from(hmac(secret, `${h}.${p}`), "hex"));
  if (!safeEqual(expected, s)) return null;
  let claims: Claims; try { claims = JSON.parse(fromB64u(p)); } catch { return null; }
  if (typeof claims.exp !== "number" || claims.exp < Math.floor(Date.now() / 1000)) return null;
  if (!claims.sub || !claims.tid || !claims.role) return null;
  return { userId: claims.sub, tenantId: claims.tid, role: claims.role, name: claims.name ?? claims.sub };
}
