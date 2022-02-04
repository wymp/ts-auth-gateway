import * as E from "@wymp/http-errors";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Parsers } from "@wymp/weenie-framework";
import { AppDeps } from "../../Types";
import { IoInterface } from "./Types";
import * as Clients from "./Clients";
import * as ClientRoles from "./ClientRoles";
import * as ClientAccessRestrictions from "./ClientAccessRestrictions";
import * as Emails from "./Emails";
import * as Organizations from "./Organizations";
import * as OrgMemberships from "./OrgMemberships";
import * as Sessions from "./Sessions";
import * as Users from "./Users";
import * as UserRoles from "./UserRoles";

const json = Parsers.json();
const getParseBodyFunc = (allowBlankBodies: boolean): SimpleHttpServerMiddleware => {
  return (req, res, next) => {
    // Validate that we've passed a content type and that it's correct
    const contentType = req.get("content-type");
    if (!contentType || contentType.toLowerCase() !== "application/json") {
      return next(
        new E.UnsupportedMediaType(
          `Your request must have a 'Content-Type' header with value 'application/json'.${
            contentType
              ? ` You passed '${contentType}'.`
              : `You did not pass a content-type header.`
          }`
        )
      );
    }

    // Use the parser to parse the body
    json(req, res, (e?: any) => {
      // If there was an error, return it
      if (e) {
        return next(e);
      } else {
        // Otherwise, if there's supposed to be a body, check that we see one
        if (!allowBlankBodies && (!req.body || Object.keys(req.body).length === 0)) {
          return next(
            new E.BadRequest(
              "The body of your request is blank or does not appear to have been parsed correctly. " +
                "Please be sure to pass a content-type header with the value 'application/json'. " +
                (contentType
                  ? `You passed 'Content-Type: ${contentType}'.`
                  : `You did not pass a content-type header.`)
            )
          );
        }
      }
      next();
    });
  };
};
const parseBody = getParseBodyFunc(false);
const parseBodyAllowBlank = getParseBodyFunc(true);

