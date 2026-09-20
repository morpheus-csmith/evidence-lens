import type { Attestation, PolicySection, Principal, QueryAudit, Tenant, User } from "../domain/types.js";

/** Storage boundary. Every read takes the Principal and returns only that tenant's records.
 *  Implementations must enforce the tenant scope themselves (defence in depth); the service
 *  layer re-checks it after the fact and fails closed if a foreign record ever appears. */
export interface Store {
  tenants(): Promise<Tenant[]>;
  userById(id: string): Promise<User | undefined>;
  usersForTenant(tenantId: string): Promise<User[]>;
  /** All attestations for the principal's tenant (visibility filtering happens in the service). */
  attestations(p: Principal): Promise<Attestation[]>;
  /** Policy sections for the principal's tenant, optionally restricted to policy@version ids. */
  policySections(p: Principal, policyVersions?: { policyId: string; version: string }[]): Promise<PolicySection[]>;
  appendAudit(a: QueryAudit): Promise<void>;
  audits(p: Principal): Promise<QueryAudit[]>;
  lastAuditHash(tenantId: string): Promise<string>;
}
