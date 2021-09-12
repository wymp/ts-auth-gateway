import * as rt from "runtypes";
import * as E from "@wymp/http-errors";
import * as Http from "@wymp/http-utils";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Auth } from "@wymp/types";
import { AppDeps, UserRoles, ClientRoles } from "../../Types";
import { InvalidBodyError } from "../Lib";
import * as Common from "./Common";

/**
 *
 *
 *
 *
 * GET Organizations
 *
 *
 *
 *
 */

/**
 * This handler handles both GET /organizations and GET /organizations/:id. Permissinioning is the
 * same for both
 */
export const getOrganizations = (
  r: Pick<AppDeps, "log" | "io" | "authz">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      // Authorize
      Http.authorize(req, r.authz["GET /organizations(/:id)"], log);

      if (req.params.id) {
        // GET /organizations/:id
        const response: Auth.Api.Responses<ClientRoles, UserRoles>["GET /organizations/:id"] = {
          t: "single",
          data: {
            type: "organizations",
            ...(await r.io.get("organizations", { id: req.params.id }, log, true)),
          },
        };
        return res.send(response);
      } else {
        // GET /organizations
        const orgs = await r.io.get("organizations", Http.getCollectionParams(req.query), log);

        const response: Auth.Api.Responses<ClientRoles, UserRoles>["GET /organizations"] = {
          ...orgs,
          data: orgs.data.map((org) => ({
            type: "organizations",
            ...org,
          })),
        };
        return res.send(response);
      }
    } catch (e) {
      return next(e);
    }
  };
};

/**
 *
 *
 *
 *
 * POST Organizations
 *
 *
 *
 *
 */

/**
 * POST /organizations handler
 */
export const postOrganizations = (
  r: Pick<AppDeps, "log" | "io" | "authz">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      // Authorize
      Http.authorize(req, r.authz["POST /organizations"], log);

      // Validate
      const validation = PostOrganization.validate(req.body);
      if (!validation.success) {
        throw InvalidBodyError(validation);
      }
      const postOrganization = validation.value.data;

      // Hand back to the functions
      const newOrganization = await r.io.save(
        "organizations",
        { name: postOrganization.name },
        req.auth,
        r.log
      );

      const response: { data: Auth.Api.Organization } = {
        data: {
          type: "organizations",
          ...newOrganization,
        },
      };
      return res.status(201).send(response);
    } catch (e) {
      return next(e);
    }
  };
};

/**
 * POST /organizations type checking
 */
const PostOrganization = rt.Record({
  data: rt.Record({
    type: rt.Literal("organizations"),
    name: rt.String,
  }),
});

/**
 *
 *
 *
 *
 * PATCH Organization
 *
 *
 *
 *
 */

/**
 * PATCH /organizations/:id handler
 */
export const patchOrganization = (
  r: Pick<AppDeps, "log" | "io" | "authz">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      Http.assertAuthdReq(req);

      // Validate
      const validation = PatchOrganization.validate(req.body);
      if (!validation.success) {
        throw InvalidBodyError(validation);
      }
      const patchOrganization = validation.value.data;

      // Validate the id
      const organizationId = req.params.id;
      if (!organizationId) {
        throw new E.InternalServerError(
          `Programmer: Expecting an :id request param but one was not defined.`
        );
      }
      if (patchOrganization.id && organizationId !== patchOrganization.id) {
        throw new E.BadRequest(`You passed incompatible organization ids in your request.`);
      }

      // Hand back to handler function
      const organization = await updateOrganization(organizationId, patchOrganization, req.auth, {
        ...r,
        log,
      });

      const response: Auth.Api.Responses<ClientRoles, UserRoles>["GET /organizations/:id"] = {
        t: "single",
        data: {
          type: "organizations",
          ...organization,
        },
      };
      return res.status(200).send(response);
    } catch (e) {
      return next(e);
    }
  };
};

/**
 * PATCH /organizations/:id type checker
 */