export const register = (
  r: Pick<AppDeps, "http" | "log" | "io" | "authz" | "config" | "emailer"> & { io: IoInterface }
) => {
  r.log.notice(`Registering Accounts Module`);

  // Organizations
  r.log.notice(`HTTP: GET    /accounts/v1/organizations(/:id)`);
  r.http.get(
    ["/accounts/v1/organizations", "/accounts/v1/organizations/:id"],
    Organizations.getOrganizations(r)
  );
  r.log.notice(`HTTP: POST   /accounts/v1/organizations`);
  r.http.post("/accounts/v1/organizations", [parseBody, Organizations.postOrganizations(r)]);
  r.log.notice(`HTTP: PATCH  /accounts/v1/organizations/:id`);
  r.http.patch("/accounts/v1/organizations/:id", [parseBody, Organizations.patchOrganization(r)]);
  r.log.notice(`HTTP: DELETE /accounts/v1/organizations/:id`);
  r.http.delete("/accounts/v1/organizations/:id", Organizations.deleteOrganizationHandler(r));

  // Clients
  r.log.notice(`HTTP: GET    /accounts/v1/organizations/:id/clients(/:id)`);
  r.http.get(
    ["/accounts/v1/organizations/:orgId/clients", "/accounts/v1/organizations/:orgId/clients/:id"],
    Clients.getClientsForOrgHandler(r)
  );
  r.log.notice(`HTTP: POST   /accounts/v1/organizations/:id/clients`);
  r.http.post("/accounts/v1/organizations/:orgId/clients", [
    parseBody,
    Clients.postClientHandler(r),
  ]);
  r.log.notice(`HTTP: PATCH  /accounts/v1/organizations/:id/clients/:id`);
  r.http.patch("/accounts/v1/organizations/:orgId/clients/:id", [
    parseBody,
    Clients.patchClientHandler(r),
  ]);
  r.log.notice(`HTTP: DELETE /accounts/v1/organizations/:id/clients/:id`);
  r.http.delete("/accounts/v1/organizations/:orgId/clients/:id", Clients.deleteClientHandler(r));
  r.log.notice(`HTTP: POST   /accounts/v1/organizations/:id/clients/:id/refresh-secret`);
  r.http.post(
    "/accounts/v1/organizations/:orgId/clients/:id/refresh-secret",
    Clients.refreshSecretHandler(r)
  );

  // Client Roles
  r.log.notice(`HTTP: GET    /accounts/v1/organizations/:orgId/clients/:id/roles`);
  r.http.get(
    `/accounts/v1/organizations/:orgId/clients/:id/roles`,
    ClientRoles.getClientRolesHandler(r)
  );
  r.log.notice(`HTTP: POST   /accounts/v1/organizations/:orgId/clients/:id/roles`);
  r.http.post(`/accounts/v1/organizations/:orgId/clients/:id/roles`, [
    parseBody,
    ClientRoles.postClientRolesHandler(r),
  ]);
  r.log.notice(`HTTP: DELETE /accounts/v1/organizations/:orgId/clients/:id/roles/:roleId`);
  r.http.delete(
    `/accounts/v1/organizations/:orgId/clients/:id/roles/:roleId`,
    ClientRoles.deleteClientRolesHandler(r)
  );

  // Client Access Restrictions
  r.log.notice(`HTTP: GET    /accounts/v1/organizations/:orgId/clients/:id/access-restrictions`);
  r.http.get(
    `/accounts/v1/organizations/:orgId/clients/:id/access-restrictions`,
    ClientAccessRestrictions.getClientAccessRestrictionsHandler(r)
  );
  r.log.notice(`HTTP: POST   /accounts/v1/organizations/:orgId/clients/:id/access-restrictions`);
  r.http.post(`/accounts/v1/organizations/:orgId/clients/:id/access-restrictions`, [
    parseBody,
    ClientAccessRestrictions.postClientAccessRestrictionsHandler(r),
  ]);
  r.log.notice(
    `HTTP: DELETE /accounts/v1/organizations/:orgId/clients/:id/access-restrictions/:accessRestrictionId`
  );
  r.http.delete(
    `/accounts/v1/organizations/:orgId/clients/:id/access-restrictions/:accessRestrictionId`,
    ClientAccessRestrictions.deleteClientAccessRestrictionsHandler(r)
  );

  // Users
  r.log.notice(`HTTP: GET    /accounts/v1/users`);
  r.http.get(`/accounts/v1/users`, Users.getUsers(r));
  r.log.notice(`HTTP: GET    /accounts/v1/users/:id`);
  r.http.get(`/accounts/v1/users/:id`, Users.getUserById(r));
  r.log.notice(`HTTP: POST   /accounts/v1/users`);
  r.http.post(`/accounts/v1/users`, [parseBody, Users.postUsers(r)]);
  r.log.notice(`HTTP: PATCH  /accounts/v1/users/:id`);
  r.http.patch(`/accounts/v1/users/:id`, [parseBody, Users.patchUsers(r)]);
  r.log.notice(`HTTP: POST   /accounts/v1/users/:id/change-password`);
  r.http.post(`/accounts/v1/users/:id/change-password`, [
    parseBody,
    Users.postChangePasswordHandler(r),
  ]);
  r.log.notice(`HTTP: DELETE /accounts/v1/users/:id`);
  r.http.delete(`/accounts/v1/users/:id`, Users.deleteUsers(r));

  // User Roles
  r.log.notice(`HTTP: GET    /accounts/v1/users/:id/roles`);
  r.http.get(`/accounts/v1/users/:id/roles`, UserRoles.getUserRoles(r));
  r.log.notice(`HTTP: POST   /accounts/v1/users/:id/roles`);
  r.http.post(`/accounts/v1/users/:id/roles`, [parseBody, UserRoles.postUserRoles(r)]);
  r.log.notice(`HTTP: DELETE /accounts/v1/users/:id/roles/:roleId`);
  r.http.delete(`/accounts/v1/users/:id/roles/:roleId`, UserRoles.deleteUserRoles(r));

  // Emails
  r.log.notice(`HTTP: GET    /accounts/v1/users/:id/emails`);
  r.http.get(`/accounts/v1/users/:id/emails`, Emails.getUserEmailsHandler(r));
  r.log.notice(`HTTP: POST   /accounts/v1/users/:id/emails`);
  r.http.post(`/accounts/v1/users/:id/emails`, [parseBody, Emails.postUserEmailHandler(r)]);
  r.log.notice(`HTTP: DELETE /accounts/v1/users/:id/emails/:id`);
  r.http.post(`/accounts/v1/users/:id/emails/:emailId`, Emails.deleteUserEmailHandler(r));
  r.log.notice(`HTTP: POST   /accounts/v1/users/:id/emails/:emailId/send-verification`);
  r.http.post(
    `/accounts/v1/users/:id/emails/:emailId/send-verification`,
    Emails.sendEmailVerificationHandler(r)
  );
  r.log.notice(`HTTP: POST   /accounts/v1/users/:id/emails/:emailId/verify`);
  r.http.post(`/accounts/v1/users/:id/emails/:emailId/verify`, [
    parseBody,
    Emails.verifyUserEmailHandler(r),
  ]);

  // OrgMemberships
  r.log.notice(`HTTP: GET    /accounts/v1/users/:id/memberships`);
  r.http.get(`/accounts/v1/users/:id/memberships`, OrgMemberships.getByUserIdHandler(r));
  r.log.notice(`HTTP: GET    /accounts/v1/organizations/:id/memberships`);
  r.http.get(
    `/accounts/v1/organizations/:id/memberships`,
    OrgMemberships.getByOrganizationIdHandler(r)
  );
  r.log.notice(`HTTP: POST   /accounts/v1/users/:id/memberships`);
  r.http.post(`/accounts/v1/organizations/:id/memberships`, [
    parseBody,
    OrgMemberships.postOrgMembershipHandler(r),
  ]);
  r.log.notice(`HTTP: PATCH  /accounts/v1/org-memberships/:id`);
  r.http.patch(`/accounts/v1/org-memberships/:id`, OrgMemberships.patchOrgMembershipHandler(r));
  r.log.notice(`HTTP: DELETE /accounts/v1/org-memberships/:id`);
  r.http.delete(`/accounts/v1/org-memberships/:id`, OrgMemberships.deleteOrgMembershipHandler(r));

  // Sessions
  r.log.notice(`HTTP: GET    /accounts/v1/sessions`);
  r.http.get(`/accounts/v1/sessions`, Sessions.handleGetAllSessions(r));
  r.log.notice(`HTTP: GET    /accounts/v1/users/:id/sessions`);
  r.http.get(`/accounts/v1/users/:id/sessions`, Sessions.handleGetUserSessions(r));
  r.log.notice(`HTTP: POST   /accounts/v1/sessions/login/email`);
  r.http.post(`/accounts/v1/sessions/login/email`, [
    parseBody,
    Sessions.handlePostSessionsLoginEmail(r),
  ]);
  r.log.notice(`HTTP: POST   /accounts/v1/sessions/login/password`);
  r.http.post(`/accounts/v1/sessions/login/password`, [
    parseBody,
    Sessions.handlePostSessionsLoginPassword(r),
  ]);
  r.log.notice(`HTTP: POST   /accounts/v1/sessions/login/code`);
  r.http.post(`/accounts/v1/sessions/login/code`, [
    parseBody,
    Sessions.handlePostSessionsLoginCode(r),
  ]);
  r.log.notice(`HTTP: POST   /accounts/v1/sessions/login/totp`);
  r.http.post(`/accounts/v1/sessions/login/totp`, [
    parseBody,
    Sessions.handlePostSessionsLoginTotp(r),
  ]);
  r.log.notice(`HTTP: POST   /accounts/v1/sessions/refresh`);
  r.http.post(`/accounts/v1/sessions/refresh`, [parseBody, Sessions.handlePostSessionsRefresh(r)]);
  r.log.notice(`HTTP: POST   /accounts/v1/sessions/logout`);
  r.http.post(`/accounts/v1/sessions/logout`, [
    parseBodyAllowBlank,
    Sessions.handlePostSessionsLogout(r),
  ]);

  // Catch-all for unhandled accounts endpoints
  r.log.notice(`HTTP: Fallthrough handler for accounts module: ALL    /accounts/v1/*`);
  r.http.all(`/accounts/v1/*`, (req, res, next) => {
    next(
      new E.BadRequest(`Unknown Endpoint: ${req.method} ${req.path}`, `ACCOUNTS-UNKNOWN-ENDPOINT`)
    );
  });
};
