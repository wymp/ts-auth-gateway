import { SimpleLoggerInterface } from "@wymp/ts-simple-interfaces";
import { IdConstraint, Filter, NullFilter, both, strId } from "@wymp/sql";
import { Auth, Api, PartialSelect } from "@wymp/types";
import { Db } from "../Types";

/** Convenience definition */
export type SessionAndToken = Db.Session & { token: Db.SessionToken };

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
    type: Db.Api;
    constraints: IdConstraint;
    filters: Filter<{ domain: string }>;
    defaults: typeof Defaults["apis"];
  };
  organizations: {
    type: Db.Organization;
    constraints: IdConstraint;
    filters: NullFilter;
    defaults: typeof Defaults["organizations"];
  };
  "org-memberships": {
    type: Db.OrgMembership;
    constraints: IdConstraint | { organizationId: string; userId: string };
    filters: Filter<{ userId: string }> | Filter<{ organizationId: string }>;
    defaults: typeof Defaults["org-memberships"];
  };
  clients: {
    type: Db.Client;
    constraints: IdConstraint;
    filters: Filter<{ organizationId: string; deleted?: boolean }>;
    defaults: typeof Defaults["clients"];
  };
  "client-access-restrictions": {
    type: Db.ClientAccessRestriction;
    constraints: IdConstraint;
    filters: Filter<{ clientId: string }>;
    defaults: typeof Defaults["client-access-restrictions"];
  };
  users: {
    type: Db.User;
    constraints: IdConstraint;
    filters: NullFilter;
    defaults: typeof Defaults["users"];
  };
  "user-clients": {
    type: Db.UserClient;
    constraints: { userId: string; clientId: string };
    filters: Filter<{ userId: string; clientId: string }>;
    defaults: typeof Defaults["user-clients"];
  };
  emails: {
    type: Db.Email;
    constraints: { id: string };
    filters: Filter<{ userId: string }>;
    defaults: typeof Defaults["emails"];
  };
  "verification-codes": {
    type: Db.VerificationCode;
    constraints: { codeSha256: Buffer };
    filters: NullFilter;
    defaults: typeof Defaults["verification-codes"];
  };
  sessions: {
    type: Db.Session;
    constraints: IdConstraint;
    filters: Filter<{
      userId?: string;
      createdMs?: { op: "lt" | "gt" | "eq" | "lte" | "gte" | "ne"; val: number };
    }>;
    defaults: typeof Defaults["sessions"];
  };
  "session-tokens": {
    type: Db.SessionToken;
    constraints: { tokenSha256: Buffer };
    filters: NullFilter;
    defaults: typeof Defaults["session-tokens"];
  };
  "user-roles": {
    type: Db.UserRole<UserRoles>;
    constraints: { userId: string; roleId: string };
    filters: Filter<{ userId: string }> | Filter<{ userIdIn: Array<string> }>;
    defaults: typeof Defaults["user-roles"];
  };
  "client-roles": {
    type: Db.ClientRole<ClientRoles>;
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
  getApiConfig(domain: string, version: string, log: SimpleLoggerInterface): Promise<Db.Api>;

  getClientById(id: string, log: SimpleLoggerInterface, thrw: true): Promise<Db.Client>;
  getClientById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: false | undefined
  ): Promise<Db.Client | undefined>;
  getClients(
    filter: TypeMap<ClientRoles, UserRoles>["clients"]["filters"],
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.Client, any>>;
  saveClient(
    record: PartialSelect<Db.Client, keyof typeof Defaults["clients"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.Client>;
  updateClient(
    clientId: string,
    record: Partial<Db.Client>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.Client>;

  getClientAccessRestrictionById(
    id: string,
    log: SimpleLoggerInterface,
    thrw: true
  ): Promise<Db.ClientAccessRestriction>;
  getClientAccessRestrictionById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: false
  ): Promise<Db.ClientAccessRestriction | undefined>;
  getClientAccessRestrictions(
    filter: undefined | TypeMap<ClientRoles, UserRoles>["client-access-restrictions"]["filters"],
    params: undefined | Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.ClientAccessRestriction, any>>;
  saveClientAccessRestriction(
    record: PartialSelect<
      Db.ClientAccessRestriction,
      keyof typeof Defaults["client-access-restrictions"]
    >,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.ClientAccessRestriction>;
  deleteClientAccessRestriction(
    restrictionId: string,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<void>;

  getClientRoles(
    filter: TypeMap<ClientRoles, UserRoles>["client-roles"]["filters"],
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.ClientRole<ClientRoles>, any>>;
  saveClientRole(
    record: PartialSelect<Db.ClientRole<ClientRoles>, keyof typeof Defaults["client-roles"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.ClientRole<ClientRoles>>;
  deleteClientRole(
    clientId: string,
    roleId: string,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<void>;

  getEmailsForUser(
    userId: string,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.Email, any>>;
  getEmailByAddress(addr: string, log: SimpleLoggerInterface, thrw: true): Promise<Db.Email>;
  getEmailByAddress(
    addr: string,
    log: SimpleLoggerInterface,
    thrw?: false
  ): Promise<Db.Email | undefined>;
  deleteEmail(addr: string, auth: Auth.ReqInfo, log: SimpleLoggerInterface): Promise<void>;
  saveEmail(
    record: PartialSelect<Db.Email, keyof typeof Defaults["emails"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.Email>;
  updateEmail(
    email: string,
    record: Partial<Db.Email>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.Email>;

  getOrganizationById(id: string, log: SimpleLoggerInterface, thrw: true): Promise<Db.Organization>;
  getOrganizationById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: false | undefined
  ): Promise<Db.Organization | undefined>;
  getOrganizations(
    filter: undefined | TypeMap<ClientRoles, UserRoles>["organizations"]["filters"],
    params: undefined | Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.Organization, any>>;
  saveOrganization(
    record: PartialSelect<Db.Organization, keyof typeof Defaults["organizations"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.Organization>;
  updateOrganization(
    id: string,
    record: Partial<Db.Organization>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.Organization>;
  deleteOrganization(id: string, auth: Auth.ReqInfo, log: SimpleLoggerInterface): Promise<void>;

  getOrgMembershipById(
    id: { id: string } | { userId: string; organizationId: string },
    log: SimpleLoggerInterface,
    thrw: true
  ): Promise<Db.OrgMembership>;
  getOrgMembershipById(
    id: { id: string } | { userId: string; organizationId: string },
    log: SimpleLoggerInterface,
    thrw?: false
  ): Promise<Db.OrgMembership | undefined>;
  getOrgMemberships(
    filter: undefined | { type: "users"; id: string } | { type: "organizations"; id: string },
    params: undefined | Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.OrgMembership, any>>;
  saveOrgMembership(
    record: PartialSelect<Db.OrgMembership, keyof typeof Defaults["org-memberships"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.OrgMembership>;
  updateOrgMembership(
    id: string,
    record: Partial<Db.OrgMembership>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.OrgMembership>;
  deleteOrgMembership(id: string, auth: Auth.ReqInfo, log: SimpleLoggerInterface): Promise<void>;

  getSessionById(id: string, log: SimpleLoggerInterface, thrw: true): Promise<Db.Session>;
  getSessionById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: false | undefined
  ): Promise<Db.Session | undefined>;
  getSessionByToken(
    tokenStr: string | undefined | null,
    log: SimpleLoggerInterface
  ): Promise<SessionAndToken | undefined>;
  getSessions(
    filter: undefined | TypeMap<ClientRoles, UserRoles>["sessions"]["filters"],
    params: undefined | Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.Session, any>>;
  saveSession(
    record: PartialSelect<Db.Session, keyof typeof Defaults["sessions"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.Session>;
  updateSession(
    id: string,
    record: Partial<Db.Session>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.Session>;

  getSessionTokenBySha256(
    tokenSha256: Buffer,
    log: SimpleLoggerInterface
  ): Promise<Db.SessionToken | undefined>;
  saveSessionToken(
    record: PartialSelect<Db.SessionToken, keyof typeof Defaults["session-tokens"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.SessionToken>;
  updateSessionToken(
    tokenSha256: Buffer,
    record: Partial<Db.SessionToken>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.SessionToken>;

  getUserById(id: string, log: SimpleLoggerInterface, thrw: true): Promise<Db.User>;
  getUserById(
    id: string,
    log: SimpleLoggerInterface,
    thrw?: false | undefined
  ): Promise<Db.User | undefined>;
  getUsers(
    filter: undefined | TypeMap<ClientRoles, UserRoles>["users"]["filters"],
    params: Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.User, any>>;
  updateUser(
    id: string,
    record: Partial<Db.User>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.User>;
  saveUser(
    record: PartialSelect<Db.User, keyof typeof Defaults["users"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.User>;

  saveUserClient(
    record: PartialSelect<Db.UserClient, keyof typeof Defaults["user-clients"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.UserClient>;

  getUserRoles(
    filter: undefined | TypeMap<ClientRoles, UserRoles>["user-roles"]["filters"],
    params: undefined | Api.Server.CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<Api.CollectionResponse<Db.UserRole<UserRoles>, any>>;
  saveUserRole(
    record: PartialSelect<Db.UserRole<UserRoles>, keyof typeof Defaults["user-roles"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.UserRole<UserRoles>>;
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
  ): Promise<Db.VerificationCode>;
  getVerificationCodeBySha256(
    codeSha256: Buffer,
    log: SimpleLoggerInterface,
    thrw?: false | undefined
  ): Promise<Db.VerificationCode | undefined>;
  saveVerificationCode(
    record: PartialSelect<Db.VerificationCode, keyof typeof Defaults["verification-codes"]>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.VerificationCode>;
  updateVerificationCode(
    codeSha256: Buffer,
    record: Partial<Db.VerificationCode>,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<Db.VerificationCode>;
}
