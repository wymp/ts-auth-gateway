import * as rt from "runtypes";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Auth } from "@wymp/types";
import * as E from "@wymp/http-errors";
import * as Http from "@wymp/http-utils";
import { AppDeps, ClientRoles, UserRoles } from "../../Types";
import * as T from "../../Translators";
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

/** GET /organizations/:id/clients/:id/access-restrictions */
export const getClientAccessRestrictionsHandler = (
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
          `GET-CLIENT-ACCESS-RESTRICTIONS_BAD-PARAMS`
        );
      }

      // Make sure org and client exist
      await r.io.getOrganizationById(organizationId, log, true);
      const client = await r.io.getClientById(clientId, log, true);

      // Authorize
      await authorizeCallerForRole(organizationId, auth, "read", "GET-CLIENT-ACCESS-RESTRICTIONS", {
        ...r,
        log,
      });

      // Make sure the client belongs to the org and is not deleted
      if (client.deletedMs !== null) {
        throw new E.NotFound(
          `No client found with id '${clientId}'`,
          `GET-CLIENT-ACCESS-RESTRICTIONS_NOT-FOUND`
        );
      }
      if (client.organizationId !== organizationId) {
        throw new E.BadRequest(
          `The given client is not owned by the given organization. Please use the correct ids.`,
          `GET-CLIENT-ACCESS-RESTRICTIONS_ID-MISMATCH`
        );
      }

      // Get and send response
      const accessRestrictions = await r.io.getClientAccessRestrictions(
        { _t: "filter", clientId },
        Http.getCollectionParams(req.query),
        log
      );
      const response: Auth.Api.Responses<
        ClientRoles,
        UserRoles
      >["GET /organizations/:id/clients/:id/access-restrictions"] = {
        ...accessRestrictions,
        data: T.ClientAccessRestrictions.dbToApi(accessRestrictions.data),
      };
      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

/** POST /organizations/:id/clients/:id/access-restrictions */
export const postClientAccessRestrictionsHandler = (
  r: Pick<AppDeps, "config" | "log" | "io" | "authz">
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
          `POST-CLIENT-ACCESS-RESTRICTIONS_BAD-PARAMS`
        );
      }

      // Make sure org and client exist
      await r.io.getOrganizationById(organizationId, log, true);
      const client = await r.io.getClientById(clientId, log, true);

      // Make sure the client belongs to the org and is not deleted
      if (client.deletedMs !== null) {
        throw new E.NotFound(
          `No client found with id '${clientId}'`,
          `POST-CLIENT-ACCESS-RESTRICTIONS_NOT-FOUND`
        );
      }
      if (client.organizationId !== organizationId) {
        throw new E.BadRequest(
          `The given client is not owned by the given organization. Please use the correct ids.`,
          `POST-CLIENT-ACCESS-RESTRICTIONS_ID-MISMATCH`
        );
      }

      // Authorize
      await authorizeCallerForRole(
        organizationId,
        auth,
        "manage",
        "POST-CLIENT-ACCESS-RESTRICTIONS",
        { ...r, log }
      );

      // Validate
      const validation = PostClientAccessRestrictions.validate(req.body);
      Common.throwOnInvalidBody(validation);
      const post = validation.value.data;

      // Further validation: Only sysadmins and internal system clients can add api restrictions
      if (post.type === "api-access-restrictions") {
        log.info(`Trying to create API access restriction. Enforcing privileged entity.`);
        if (!Common.isInternalSystemClient(auth.r, auth.a, log)) {
          log.info(`Not an internal system client. Checking for privileged user.`);
          if (!auth.u || !auth.u.r.includes("sysadmin")) {
            log.notice(`Not a privileged user. Denying access.`);
            throw new E.Forbidden(
              `API restrictions are only editable by internal entities.`,
              `POST-API-ACCESS-RESTRICTION.INSUFFICIENT-PRIVILEGES`
            );
          } else {
            log.info(`Privileged user. Allowing.`);
          }
        } else {
          log.info(`Internal system client. Allowing.`);
        }
      }

      const typemap: {
        [k in rt.Static<
          typeof PostClientAccessRestrictions
        >["data"]["type"]]: Auth.ClientAccessRestrictionTypes;
      } = {
        "ip-access-restrictions": Auth.ClientAccessRestrictionTypes.Ip,
        "host-access-restrictions": Auth.ClientAccessRestrictionTypes.Host,
        "api-access-restrictions": Auth.ClientAccessRestrictionTypes.Api,
      };

      // Add client accessRestriction
      const accessRestriction = await r.io.saveClientAccessRestriction(
        {
          clientId,
          type: typemap[post.type],
          value: post.value,
        },
        req.auth,
        log
      );

      // Get all client access-restrictions and return as response
      const response: Auth.Api.Responses<
        ClientRoles,
        UserRoles
      >["POST /organizations/:id/clients/:id/access-restrictions"] = {
        t: "single",
        data: T.ClientAccessRestrictions.dbToApi(accessRestriction, log),
      };
      res.status(201).send(response);
    } catch (e) {
      next(e);
    }
  };
};

