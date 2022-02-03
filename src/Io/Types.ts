import { SimpleLoggerInterface } from "@wymp/ts-simple-interfaces";
import { IdConstraint, Filter, NullFilter, both, strId } from "@wymp/sql";
import { Auth, Api, PartialSelect } from "@wymp/types";

/** Convenience definition */
export type SessionAndToken = Auth.Db.Session & { token: Auth.Db.SessionToken };

/** A basic cache interface */
export interface CacheInterface {
  get<T>(k: string, cb: () => Promise<T>, ttl?: number, log?: SimpleLoggerInterface): Promise<T>;
  get<T>(k: string, cb: () => T, ttl?: number, log?: SimpleLoggerInterface): T;
  clear(k: string | RegExp): void | unknown;
}

/**
 * A set of defaults for using in our `TypeMap` (see [`@wymp/sql`](https://github.com/wymp/ts-sql)
 * for more details).
 */
export const Defaults = {
  apis: {
    active: 1 as const,
    allowUnidentifiedReqs: 0 as const,
  },
  organizations: both(strId, {
    createdMs: () => Date.now(),
  }),
  "org-memberships": both(strId, {
    read: 1 as const,
    edit: 1 as const,
    manage: 0 as const,
    delete: 0 as const,
  }),
  clients: both(strId, {
    reqsPerSec: 10,
    createdMs: () => Date.now(),
    deletedMs: null,
  }),
  "client-access-restrictions": both(strId, {
    createdMs: () => Date.now(),
  }),
  users: both(strId, {
    "2fa": 0 as const,
    bannedMs: null,
    deletedMs: null,
    createdMs: () => Date.now(),
  }),
  "user-clients": {
    createdMs: () => Date.now(),
  },
  "user-roles": {},
  emails: {
    verifiedMs: null,
    createdMs: () => Date.now(),
  },
  "verification-codes": {
    createdMs: () => Date.now(),
    consumedMs: null,
    invalidatedMs: null,
  },
  sessions: both(strId, {
    createdMs: () => Date.now(),
    invalidatedMs: null,
  }),
  "session-tokens": {
    createdMs: () => Date.now(),
    consumedMs: null,
    invalidatedMs: null,
  },
  "client-roles": {},
};

/**
 * A Type Map defining the output types, selection constraints, collection filters, and default
 * values for all of the objects that our database handles. See [`@wymp/sql`](https://github.com/wymp/ts-sql)
 * for more details.
 */
export type TypeMap<ClientRoles extends string, UserRoles extends string> = {
  apis: {
    type: Auth.Db.Api;
    constraints: IdConstraint;
    filters: Filter<{ domain: string }>;
    defaults: typeof Defaults["apis"];
  };
  organizations: {
    type: Auth.Db.Organization;
    constraints: IdConstraint;
    filters: NullFilter;
    defaults: typeof Defaults["organizations"];
  };
  "org-memberships": {
    type: Auth.Db.OrgMembership;
    constraints: IdConstraint | { organizationId: string; userId: string };
    filters: Filter<{ userId: string }> | Filter<{ organizationId: string }>;
    defaults: typeof Defaults["org-memberships"];
  };
  clients: {
    type: Auth.Db.Client;
    constraints: IdConstraint;
    filters: Filter<{ organizationId: string; deleted?: boolean }>;
    defaults: typeof Defaults["clients"];
  };
  "client-access-restrictions": {
    type: Auth.Db.ClientAccessRestriction;
    constraints: IdConstraint;
    filters: Filter<{ clientId: string }>;
    defaults: typeof Defaults["client-access-restrictions"];
  };
  users: {
    type: Auth.Db.User;
    constraints: IdConstraint;
    filters: NullFilter;
    defaults: typeof Defaults["users"];
  };
  "user-clients": {
    type: Auth.Db.UserClient;
    constraints: { userId: string; clientId: string };
    filters: Filter<{ userId: string; clientId: string }>;
    defaults: typeof Defaults["user-clients"];
  };
  emails: {
    type: Auth.Db.Email;
    constraints: { id: string };
    filters: Filter<{ userId: string }>;
    defaults: typeof Defaults["emails"];
  };
  "verification-codes": {
    type: Auth.Db.VerificationCode;
    constraints: { codeSha256: Buffer };
    filters: NullFilter;
    defaults: typeof Defaults["verification-codes"];
  };
  sessions: {
    type: Auth.Db.Session;
    constraints: IdConstraint;
    filters: Filter<{
      userId?: string;
      createdMs?: { op: "lt" | "gt" | "eq" | "lte" | "gte" | "ne"; val: number };
    }>;
    defaults: typeof Defaults["sessions"];
  };
  "session-tokens": {
    type: Auth.Db.SessionToken;
    constraints: { tokenSha256: Buffer };
    filters: NullFilter;
    defaults: typeof Defaults["session-tokens"];
  };
  "user-roles": {
    type: Auth.Db.UserRole<UserRoles>;
    constraints: { userId: string; roleId: string };
    filters: Filter<{ userId: string }> | Filter<{ userIdIn: Array<string> }>;
    defaults: typeof Defaults["user-roles"];
  };
  "client-roles": {
    type: Auth.Db.ClientRole<ClientRoles>;
    constraints: { clientId: string; roleId: string };
    filters: Filter<{ clientId: string }> | Filter<{ clientIdIn: Array<string> }>;
    defaults: typeof Defaults["client-roles"];
  };
};

