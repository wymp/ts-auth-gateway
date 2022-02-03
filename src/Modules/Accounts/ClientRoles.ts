import * as rt from "runtypes";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Auth } from "@wymp/types";
import * as E from "@wymp/http-errors";
import * as Http from "@wymp/http-utils";
import { AppDeps, ClientRoles, UserRoles } from "../../Types";
import * as Common from "./Common";
import { authorizeCallerForRole } from "./OrgMemberships";

/**
 *
 *
 *
 *
 * Handlers
 *
 *
 *
 *
 */

/** GET /organizations/:id/clients/:id/roles */
export const getClientRolesHandler = (
  r: Pick<AppDeps, "log" | "io" | "authz">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      // Make sure it's an authd request so we can access the auth object
      Http.assertAuthdReq(req);
      const auth = req.auth;
      Common.assertAuth(auth);

      // Get organization and client ids from params and verify
      const organizationId = req.params.orgId;
      const clientId = req.params.id;
      if (!organizationId || !clientId) {
        throw new E.InternalServerError(
          `Programmer: This endpoint is not set up correctly. Expecting 'orgId' and 'clientId' ` +
            `url parameters, but one or both were missing.`,
          `GET-CLIENT-ROLES_BAD-PARAMS`
        );
      }

      // Make sure org and client exist
      await r.io.getOrganizationById(organizationId, log, true);
      const client = await r.io.getClientById(clientId, log, true);

      // Authorize
      await authorizeCallerForRole(organizationId, auth, "read", "GET-CLIENT-ROLES", { ...r, log });

      // Make sure the client belongs to the org and is not deleted
      if (client.organizationId !== organizationId || client.deletedMs !== null) {
        throw new E.BadRequest(
          `The given client is not owned by the given organization. Please use the correct ids.`,
          `GET-CLIENT-ROLES_ID-MISMATCH`
        );
      }

      // Get and send response
      const roles = await r.io.getClientRoles({ _t: "filter", clientId }, log);
      const response: Auth.Api.Responses<
        ClientRoles,
        UserRoles
      >["GET /organizations/:id/clients/:id/roles"] = {
        ...roles,
        data: roles.data.map((row) => ({ type: "client-roles", id: row.roleId })),
      };
      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

/** POST /organizations/:id/clients/:id/roles */
export const postClientRolesHandler = (
  r: Pick<AppDeps, "config" | "log" | "io" | "authz">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      // Get organization and client ids from params and verify
      const organizationId = req.params.orgId;
      const clientId = req.params.id;
      if (!organizationId || !clientId) {
        throw new E.InternalServerError(
          `Programmer: This endpoint is not set up correctly. Expecting 'orgId' and 'clientId' ` +
            `url parameters, but one or both were missing.`,
          `POST-CLIENT-ROLES_BAD-PARAMS`
        );
      }

      // Authorize
      Http.authorize(req, r.authz["POST /organizations/:id/clients/:id/roles"], log);

      // Make sure org and client exist
      await r.io.getOrganizationById(organizationId, log, true);
      const client = await r.io.getClientById(clientId, log, true);

      // Make sure the client belongs to the org and is not deleted
      if (client.organizationId !== organizationId || client.deletedMs !== null) {
        throw new E.BadRequest(
          `The given client is not owned by the given organization. Please use the correct ids.`,
          `POST-CLIENT-ROLES_ID-MISMATCH`
        );
      }

      // Validate
      const validation = PostClientRoles.validate(req.body);
      Common.throwOnInvalidBody(validation);
      const roleId = validation.value.data.id;

      // Add client role
      await r.io.saveClientRole({ clientId, roleId: roleId as ClientRoles }, req.auth, log);

      // Get all client roles and return as response
      const roles = await r.io.getClientRoles({ _t: "filter", clientId }, log);
      const response: Auth.Api.Responses<
        ClientRoles,
        UserRoles
      >["POST /organizations/:id/clients/:id/roles"] = {
        ...roles,
        data: roles.data.map((row) => ({ type: "client-roles", id: row.roleId })),
      };
      res.status(201).send(response);
    } catch (e) {
      next(e);
    }
  };
};

const PostClientRoles = rt.Record({
  data: rt.Record({
    type: rt.Literal("client-roles"),
    id: rt.Union(rt.Literal("system"), rt.Literal("internal"), rt.Literal("external")),
  }),
});

/** DELETE /organizations/:id/clients/:id/roles/:roleId */

export const deleteClientRolesHandler = (
  r: Pick<AppDeps, "config" | "log" | "io" | "authz">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      // Get organization, client and role ids from params and verify
      const organizationId = req.params.orgId;
      const clientId = req.params.id;
      const roleId = req.params.roleId;
      if (!organizationId || !clientId || !roleId) {
        throw new E.InternalServerError(
          `Programmer: This endpoint is not set up correctly. Expecting 'orgId', 'id' (client ` +
            `id) and 'roleId' url parameters, but at least one was missing.`,
          `DELETE-CLIENT-ROLES_BAD-PARAMS`
        );
      }

      // Authorize
      Http.authorize(req, r.authz["DELETE /organizations/:id/clients/:id/roles/:id"], log);

      // Make sure org and client exist
      await r.io.getOrganizationById(organizationId, log, true);
      const client = await r.io.getClientById(clientId, log, true);

      // Make sure the client belongs to the org and is not deleted
      if (client.organizationId !== organizationId || client.deletedMs !== null) {
        throw new E.BadRequest(
          `The given client is not owned by the given organization. Please use the correct ids.`,
          `DELETE-CLIENT-ROLES_ID-MISMATCH`
        );
      }

      // Delete role and respond
      await r.io.deleteClientRole(clientId, roleId, req.auth, log);

      const response: Auth.Api.Responses<
        ClientRoles,
        UserRoles
      >["DELETE /organizations/:id/clients/:id/roles/:id"] = {
        data: null,
      };
      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};
