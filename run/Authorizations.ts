import { ClientRoles, UserRoles, AppDeps } from "../src";
export const authz: AppDeps["authz"] = {
  // Organizations
  "GET /organizations(/:id)": [
    [ClientRoles.SYSTEM, true, null, null],
    [ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null],
    [ClientRoles.INTERNAL, null, UserRoles.EMPLOYEE, null],
  ],
  "POST /organizations": [],
  "PATCH /organizations/:id": [
    [ClientRoles.SYSTEM, true, null, null],
    [ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null],
    [ClientRoles.INTERNAL, null, UserRoles.EMPLOYEE, null],
  ],

  // Clients
  "POST /organizations/:id/clients": [
    [ClientRoles.SYSTEM, true, null, null],
    [ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null],
    [ClientRoles.INTERNAL, null, UserRoles.EMPLOYEE, null],
  ],
  "PATCH /organizations/:id/clients/:id": [
    [ClientRoles.SYSTEM, true, null, null],
    [ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null],
    [ClientRoles.INTERNAL, null, UserRoles.EMPLOYEE, null],
  ],

  // ClientRoles
  "POST /organizations/:id/clients/:id/roles": [
    [ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null],
  ],
  "DELETE /organizations/:id/clients/:id/roles/:id": [
    [ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null],
  ],

  // Users
  "GET /users(/:id)": [
    [ClientRoles.SYSTEM, true, null, null],
    [ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null],
    [ClientRoles.INTERNAL, null, UserRoles.EMPLOYEE, null],
  ],
  "POST /users": [],

  // UserRoles
  "GET /users/:id/roles": [
    [ClientRoles.SYSTEM, true, null, null],
    [ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null],
    [ClientRoles.INTERNAL, null, UserRoles.EMPLOYEE, null],
  ],
  "POST /users/:id/roles": [
    [ClientRoles.SYSTEM, true, null, null],
    [ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null],
  ],
  "DELETE /users/:id/roles/:id": [
    [ClientRoles.SYSTEM, true, null, null],
    [ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null],
  ],
  "GET /users/:id/memberships": [
    [ClientRoles.SYSTEM, true, null, null],
    [ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null],
  ],

  // Emails
  "GET /users/:id/emails": [
    [ClientRoles.SYSTEM, true, null, null],
    [ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null],
    [ClientRoles.INTERNAL, null, UserRoles.EMPLOYEE, null],
  ],
  "POST /users/:id/emails": [[ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null]],
  "DELETE /users/:id/emails/:id": [[ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null]],
  "POST /users/:id/emails/:id/verify": [[ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null]],

  // Sessions
  "GET /sessions": [[ClientRoles.INTERNAL, true, UserRoles.SYSADMIN, null]],
  "GET /users/:id/sessions": [[ClientRoles.INTERNAL, true, UserRoles.SYSADMIN, null]],
};
