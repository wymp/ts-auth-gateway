import * as rt from "runtypes";
import * as E from "@wymp/http-errors";
import * as Http from "@wymp/http-utils";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Api, Auth } from "@wymp/types";
import * as T from "../../Translators";
import { AppDeps, Db, UserRoles, ClientRoles } from "../../Types";
import * as Common from "./Common";
import { getDealiasedUserIdFromReq } from "./Users";

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
    const log = Http.logger(r.log, req, res);
    try {
      // Validate request object
      Http.assertAuthdReq(req);
      const auth = req.auth;
      Common.assertAuth(auth);

      // Get user id
      const userId = getDealiasedUserIdFromReq(req, log);

      // Authorization happens in the actual "get" function below

      // Validate user id (will throw 404 if not found)
      await r.io.getUserById(userId, log, true);

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
  collectionParams: Api.Server.CollectionParams,
  r: Pick<AppDeps, "io" | "log">
): Promise<Api.CollectionResponse<Db.OrgMembership, any>> => {
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
  return await r.io.getOrgMemberships({ type: "users", id: userId }, collectionParams, r.log);
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

      // Require valid orgId
      if (!organizationId) {
        throw new E.InternalServerError(
          `Programmer: this functionality is expecting req.params.id to be set, but it is not.`
        );
      }

      // Validate request object
      Http.assertAuthdReq(req);
      const auth = req.auth;
      Common.assertAuth(auth);

      // Validate org id (will throw 404 if not found)
      await r.io.getOrganizationById(organizationId, log, true);

      // Get response (validations are performed by this function)
      const memberships = await getByOrganizationId(
        organizationId,
        auth,
        Http.getCollectionParams(req.query),
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
  collectionParams: Api.Server.CollectionParams,
  r: Pick<AppDeps, "io" | "log">
): Promise<Api.CollectionResponse<Db.OrgMembership, any>> => {
  // Authorize - must be an authenticated internal system client, or the calling user must be a
  // sysadmin or employee, or the calling user must be a privileged memeber of the organization
  await authorizeCallerForRole(organizationId, auth, "read", "GET-MEMBERSHIPS-BY-ORG-ID", r);

  // If we've got permissions, get the memberships
  return await r.io.getOrgMemberships(
    { type: "organizations", id: organizationId },
    collectionParams,
    r.log
  );
};

/**
 *
 *
 *
 *
 * POST /accounts/v1/organizations/:id/memberships
 * You can POST membership objects one at a time. The payload must be a full membership object.
 *
 *
 *
 *
 */

export const postOrgMembershipHandler = (
  r: Pick<AppDeps, "log" | "io">
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

      // Validate org id (will throw 404 if not found)
      await r.io.getOrganizationById(organizationId, log, true);

      // Validate body
      const validation = PostOrgMembership.validate(req.body);
      Common.throwOnInvalidBody(validation);
      const postOrgMembership = validation.value.data;

      // Hand back to the functions
      await addNewOrgMembership(organizationId, postOrgMembership, auth, { ...r, log });

      // Return new collection of memberships
      const memberships = await getByOrganizationId(organizationId, auth, {}, { ...r, log });
      const response: Auth.Api.Responses<
        ClientRoles,
        UserRoles
      >["POST /organizations/:id/memberships"] = {
        ...memberships,
        data: memberships.data.map((m) => T.OrgMemberships.dbToApi(m)),
      };
      res.status(201).send(response);
    } catch (e) {
      return next(e);
    }
  };
};

/**
 * POST /organizations type checking
 */
const PostOrgMembership = rt.Record({
  data: rt.Record({
    type: rt.Literal("org-memberships"),
    user: rt.Record({ type: rt.Literal("users"), id: rt.String }),
    read: rt.Boolean,
    edit: rt.Boolean,
    manage: rt.Boolean,
    delete: rt.Boolean,
  }),
});

