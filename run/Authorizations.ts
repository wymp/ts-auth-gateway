import { Types as T } from "../src";
export const authz: T.AppDeps["authz"] = {
  // Organizations
  "GET /organizations(/:id)": [
    [T.ClientRoles.SYSTEM, true, null, null],
    [T.ClientRoles.INTERNAL, null, T.UserRoles.SYSADMIN, null],
    [T.ClientRoles.INTERNAL, null, T.UserRoles.EMPLOYEE, null],
  ],
  "POST /organizations": [],
  "PATCH /organizations/:id": [
    [T.ClientRoles.SYSTEM, true, null, null],
    [T.ClientRoles.INTERNAL, null, T.UserRoles.SYSADMIN, null],
    [T.ClientRoles.INTERNAL, null, T.UserRoles.EMPLOYEE, null],
  ],

  // Clients
  "POST /organizations/:id/clients": [
    [T.ClientRoles.SYSTEM, true, null, null],
    [T.ClientRoles.INTERNAL, null, T.UserRoles.SYSADMIN, null],
    [T.ClientRoles.INTERNAL, null, T.UserRoles.EMPLOYEE, null],
  ],
  "PATCH /organizations/:id/clients/:id": [
    [T.ClientRoles.SYSTEM, true, null, null],
    [T.ClientRoles.INTERNAL, null, T.UserRoles.SYSADMIN, null],
    [T.ClientRoles.INTERNAL, null, T.UserRoles.EMPLOYEE, null],
  ],

  // T.ClientRoles
  "POST /organizations/:id/clients/:id/roles": [
    [T.ClientRoles.INTERNAL, null, T.UserRoles.SYSADMIN, null],
  ],
  "DELETE /organizations/:id/clients/:id/roles/:id": [
    [T.ClientRoles.INTERNAL, null, T.UserRoles.SYSADMIN, null],
  ],

  // Users
  "GET /users(/:id)": [
    [T.ClientRoles.SYSTEM, true, null, null],
    [T.ClientRoles.INTERNAL, null, T.UserRoles.SYSADMIN, null],
    [T.ClientRoles.INTERNAL, null, T.UserRoles.EMPLOYEE, null],
  ],
  "POST /users": [],

  // T.UserRoles
  "GET /users/:id/roles": [
    [T.ClientRoles.SYSTEM, true, null, null],
    [T.ClientRoles.INTERNAL, null, T.UserRoles.SYSADMIN, null],
    [T.ClientRoles.INTERNAL, null, T.UserRoles.EMPLOYEE, null],
  ],
  "POST /users/:id/roles": [
    [T.ClientRoles.SYSTEM, true, null, null],
    [T.ClientRoles.INTERNAL, null, T.UserRoles.SYSADMIN, null],
  ],
  "DELETE /users/:id/roles/:id": [
    [T.ClientRoles.SYSTEM, true, null, null],
    [T.ClientRoles.INTERNAL, null, T.UserRoles.SYSADMIN, null],
  ],
  "GET /users/:id/memberships": [
    [T.ClientRoles.SYSTEM, true, null, null],
    [T.ClientRoles.INTERNAL, null, T.UserRoles.SYSADMIN, null],
  ],

  // Emails
  "GET /users/:id/emails": [
    [T.ClientRoles.SYSTEM, true, null, null],
    [T.ClientRoles.INTERNAL, null, T.UserRoles.SYSADMIN, null],
    [T.ClientRoles.INTERNAL, null, T.UserRoles.EMPLOYEE, null],
  ],
  "POST /users/:id/emails": [[T.ClientRoles.INTERNAL, null, T.UserRoles.SYSADMIN, null]],
  "DELETE /users/:id/emails/:id": [[T.ClientRoles.INTERNAL, null, T.UserRoles.SYSADMIN, null]],
  "POST /users/:id/emails/:id/verify": [[T.ClientRoles.INTERNAL, null, T.UserRoles.SYSADMIN, null]],

  // Sessions
  "GET /sessions": [[T.ClientRoles.INTERNAL, true, T.UserRoles.SYSADMIN, null]],
  "GET /users/:id/sessions": [[T.ClientRoles.INTERNAL, true, T.UserRoles.SYSADMIN, null]],
};
