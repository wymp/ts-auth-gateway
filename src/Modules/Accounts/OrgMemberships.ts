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
 * GET OrgMemeberships
 * Expecting a request to /accounts/v1/users/:id/memberships
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
          `Programmer: this functionality is expecting req.params.id to be set, but it is ` + `not.`
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
