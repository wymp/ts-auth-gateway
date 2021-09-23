//import * as rt from "runtypes";
import * as E from "@wymp/http-errors";
import * as Http from "@wymp/http-utils";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Api, Auth } from "@wymp/types";
import * as T from "../../Translators";
import { AppDeps, UserRoles, ClientRoles } from "../../Types";
//import { InvalidBodyError } from "../Lib";
import * as Common from "./Common";

/**
 *
 *
 *
 *
 * GET /accounts/v1/users/:id/memberships
 *
 *
 *
 *
 */

export const getByUserIdHandler = (r: Pick<AppDeps, "io" | "log">): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      // Get user id
      let userId = req.params.id;

      // Require valid userId
      if (!userId) {
        throw new E.InternalServerError(
          `Programmer: this functionality is expecting req.params.id to be set, but it is not.`
        );
      }

      // Validate request object
      Http.assertAuthdReq(req);
      const auth = req.auth;
      Common.assertAuth(auth);

      // Validate user id (will throw 404 if not found)
      await r.io.get("users", { id: userId }, log, true);

      // Get response
      const memberships = await getByUserId(userId, auth, Http.getCollectionParams(req.query), {
        ...r,
        log,
      });
      const response: Auth.Api.Responses<ClientRoles, UserRoles>["GET /users/:id/memberships"] = {
        ...memberships,
        data: memberships.data.map((m) => T.OrgMemberships.dbToApi(m)),
      };

      res.send(response);
    } catch (e) {
      next(e);
    }
  };
};

export const getByUserId = async (
  userId: string,
  auth: Auth.ReqInfoString,
  collectionParams: Api.CollectionParams,
  r: Pick<AppDeps, "io" | "log">
): Promise<Api.CollectionResponse<Auth.Db.OrgMembership, any>> => {
  // Authorize - must be an authenticated internal system client, or the user id must match the
  // calling user, or the calling user must be a sysadmin or employee
  const proceed =
    Common.isInternalSystemClient(auth.r, auth.a, r.log) ||
    (auth.u && Common.callerIsOwnerOrPrivilegedUser(userId, auth, null, r.log));

  if (!proceed) {
    throw new E.Forbidden(
      `You do not have sufficient permissions to perform this operation.`,
      `GET-MEMBERSHIPS-BY-USER-ID_INSUFFICIENT-PERMISSIONS`
    );
  }

  // If we've got permissions, get the memberships
  return await r.io.get("org-memberships", { _t: "filter", userId }, collectionParams, r.log);
};

/**
 *
 *
 *
 *
 * GET /accounts/v1/organizations/:id/memberships
 *
 *
 *
 *
 */

export const getByOrganizationIdHandler = (
  r: Pick<AppDeps, "io" | "log">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      // Get organization id
      let organizationId = req.params.id;

      // Require valid userId
      if (!organizationId) {
        throw new E.InternalServerError(
          `Programmer: this functionality is expecting req.params.id to be set, but it is not.`
        );
      }

      // Validate request object
      Http.assertAuthdReq(req);
      const auth = req.auth;
      Common.assertAuth(auth);

      // Validate user id (will throw 404 if not found)
      const organization = await r.io.get("organizations", { id: organizationId }, log, true);

      // Get response
      const memberships = await getByOrganizationId(
        organizationId,
        auth,
        Http.getCollectionParams(req.query),
        organization,
        {
          ...r,
          log,
        }
      );
      const response: Auth.Api.Responses<
        ClientRoles,
        UserRoles
      >["GET /organizations/:id/memberships"] = {
        ...memberships,
        data: memberships.data.map((m) => T.OrgMemberships.dbToApi(m)),
      };

      res.send(response);
    } catch (e) {
      next(e);
    }
  };
};

export const getByOrganizationId = async (
  organizationId: string,
  auth: Auth.ReqInfoString,
  collectionParams: Api.CollectionParams,
  organization: Auth.Db.Organization | null,
  r: Pick<AppDeps, "io" | "log">
): Promise<Api.CollectionResponse<Auth.Db.OrgMembership, any>> => {
  // Authorize - must be an authenticated internal system client, or the calling user must be a
  // sysadmin or employee, or the calling user must be a privileged memeber of the organization
  let proceed = Common.isInternalSystemClient(auth.r, auth.a, r.log);
  if (!proceed && auth.u) {
    r.log.info(`Checking to see if caller is sysadmin or employee`);
    if (auth.u.r.find((role) => privilegedUsers.includes(role))) {
      r.log.info(`Caller is sysadmin or employee. Proceeding.`);
      proceed = true;
    } else {
      r.log.info(`Checking to see if user is a privileged member of the organization.`);
      const membership = await r.io.get(
        "org-memberships",
        { userId: auth.u.id, organizationId },
        r.log,
        false
      );
      if (membership && membership.read) {
        r.log.info(`User has "read" privileges on the organization. Proceeding.`);
        proceed = true;
      } else {
        r.log.info(`User does not have "read" privileges on the organization.`);
      }
    }
  }

  if (!proceed) {
    throw new E.Forbidden(
      `You do not have sufficient permissions to perform this operation.`,
      `GET-MEMBERSHIPS-BY-ORG-ID_INSUFFICIENT-PERMISSIONS`
    );
  }

  // If we've got permissions, get the memberships
  return await r.io.get(
    "org-memberships",
    { _t: "filter", organizationId },
    collectionParams,
    r.log
  );
};

const privilegedUsers: Array<string> = [UserRoles.SYSADMIN, UserRoles.EMPLOYEE];
