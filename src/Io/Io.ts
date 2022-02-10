import { SimpleLoggerInterface, SimpleSqlDbInterface } from "@wymp/ts-simple-interfaces";
import { Audit, Auth, Api, PartialSelect } from "@wymp/types";
import { Db } from "../Types";
import { Sql } from "./Sql";
import { CacheInterface, IoInterface, SessionAndToken, TypeMap, Defaults } from "./Types";

export class Io<ClientRoles extends string, UserRoles extends string>
  implements IoInterface<ClientRoles, UserRoles>
{
  protected sql: Sql<ClientRoles, UserRoles>;

  public constructor(
    db: SimpleSqlDbInterface,
    cache: CacheInterface,
    pubsub: { publish(msg: unknown): Promise<unknown> } | null = null,
    audit: Audit.ClientInterface | null = null
  ) {
    this.sql = new Sql<ClientRoles, UserRoles>(db, cache, pubsub, audit);
  }

  /**
   *
   *
   *
   *
   * Apis
   *
   *
   *
   *
   */

  public getApiConfig(
    domain: string,
    version: string,
    log: SimpleLoggerInterface
  ): Promise<Db.Api> {
    return this.sql.getApiConfig(domain, version, log);
  }

  /**
   *
   *
   *
   *
   * Clients
   *
   *
   *
   *
   */

  public getClientById(id: string, log: SimpleLoggerInterface, thrw: true): Promise<Db.Client>;
  public getClientById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: false | undefined
  ): Promise<Db.Client | undefined>;
  public getClientById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: boolean
  ): Promise<Db.Client | undefined> {
    return thrw
      ? this.sql.get("clients", { id }, log, thrw)
      : this.sql.get("clients", { id }, log, thrw);
  }

  public getClients(
    filter: TypeMap<ClientRoles, UserRoles>["clients"]["filters"],
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.Client, any>> {
    return this.sql.get("clients", filter, log);
  }

  public saveClient(
    record: PartialSelect<Db.Client, keyof typeof Defaults["clients"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.Client> {
    return this.sql.save("clients", record, auth, log);
  }

  public updateClient(
    clientId: string,
    record: Partial<Db.Client>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.Client> {
    return this.sql.update("clients", clientId, record, auth, log);
  }

  /**
   *
   *
   *
   *
   * Client Roles
   *
   *
   *
   *
   */

  public getClientRoles(
    filter: TypeMap<ClientRoles, UserRoles>["client-roles"]["filters"],
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.ClientRole<ClientRoles>, any>> {
    return this.sql.get("client-roles", filter, log);
  }

  public saveClientRole(
    record: PartialSelect<Db.ClientRole<ClientRoles>, keyof typeof Defaults["client-roles"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.ClientRole<ClientRoles>> {
    return this.sql.save("client-roles", record, auth, log);
  }

  public deleteClientRole(
    clientId: string,
    roleId: string,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<void> {
    return this.sql.deleteClientRole(clientId, roleId, auth, log);
  }

  /**
   *
   *
   *
   *
   * Client Access Restrictions
   *
   *
   *
   *
   */

  public getClientAccessRestrictionById(
    id: string,
    log: SimpleLoggerInterface,
    thrw: true
  ): Promise<Db.ClientAccessRestriction>;
  public getClientAccessRestrictionById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: false
  ): Promise<Db.ClientAccessRestriction | undefined>;
  public getClientAccessRestrictionById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: boolean
  ): Promise<Db.ClientAccessRestriction | undefined> {
    return thrw
      ? this.sql.get("client-access-restrictions", { id }, log, thrw)
      : this.sql.get("client-access-restrictions", { id }, log, thrw);
  }

  public getClientAccessRestrictions(
    filter: undefined | TypeMap<ClientRoles, UserRoles>["client-access-restrictions"]["filters"],
    params: undefined | Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.ClientAccessRestriction, any>> {
    return !filter
      ? this.sql.get("client-access-restrictions", params, log)
      : this.sql.get("client-access-restrictions", filter, params, log);
  }

  public saveClientAccessRestriction(
    record: PartialSelect<
      Db.ClientAccessRestriction,
      keyof typeof Defaults["client-access-restrictions"]
    >,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.ClientAccessRestriction> {
    return this.sql.save("client-access-restrictions", record, auth, log);
  }

  public deleteClientAccessRestriction(
    restrictionId: string,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<void> {
    return this.sql.delete("client-access-restrictions", restrictionId, auth, log);
  }

  /**
   *
   *
   *
   *
   * Email Addresses
   *
   *
   *
   *
   */

  public getEmailsForUser(
    userId: string,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.Email, any>> {
    return this.sql.get("emails", { _t: "filter", userId }, log);
  }

  public getEmailByAddress(addr: string, log: SimpleLoggerInterface, thrw: true): Promise<Db.Email>;
  public getEmailByAddress(
    addr: string,
    log: SimpleLoggerInterface,
    thrw?: false
  ): Promise<Db.Email | undefined>;
  public getEmailByAddress(
    addr: string,
    log: SimpleLoggerInterface,
    thrw?: boolean
  ): Promise<Db.Email | undefined> {
    return thrw
      ? this.sql.get("emails", { id: addr }, log, thrw)
      : this.sql.get("emails", { id: addr }, log, thrw);
  }

  public deleteEmail(addr: string, auth: Auth.ReqInfo, log: SimpleLoggerInterface): Promise<void> {
    return this.sql.delete("emails", addr, auth, log);
  }

  public saveEmail(
    record: PartialSelect<Db.Email, keyof typeof Defaults["emails"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.Email> {
    return this.sql.save("emails", record, auth, log);
  }

  public updateEmail(
    email: string,
    record: Partial<Db.Email>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.Email> {
    return this.sql.update("emails", email, record, auth, log);
  }

  /**
   *
   *
   *
   *
   * Organizations
   *
   *
   *
   *
   */
  public getOrganizationById(
    id: string,
    log: SimpleLoggerInterface,
    thrw: true
  ): Promise<Db.Organization>;
  public getOrganizationById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: false | undefined
  ): Promise<Db.Organization | undefined>;
  public getOrganizationById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: boolean
  ): Promise<Db.Organization | undefined> {
    return thrw
      ? this.sql.get("organizations", { id }, log, thrw)
      : this.sql.get("organizations", { id }, log, thrw);
  }

  public getOrganizations(
    filter: undefined | TypeMap<ClientRoles, UserRoles>["organizations"]["filters"],
    params: undefined | Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.Organization, any>> {
    return !filter
      ? this.sql.get("organizations", params, log)
      : this.sql.get("organizations", filter, params, log);
  }

  public saveOrganization(
    record: PartialSelect<Db.Organization, keyof typeof Defaults["organizations"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.Organization> {
    return this.sql.save("organizations", record, auth, log);
  }

  public updateOrganization(
    id: string,
    record: Partial<Db.Organization>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.Organization> {
    return this.sql.update("organizations", id, record, auth, log);
  }

  public deleteOrganization(
    id: string,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<void> {
    return this.sql.delete("organizations", id, auth, log);
  }

  /**
   *
   *
   *
   *
   * Org Memberships
   *
   *
   *
   *
   */

  public getOrgMembershipById(
    id: { id: string } | { userId: string; organizationId: string },
    log: SimpleLoggerInterface,
    thrw: true
  ): Promise<Db.OrgMembership>;
  public getOrgMembershipById(
    id: { id: string } | { userId: string; organizationId: string },
    log: SimpleLoggerInterface,
    thrw?: false
  ): Promise<Db.OrgMembership | undefined>;
  public getOrgMembershipById(
    id: { id: string } | { userId: string; organizationId: string },
    log: SimpleLoggerInterface,
    thrw?: boolean
  ): Promise<Db.OrgMembership | undefined> {
    return thrw
      ? this.sql.get("org-memberships", id, log, thrw)
      : this.sql.get("org-memberships", id, log, thrw);
  }

  public getOrgMemberships(
    filter: undefined | { type: "users"; id: string } | { type: "organizations"; id: string },
    params: undefined | Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.OrgMembership, any>> {
    return !filter
      ? this.sql.get("org-memberships", params, log)
      : filter.type === "users"
      ? this.sql.get("org-memberships", { _t: "filter", userId: filter.id }, params, log)
      : this.sql.get("org-memberships", { _t: "filter", organizationId: filter.id }, params, log);
  }

  public saveOrgMembership(
    record: PartialSelect<Db.OrgMembership, keyof typeof Defaults["org-memberships"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.OrgMembership> {
    return this.sql.save("org-memberships", record, auth, log);
  }

  public updateOrgMembership(
    id: string,
    record: Partial<Db.OrgMembership>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.OrgMembership> {
    return this.sql.update("org-memberships", id, record, auth, log);
  }

  public deleteOrgMembership(
    id: string,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<void> {
    return this.sql.delete("org-memberships", id, auth, log);
  }

  /**
   *
   *
   *
   *
   * Sessions
   *
   *
   *
   *
   */

  public getSessionById(id: string, log: SimpleLoggerInterface, thrw: true): Promise<Db.Session>;
  public getSessionById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: false | undefined
  ): Promise<Db.Session | undefined>;
  public getSessionById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: boolean
  ): Promise<Db.Session | undefined> {
    return thrw
      ? this.sql.get("sessions", { id }, log, thrw)
      : this.sql.get("sessions", { id }, log, thrw);
  }

  public getSessionByToken(
    tokenStr: string | undefined | null,
    log: SimpleLoggerInterface
  ): Promise<SessionAndToken | undefined> {
    return this.sql.getSessionByToken(tokenStr, log);
  }

  public getSessions(
    filter: undefined | TypeMap<ClientRoles, UserRoles>["sessions"]["filters"],
    params: undefined | Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.Session, any>> {
    return !filter
      ? this.sql.get("sessions", params, log)
      : this.sql.get("sessions", filter, params, log);
  }

  public saveSession(
    record: PartialSelect<Db.Session, keyof typeof Defaults["sessions"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.Session> {
    return this.sql.save("sessions", record, auth, log);
  }

  public updateSession(
    id: string,
    record: Partial<Db.Session>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.Session> {
    return this.sql.update("sessions", id, record, auth, log);
  }

  /**
   *
   *
   *
   *
   * Session Tokens
   *
   *
   *
   *
   */

  public getSessionTokenBySha256(
    tokenSha256: Buffer,
    log: SimpleLoggerInterface
  ): Promise<Db.SessionToken | undefined> {
    return this.sql.get("session-tokens", { tokenSha256 }, log);
  }

  public saveSessionToken(
    record: PartialSelect<Db.SessionToken, keyof typeof Defaults["session-tokens"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.SessionToken> {
    return this.sql.save("session-tokens", record, auth, log);
  }

  public updateSessionToken(
    tokenSha256: Buffer,
    record: Partial<Db.SessionToken>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.SessionToken> {
    return this.sql.update("session-tokens", tokenSha256, record, auth, log);
  }

  /**
   *
   *
   *
   *
   * Users
   *
   *
   *
   *
   */

  public getUserById(id: string, log: SimpleLoggerInterface, thrw: true): Promise<Db.User>;
  public getUserById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: false | undefined
  ): Promise<Db.User | undefined>;
  public getUserById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: boolean
  ): Promise<Db.User | undefined> {
    return thrw
      ? this.sql.get("users", { id }, log, thrw)
      : this.sql.get("users", { id }, log, thrw);
  }

  public getUsers(
    filter: undefined | TypeMap<ClientRoles, UserRoles>["users"]["filters"],
    params: Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.User, any>> {
    return !filter
      ? this.sql.get("users", params, log)
      : this.sql.get("users", filter, params, log);
  }

  public saveUser(
    record: PartialSelect<Db.User, keyof typeof Defaults["users"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.User> {
    return this.sql.save("users", record, auth, log);
  }

  public updateUser(
    id: string,
    record: Partial<Db.User>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.User> {
    return this.sql.update("users", id, record, auth, log);
  }

  /**
   *
   *
   *
   *
   * User Clients
   *
   *
   *
   *
   */

  public saveUserClient(
    record: PartialSelect<Db.UserClient, keyof typeof Defaults["user-clients"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.UserClient> {
    return this.sql.save("user-clients", record, auth, log);
  }

  /**
   *
   *
   *
   *
   * User Roles
   *
   *
   *
   *
   */

  public getUserRoles(
    filter: undefined | TypeMap<ClientRoles, UserRoles>["user-roles"]["filters"],
    params: undefined | Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.UserRole<UserRoles>, any>> {
    return !filter
      ? this.sql.get("user-roles", params, log)
      : this.sql.get("user-roles", filter, params, log);
  }

  public saveUserRole(
    record: PartialSelect<Db.UserRole<UserRoles>, keyof typeof Defaults["user-roles"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.UserRole<UserRoles>> {
    return this.sql.save("user-roles", record, auth, log);
  }

  public deleteUserRole(
    userId: string,
    roleId: string,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<void> {
    return this.sql.deleteUserRole(userId, roleId, auth, log);
  }

  /**
   *
   *
   *
   *
   * Verification Codes
   *
   *
   *
   *
   */

  public getVerificationCodeBySha256(
    codeSha256: Buffer,
    log: SimpleLoggerInterface,
    thrw: true
  ): Promise<Db.VerificationCode>;
  public getVerificationCodeBySha256(
    codeSha256: Buffer,
    log: SimpleLoggerInterface,
    thrw?: false | undefined
  ): Promise<Db.VerificationCode | undefined>;
  public getVerificationCodeBySha256(
    codeSha256: Buffer,
    log: SimpleLoggerInterface,
    thrw?: boolean
  ): Promise<Db.VerificationCode | undefined> {
    return thrw
      ? this.sql.get("verification-codes", { codeSha256 }, log, thrw)
      : this.sql.get("verification-codes", { codeSha256 }, log, thrw);
  }

  public saveVerificationCode(
    record: PartialSelect<Db.VerificationCode, keyof typeof Defaults["verification-codes"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.VerificationCode> {
    return this.sql.save("verification-codes", record, auth, log);
  }

  public updateVerificationCode(
    codeSha256: Buffer,
    record: Partial<Db.VerificationCode>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.VerificationCode> {
    return this.sql.update("verification-codes", codeSha256, record, auth, log);
  }
}