const addNewOrgMembership = async (
  organizationId: string,
  incoming: rt.Static<typeof PostOrgMembership>["data"],
  auth: Auth.ReqInfoString,
  r: Pick<AppDeps, "io" | "log">
): Promise<Db.OrgMembership> => {
  // Authorize
  await authorizeCallerForRole(organizationId, auth, "manage", "ADD-NEW-ORG-MEMBERSHIP", r);

  // Check to see if membership already exists
  let membership = await r.io.getOrgMembershipById(
    { userId: incoming.user.id, organizationId },
    r.log,
    false
  );

  if (membership) {
    r.log.info(`Membership already exists for this user. Updating it.`);
    membership = await r.io.updateOrgMembership(
      membership.id,
      {
        read: incoming.read ? 1 : 0,
        edit: incoming.edit ? 1 : 0,
        manage: incoming.manage ? 1 : 0,
        delete: incoming.delete ? 1 : 0,
      },
      auth,
      r.log
    );
  } else {
    r.log.info(`Membership does not already exist for this user. Creating.`);
    membership = await r.io.saveOrgMembership(
      {
        organizationId,
        userId: incoming.user.id,
        read: incoming.read ? 1 : 0,
        edit: incoming.edit ? 1 : 0,
        manage: incoming.manage ? 1 : 0,
        delete: incoming.delete ? 1 : 0,
      },
      auth,
      r.log
    );
  }

  // Return membership
  return membership;
};

/**
 *
 *
 *
 *
 * PATCH /accounts/v1/org-memberships/:id
 *
 *
 *
 *
 */

export const patchOrgMembershipHandler = (
  r: Pick<AppDeps, "log" | "io">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      // Get organization id
      let membershipId = req.params.id;

      // Require valid userId
      if (!membershipId) {
        throw new E.InternalServerError(
          `Programmer: this functionality is expecting req.params.id to be set, but it is not.`
        );
      }

      // Validate request object
      Http.assertAuthdReq(req);
      const auth = req.auth;
      Common.assertAuth(auth);

      // Validate body
      const validation = PatchOrgMembership.validate(req.body);
      Common.throwOnInvalidBody(validation);
      const patchOrgMembership = validation.value.data;

      // Hand back to the functions
      const membership = await updateOrgMembership(membershipId, patchOrgMembership, auth, {
        ...r,
        log,
      });

      // Return new collection of memberships
      const response: Auth.Api.Responses<ClientRoles, UserRoles>["PATCH /org-memberships/:id"] = {
        t: "single",
        data: T.OrgMemberships.dbToApi(membership),
      };
      res.status(200).send(response);
    } catch (e) {
      return next(e);
    }
  };
};

/**
 * PATCH /org-membership/:id type checking
 */
const PatchOrgMembership = rt.Record({
  data: rt.Record({
    type: rt.Literal("org-memberships"),
    id: rt.String,
    read: rt.Optional(rt.Boolean),
    edit: rt.Optional(rt.Boolean),
    manage: rt.Optional(rt.Boolean),
    delete: rt.Optional(rt.Boolean),
  }),
});

const updateOrgMembership = async (
  membershipId: string,
  incoming: rt.Static<typeof PatchOrgMembership>["data"],
  auth: Auth.ReqInfoString,
  r: Pick<AppDeps, "io" | "log">
): Promise<Db.OrgMembership> => {
  // Get membership
  let membership = await r.io.getOrgMembershipById({ id: membershipId }, r.log, true);

  // Authorize if the caller is not the owner of the membership
  if (!auth.u || auth.u.id !== membership.userId) {
    r.log.info(
      `Caller is not the membership owner. Verifying that caller has 'manage' permissions on ` +
        `this organization.`
    );
    await authorizeCallerForRole(
      membership.organizationId,
      auth,
      "manage",
      "UPDATE-ORG-MEMBERSHIP",
      r
    );
  }

  membership = await r.io.updateOrgMembership(
    membership.id,
    {
      ...(incoming.read === undefined ? {} : { read: incoming.read ? 1 : 0 }),
      ...(incoming.edit === undefined ? {} : { edit: incoming.edit ? 1 : 0 }),
      ...(incoming.manage === undefined ? {} : { manage: incoming.manage ? 1 : 0 }),
      ...(incoming.delete === undefined ? {} : { delete: incoming.delete ? 1 : 0 }),
    },
    auth,
    r.log
  );

  // Return membership
  return membership;
};

