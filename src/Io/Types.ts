import { IdConstraint, Filter, NullFilter, both, strId } from "@wymp/sql";
import { Auth } from "@wymp/types";

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
