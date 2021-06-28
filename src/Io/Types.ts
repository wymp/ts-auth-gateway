import { IdConstraint, Filter, NullFilter, both, strId } from "@wymp/sql";
import { Auth } from "@wymp/types";

export const Defaults = {
  apis: {
    active: 1 as const,
    allowUnidentifiedReqs: 0 as const,
  },
  organizations: both(strId, {
    createdMs: () => Date.now(),
  }),
  clients: both(strId, {
    reqsPerSec: 10,
    createdMs: () => Date.now(),
  }),
  "client-access-restrictions": both(strId, {
    createdMs: () => Date.now(),
  }),
  users: both(strId, {
    banned: 0 as const,
    deleted: 0 as const,
    "2fa": 0 as const,
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
    invalidatedMs: null,
  },
  "client-roles": {},
};

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
  clients: {
    type: Auth.Db.Client;
    constraints: IdConstraint;
    filters: NullFilter;
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
    constraints: { email: string };
    filters: NullFilter;
    defaults: typeof Defaults["emails"];
  };
  "verification-codes": {
    type: Auth.Db.VerificationCode;
    constraints: IdConstraint;
    filters: NullFilter;
    defaults: typeof Defaults["verification-codes"];
  };
  sessions: {
    type: Auth.Db.Session;
    constraints: IdConstraint;
    filters: NullFilter;
    defaults: typeof Defaults["sessions"];
  };
  "session-tokens": {
    type: Auth.Db.SessionToken;
    constraints: IdConstraint;
    filters: NullFilter;
    defaults: typeof Defaults["session-tokens"];
  };
  "user-roles": {
    type: Auth.Db.UserRole<UserRoles>;
    constraints: IdConstraint;
    filters: { _t: "filter"; userId: string };
    defaults: typeof Defaults["user-roles"];
  };
  "client-roles": {
    type: Auth.Db.ClientRole<ClientRoles>;
    constraints: { clientId: string; roleId: string };
    filters: { _t: "filter"; clientId: string };
    defaults: typeof Defaults["client-roles"];
  };
};