/**
 * A complete I/O interface for this service. This allows implementers to pass in a datalayer
 * implementation of their choice.
 *
 * This interface appears quite dense, but it is actually somewhat simple. It provides basic `get`,
 * `save`, `update` and `delete` methods for objects in this environment.
 */
export interface IoInterface<ClientRoles extends string, UserRoles extends string> {
  getApiConfig(domain: string, version: string, log: SimpleLoggerInterface): Promise<Auth.Db.Api>;

  getClientById(id: string, log: SimpleLoggerInterface, thrw: true): Promise<Auth.Db.Client>;
  getClientById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: false | undefined
  ): Promise<Auth.Db.Client | undefined>;
  getClients(
    filter: TypeMap<ClientRoles, UserRoles>["clients"]["filters"],
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Auth.Db.Client, any>>;
  saveClient(
    record: PartialSelect<Auth.Db.Client, keyof typeof Defaults["clients"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.Client>;
  updateClient(
    clientId: string,
    record: Partial<Auth.Db.Client>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.Client>;

  getClientAccessRestrictions(
    filter: undefined | TypeMap<ClientRoles, UserRoles>["client-access-restrictions"]["filters"],
    params: undefined | Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Auth.Db.ClientAccessRestriction, any>>;
  saveClientAccessRestriction(
    record: PartialSelect<
      Auth.Db.ClientAccessRestriction,
      keyof typeof Defaults["client-access-restrictions"]
    >,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.ClientAccessRestriction>;
  deleteClientAccessRestriction(
    restrictionId: string,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<void>;

  getClientRoles(
    filter: TypeMap<ClientRoles, UserRoles>["client-roles"]["filters"],
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Auth.Db.ClientRole<ClientRoles>, any>>;
  saveClientRole(
    record: PartialSelect<Auth.Db.ClientRole<ClientRoles>, keyof typeof Defaults["client-roles"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.ClientRole<ClientRoles>>;
  deleteClientRole(
    clientId: string,
    roleId: string,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<void>;

  getEmailsForUser(
    userId: string,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Auth.Db.Email, any>>;
  getEmailByAddress(addr: string, log: SimpleLoggerInterface, thrw: true): Promise<Auth.Db.Email>;
  getEmailByAddress(
    addr: string,
    log: SimpleLoggerInterface,
    thrw?: false
  ): Promise<Auth.Db.Email | undefined>;
  deleteEmail(addr: string, auth: Auth.ReqInfo, log: SimpleLoggerInterface): Promise<void>;
  saveEmail(
    record: PartialSelect<Auth.Db.Email, keyof typeof Defaults["emails"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.Email>;
  updateEmail(
    email: string,
    record: Partial<Auth.Db.Email>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.Email>;

  getOrganizationById(
    id: string,
    log: SimpleLoggerInterface,
    thrw: true
  ): Promise<Auth.Db.Organization>;
  getOrganizationById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: false | undefined
  ): Promise<Auth.Db.Organization | undefined>;
  getOrganizations(
    filter: undefined | TypeMap<ClientRoles, UserRoles>["organizations"]["filters"],
    params: undefined | Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Auth.Db.Organization, any>>;
  saveOrganization(
    record: PartialSelect<Auth.Db.Organization, keyof typeof Defaults["organizations"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.Organization>;
  updateOrganization(
    id: string,
    record: Partial<Auth.Db.Organization>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.Organization>;
  deleteOrganization(id: string, auth: Auth.ReqInfo, log: SimpleLoggerInterface): Promise<void>;

  getOrgMembershipById(
    id: { id: string } | { userId: string; organizationId: string },
    log: SimpleLoggerInterface,
    thrw: true
  ): Promise<Auth.Db.OrgMembership>;
  getOrgMembershipById(
    id: { id: string } | { userId: string; organizationId: string },
    log: SimpleLoggerInterface,
    thrw?: false
  ): Promise<Auth.Db.OrgMembership | undefined>;
  getOrgMemberships(
    filter: undefined | { type: "users"; id: string } | { type: "organizations"; id: string },
    params: undefined | Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Auth.Db.OrgMembership, any>>;
  saveOrgMembership(
    record: PartialSelect<Auth.Db.OrgMembership, keyof typeof Defaults["org-memberships"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.OrgMembership>;
  updateOrgMembership(
    id: string,
    record: Partial<Auth.Db.OrgMembership>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.OrgMembership>;
  deleteOrgMembership(id: string, auth: Auth.ReqInfo, log: SimpleLoggerInterface): Promise<void>;

  getSessionById(id: string, log: SimpleLoggerInterface, thrw: true): Promise<Auth.Db.Session>;
  getSessionById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: false | undefined
  ): Promise<Auth.Db.Session | undefined>;
  getSessionByToken(
    tokenStr: string | undefined | null,
    log: SimpleLoggerInterface
  ): Promise<SessionAndToken | undefined>;
  getSessions(
    filter: undefined | TypeMap<ClientRoles, UserRoles>["sessions"]["filters"],
    params: undefined | Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Auth.Db.Session, any>>;
  saveSession(
    record: PartialSelect<Auth.Db.Session, keyof typeof Defaults["sessions"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.Session>;
  updateSession(
    id: string,
    record: Partial<Auth.Db.Session>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.Session>;

  getSessionTokenBySha256(
    tokenSha256: Buffer,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.SessionToken | undefined>;
  saveSessionToken(
    record: PartialSelect<Auth.Db.SessionToken, keyof typeof Defaults["session-tokens"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.SessionToken>;
  updateSessionToken(
    tokenSha256: Buffer,
    record: Partial<Auth.Db.SessionToken>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.SessionToken>;

  getUserById(id: string, log: SimpleLoggerInterface, thrw: true): Promise<Auth.Db.User>;
  getUserById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: false | undefined
  ): Promise<Auth.Db.User | undefined>;
  getUsers(
    filter: undefined | TypeMap<ClientRoles, UserRoles>["users"]["filters"],
    params: Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Auth.Db.User, any>>;
  updateUser(
    id: string,
    record: Partial<Auth.Db.User>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.User>;
  saveUser(
    record: PartialSelect<Auth.Db.User, keyof typeof Defaults["users"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.User>;

  saveUserClient(
    record: PartialSelect<Auth.Db.UserClient, keyof typeof Defaults["user-clients"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.UserClient>;

  getUserRoles(
    filter: undefined | TypeMap<ClientRoles, UserRoles>["user-roles"]["filters"],
    params: undefined | Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Auth.Db.UserRole<UserRoles>, any>>;
  saveUserRole(
    record: PartialSelect<Auth.Db.UserRole<UserRoles>, keyof typeof Defaults["user-roles"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.UserRole<UserRoles>>;
  deleteUserRole(
    userId: string,
    roleId: string,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<void>;

  getVerificationCodeBySha256(
    codeSha256: Buffer,
    log: SimpleLoggerInterface,
    thrw: true
  ): Promise<Auth.Db.VerificationCode>;
  getVerificationCodeBySha256(
    codeSha256: Buffer,
    log: SimpleLoggerInterface,
    thrw?: false | undefined
  ): Promise<Auth.Db.VerificationCode | undefined>;
  saveVerificationCode(
    record: PartialSelect<Auth.Db.VerificationCode, keyof typeof Defaults["verification-codes"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.VerificationCode>;
  updateVerificationCode(
    codeSha256: Buffer,
    record: Partial<Auth.Db.VerificationCode>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.VerificationCode>;
}