const PostClientAccessRestrictions = rt.Record({
  data: rt.Record({
    type: rt.Union(
      rt.Literal("ip-access-restrictions"),
      rt.Literal("host-access-restrictions"),
      rt.Literal("api-access-restrictions")
    ),
    value: rt.String,
  }),
});

/** DELETE /organizations/:id/clients/:id/access-restrictions/:accessRestrictionId */

export const deleteClientAccessRestrictionsHandler = (
  r: Pick<AppDeps, "config" | "log" | "io" | "authz">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      // Make sure it's an authd request so we can access the auth object
      Http.assertAuthdReq(req);
      const auth = req.auth;
      Common.assertAuth(auth);

      // Get organization, client and accessRestriction ids from params and verify
      const organizationId = req.params.orgId;
      const clientId = req.params.id;
      const accessRestrictionId = req.params.accessRestrictionId;
      if (!organizationId || !clientId || !accessRestrictionId) {
        throw new E.InternalServerError(
          `Programmer: This endpoint is not set up correctly. Expecting 'orgId', 'id' (client ` +
            `id) and 'accessRestrictionId' url parameters, but at least one was missing.`,
          `DELETE-CLIENT-ACCESS-RESTRICTIONS_BAD-PARAMS`
        );
      }

      // Make sure org and client exist
      await r.io.getOrganizationById(organizationId, log, true);
      const client = await r.io.getClientById(clientId, log, true);

      // Make sure the client belongs to the org and is not deleted
      if (client.deletedMs !== null) {
        throw new E.NotFound(
          `No client found with id '${clientId}'`,
          `DELETE-CLIENT-ACCESS-RESTRICTIONS_NOT-FOUND`
        );
      }
      if (client.organizationId !== organizationId) {
        throw new E.BadRequest(
          `The given client is not owned by the given organization. Please use the correct ids.`,
          `DELETE-CLIENT-ACCESS-RESTRICTIONS_ID-MISMATCH`
        );
      }

      // Authorize
      await authorizeCallerForRole(
        organizationId,
        auth,
        "manage",
        "DELETE-CLIENT-ACCESS-RESTRICTIONS",
        { ...r, log }
      );

      // Get the restriction first for further authorization
      const restriction = await r.io.getClientAccessRestrictionById(accessRestrictionId, log, true);

      // Further validation: Only sysadmins and internal system clients can add api restrictions
      if (restriction.type === "api") {
        log.info(`Trying to delete API access restriction. Enforcing privileged entity.`);
        if (!Common.isInternalSystemClient(auth.r, auth.a, log)) {
          log.info(`Not an internal system client. Checking for privileged user.`);
          if (!auth.u || !auth.u.r.includes("sysadmin")) {
            log.notice(`Not a privileged user. Denying access.`);
            throw new E.Forbidden(
              `API restrictions are only editable by internal entities.`,
              `DELETE-API-ACCESS-RESTRICTION.INSUFFICIENT-PRIVILEGES`
            );
          } else {
            log.info(`Privileged user. Allowing.`);
          }
        } else {
          log.info(`Internal system client. Allowing.`);
        }
      }

      // Delete accessRestriction and respond
      await r.io.deleteClientAccessRestriction(accessRestrictionId, auth, log);

      const response: Auth.Api.Responses<
        ClientRoles,
        UserRoles
      >["DELETE /organizations/:id/clients/:id/access-restrictions/:id"] = {
        data: null,
      };
      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};