/**
 *
 *
 *
 *
 * DELETE /accounts/v1/org-memberships/:id
 *
 *
 *
 *
 */

export const deleteOrgMembershipHandler = (
  r: Pick<AppDeps, "log" | "io">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      // Get organization id
      let membershipId = req.params.id;

      // Require valid userId
      if (!membershipId) {
        throw new E.InternalServerError(
          `Programmer: this functionality is expecting req.params.id to be set, but it is not.`
        );
      }

      // Validate request object
      Http.assertAuthdReq(req);
      const auth = req.auth;
      Common.assertAuth(auth);

      // Hand back to the functions
      await deleteOrgMembership(membershipId, auth, { ...r, log });

      // Return new collection of memberships
      const response: Auth.Api.Responses<ClientRoles, UserRoles>["DELETE /org-memberships/:id"] = {
        data: null,
      };
      res.status(200).send(response);
    } catch (e) {
      return next(e);
    }
  };
};

/**
 * Delete the given membership.
 *
 * Note that the caller must be a system client, a user with employee or sysadmin privileges,
 * the owner of the membership, or a user with "delete" privileges on the organization.
 */
const deleteOrgMembership = async (
  membershipId: string,
  auth: Auth.ReqInfoString,
  r: Pick<AppDeps, "io" | "log">
): Promise<void> => {
  // Get membership
  const membership = await r.io.getOrgMembershipById({ id: membershipId }, r.log, true);

  // Authorize if the caller is not the owner of the membership
  if (!auth.u || auth.u.id !== membership.userId) {
    r.log.info(
      `Caller is not the membership owner. Verifying that caller has 'delete' permissions on ` +
        `this organization.`
    );
    await authorizeCallerForRole(
      membership.organizationId,
      auth,
      "delete",
      "DELETE-ORG-MEMBERSHIP",
      r
    );
  }

  await r.io.deleteOrgMembership(membership.id, auth, r.log);
};

/**
 *
 *
 *
 *
 * Misc
 *
 *
 *
 *
 */

/** An array of privileged users to make authorization easier */
const privilegedUsers: Array<string> = [UserRoles.SYSADMIN, UserRoles.EMPLOYEE];

/**
 * Ensure the caller is either A) an internal system client; B) a sysadmin or employee user; or C)
 * a member of the organization who has the given role.
 */
export const authorizeCallerForRole = async (
  organizationId: string,
  caller: { r: Array<string>; a: boolean; u?: { id: string; r: Array<string> } },
  role: "read" | "edit" | "manage" | "delete",
  operation: string,
  r: Pick<AppDeps, "io" | "log">
): Promise<void> => {
  let proceed = Common.isInternalSystemClient(caller.r, caller.a, r.log);
  if (!proceed && caller.u) {
    r.log.info(`Checking to see if caller is a privileged user.`);
    if (caller.u.r.find((role) => privilegedUsers.includes(role))) {
      r.log.info(`Caller is privileged user. Proceeding.`);
      proceed = true;
    } else {
      r.log.info(
        `Caller is not a privileged user. (Caller's roles: ${JSON.stringify(
          caller.u.r
        )}.) Checking to see if caller is a privileged member of the organization.`
      );
      const membership = await r.io.getOrgMembershipById(
        { userId: caller.u.id, organizationId },
        r.log,
        false
      );
      if (membership) {
        const perms = {
          read: membership.read,
          edit: membership.edit,
          manage: membership.manage,
          delete: membership.delete,
        };
        if (perms[role] === 1) {
          r.log.info(`Caller has "${role}" privileges on the organization. Proceeding.`);
          proceed = true;
        } else {
          r.log.info(`Caller does not have "${role}" privileges on the organization.`);
        }
      } else {
        r.log.info(`Caller is not a member of the organization`);
      }
    }
  }

  if (!proceed) {
    throw new E.Forbidden(
      `You do not have sufficient permissions to perform this operation.`,
      `${operation}_INSUFFICIENT-PERMISSIONS`
    );
  }
};
