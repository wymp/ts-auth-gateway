import * as rt from "runtypes";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Auth } from "@wymp/types";
import * as E from "@wymp/http-errors";
import * as Http from "@wymp/http-utils";
import { AppDeps, UserRoles, ClientRoles } from "../../Types";
import { InvalidBodyError } from "../Lib";
import * as Common from "./Common";
import { getDealiasedUserIdFromReq } from "./Users";

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

/** GET /users/:id/roles */
export const getUserRoles = (
  r: Pick<AppDeps, "log" | "io" | "authz">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      // Make sure it's an authd request so we can access the auth object
      Http.assertAuthdReq(req);

      // Get user id
      const userId = getDealiasedUserIdFromReq(req, log);

      // If the user is not requesting their own user object, then this requires authorization
      if (userId !== undefined && userId !== req.auth.u?.id) {
        Http.authorize(req, r.authz["GET /users/:id/roles"], log);
      }

      // Verify that user exists
      await r.io.get("users", { id: userId }, log, true);

      // Get and send response
      const roles = await r.io.get("user-roles", { _t: "filter", userId }, log);
      const response: Auth.Api.Responses<ClientRoles, UserRoles>["GET /users/:id/roles"] = {
        ...roles,
        data: roles.data.map((row) => ({ type: "user-roles", id: row.roleId })),
      };
      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

/** POST /users/:id/roles */
export const postUserRoles = (
  r: Pick<AppDeps, "config" | "log" | "io" | "authz">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      // Make sure it's an authd request so we can access the auth object
      Http.assertAuthdReq(req);

      // Get user id
      const userId = getDealiasedUserIdFromReq(req, log);

      // If the user is not requesting their own user object, then this requires authorization
      if (userId !== undefined && userId !== req.auth.u?.id) {
        Http.authorize(req, r.authz["POST /users/:id/roles"], log);
      }

      // Validate
      const validation = PostUserRoles.validate(req.body);
      if (!validation.success) {
        throw InvalidBodyError(validation);
      }
      const roleId = validation.value.data.id;

      // Add user role
      await addUserRole(userId, roleId as UserRoles, req.auth, { ...r, log });

      // Get all user roles and return as response
      const roles = await r.io.get("user-roles", { _t: "filter", userId }, log);
      const response: Auth.Api.Responses<ClientRoles, UserRoles>["POST /users/:id/roles"] = {
        ...roles,
        data: roles.data.map((row) => ({ type: "user-roles", id: row.roleId })),
      };
      res.status(201).send(response);
    } catch (e) {
      next(e);
    }
  };
};

const PostUserRoles = rt.Record({
  data: rt.Record({
    type: rt.Literal("user-roles"),
    id: rt.Union(rt.Literal("sysadmin"), rt.Literal("employee"), rt.Literal("user")),
  }),
});

export const addUserRole = async (
  userId: string,
  roleId: UserRoles,
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "io" | "log">
): Promise<void> => {
  // Make sure we've got a string-based req info object
  Common.assertAuth(auth);

  // Only sysadmins can assign sysadmin and employee roles
  if (
    (roleId === UserRoles.SYSADMIN || roleId === UserRoles.EMPLOYEE) &&
    (!auth.u || !auth.u.r.includes(UserRoles.SYSADMIN))
  ) {
    throw new E.BadRequest(
      `You do not have sufficient permissions to assign the sysadmin role`,
      `USER-ROLES-INSUFFICIENT-PERMISSIONS`
    );
  }

  // Only employees and sysadmins can assign other roles
  if (!auth.u || !auth.u.r.includes(UserRoles.SYSADMIN)) {
    throw new E.BadRequest(
      `You do not have sufficient permissions to assign the sysadmin role`,
      `USER-ROLES-INSUFFICIENT-PERMISSIONS`
    );
  }

  // Now add the role
  await r.io.save("user-roles", { userId, roleId }, auth, r.log);
};

/** DELETE /user/:id/roles/:roleId */

export const deleteUserRoles = (
  r: Pick<AppDeps, "config" | "log" | "io" | "authz">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      // Make sure it's an authd request so we can access the auth object
      Http.assertAuthdReq(req);

      // Get user id and roleId
      const userId = getDealiasedUserIdFromReq(req, log);
      const roleId = req.params.roleId;

      // Verify existence of params
      if (!userId || !roleId) {
        throw new E.InternalServerError(
          `Programmer: This endpoint is not set up correctly. Expecting 'userId' and 'roleId' url parameters, but at least one was missing.`,
          `DELETE-USER-ROLES_BAD-PARAMS`
        );
      }

      // If the user is not requesting their own user object, then this requires authorization
      if (userId !== undefined && userId !== req.auth.u?.id) {
        Http.authorize(req, r.authz["DELETE /users/:id/roles"], log);
      }

      // Delete role and respond
      await r.io.deleteUserRole(userId, roleId, req.auth, log);

      const response: Auth.Api.Responses<ClientRoles, UserRoles>["DELETE /users/:id/roles/:id"] = {
        data: null,
      };
      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};
