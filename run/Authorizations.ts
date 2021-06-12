import { ClientRoles, UserRoles, AppDeps } from "../src";
export const authz: AppDeps["authz"] = {
  "GET /organizations(/:id)": [
    [ClientRoles.SYSTEM, true, null, null],
    [ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null],
    [ClientRoles.INTERNAL, null, UserRoles.EMPLOYEE, null],
  ],
  "POST /organizations": [
    [ClientRoles.SYSTEM, true, null, null],
    [ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null],
    [ClientRoles.INTERNAL, null, UserRoles.EMPLOYEE, null],
  ],
  "PATCH /organizations/:id": [
    [ClientRoles.SYSTEM, true, null, null],
    [ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null],
    [ClientRoles.INTERNAL, null, UserRoles.EMPLOYEE, null],
  ],
  "POST /organizations/:id/clients": [
    [ClientRoles.SYSTEM, true, null, null],
    [ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null],
    [ClientRoles.INTERNAL, null, UserRoles.EMPLOYEE, null],
  ],
  "GET /clients/:id": [
    [ClientRoles.SYSTEM, true, null, null],
    [ClientRoles.INTERNAL, null, UserRoles.SYSADMIN, null],
    [ClientRoles.INTERNAL, null, UserRoles.EMPLOYEE, null],
  ],
};