const PatchOrganization = rt.Record({
  data: rt.Record({
    type: rt.Literal("organizations"),
    id: rt.Optional(rt.String),
    name: rt.String,
  }),
});

// Handler for updating organizations
export const updateOrganization = async (
  organizationId: string,
  payload: rt.Static<typeof PatchOrganization>["data"],
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "log" | "io">
): Promise<Auth.Db.Organization> => {
  await verifyOrganizationExistenceAndPerms(organizationId, auth, "edit" as const, r);

  // Do update and return result
  return await r.io.update("organizations", organizationId, { name: payload.name }, auth, r.log);
};

/**
 *
 *
 *
 *
 * DELETE Orgnization
 *
 *
 *
 *
 */

export const deleteOrganizationHandler = (
  r: Pick<AppDeps, "log" | "io">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      Http.assertAuthdReq(req);

      // Validate the id
      const organizationId = req.params.id;
      if (!organizationId) {
        throw new E.InternalServerError(
          `Programmer: Expecting an :id request param but one was not defined.`
        );
      }

      // Hand back to handler function
      await deleteOrganization(organizationId, req.auth, { ...r, log });

      res.send({ t: "null", data: null });
    } catch (e) {
      next(e);
    }
  };
};

export const deleteOrganization = async (
  organizationId: string,
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "io" | "log">
): Promise<void> => {
  await verifyOrganizationExistenceAndPerms(organizationId, auth, "delete" as const, r);

  // Delete
  await r.io.delete("organizations", organizationId, auth, r.log);

  return;
};

/**
 *
 *
 *
 *
 * COMMON FUNCTIONS
 *
 *
 *
 *
 */

export const verifyOrganizationExistenceAndPerms = async (
  organizationId: string,
  auth: Auth.ReqInfo,
  operation: keyof OrgPerms,
  r: Pick<AppDeps, "io" | "log">
): Promise<Auth.Db.Organization> => {
  // First verify existence (will throw if non-existent)
  const organization = await r.io.get("organizations", { id: organizationId }, r.log, true);

  // Verify auth object format
  Common.assertAuth(auth);

  // See if caller is an authenticated internal system client
  r.log.info(`Checking caller permissions for organization`);
  let proceed = Common.isInternalSystemClient(auth.r, auth.a, r.log);

  // See if caller is a privileged member of the org in question or a sysadmin or employee
  if (!proceed && auth.u) {
    r.log.info(`Client roles are insufficient for operation; checking user permissions.`);
    let membership = await r.io.get(
      "org-memberships",
      { organizationId, userId: auth.u.id },
      r.log,
      false
    );

    const perms: OrgPerms = {
      read: membership && membership.read ? 1 : 0,
      edit: membership && membership.edit ? 1 : 0,
      manage: membership && membership.manage ? 1 : 0,
      delete: membership && membership.delete ? 1 : 0,
    };

    if (perms[operation] !== 1) {
      r.log.info(
        `Caller ${
          membership ? `is not a member of this org` : `does not have ${operation} permissions`
        }.`
      );
      if (auth.u.r.includes(UserRoles.SYSADMIN) || auth.u.r.includes(UserRoles.EMPLOYEE)) {
        r.log.info(`Caller is a sysadmin or employee. Permitting operation.`);
        proceed = true;
      } else {
        r.log.info(`Caller is not a sysadmin or employee. Denying operation.`);
      }
    } else {
      r.log.info(`User is a member of the org and has ${operation} permissions. Proceeding.`);
      proceed = true;
    }
  }

  // Boot if not permitted
  if (!proceed) {
    throw new E.BadRequest(
      `You do not have sufficient credentials to ${operation} this organization.`,
      `ORG-EDIT_INSUFFICIENT-PERMISSIONS`
    );
  }

  return organization;
};

declare type OrgPerms = {
  read: 0 | 1;
  edit: 0 | 1;
  manage: 0 | 1;
  delete: 0 | 1;
};
