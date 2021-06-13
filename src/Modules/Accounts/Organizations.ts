import * as rt from "runtypes";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Auth } from "@wymp/types";
import * as Http from "@wymp/http-utils";
import { AppDeps, UserRoles, ClientRoles } from "../../Types";
import { InvalidBodyError } from "../Lib";

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

// POST /organizations
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

// POST /organizations
const PostOrganization = rt.Record({
  data: rt.Record({
    type: rt.Literal("organizations"),
    name: rt.String,
  }),
});
