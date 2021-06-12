/*
import * as rt from "runtypes";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Api, Auth } from "@wymp/types";
import * as E from "@wymp/http-errors";
import { Http } from "@wymp/http-utils";
import { AppDeps } from "../../Types";

const authorize: typeof Http["authorize"] = Http.authorize;

/**
 * This handler handles both GET /organizations and GET /organizations/:id. Permissinioning is the
 * same for both
 * /
export const getOrganizations = (r: Pick<AppDeps, "log" | "io" | "auth">): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      // Authorize
      authorize(req, r.authz["GET /organizations(/:id)"], log);

      if (req.params.id) {
        // GET /organizations/:id
        const response: Auth.Api.Responses["GET /organizations/:id"] = {
          t: "single",
          data: await r.io.get(
            "organizations",
            { id: req.params.id },
            log,
            true
          ),
        };
        return res.send(response);
      } else {
        // GET /organizations
        const orgs = await r.io.get(
          "organizations",
          log
        );
        const response: Auth.Api.Responses["GET /organizations"] = {
          t: "collection",
          data: orgs,
          meta: {
            pg: {
              size: orgs.length,
              nextCursor: null,
              prevCursor: null,
            }
          }
        };
        return res.send(response);
      }
    } catch (e) {
      return next(e);
    }
  };
};

// POST /organizations
export const postOrganizations = (r: Pick<AppDeps, "log" | "io">): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      // Authorize
      assertAuthdReq(req);
      authorize(
        req,
        [
          [Globals.ClientRoles.SYSTEM, true, null, null],
          [Globals.ClientRoles.INTERNAL, null, Globals.UserRoles.SYSADMIN, null],
          [Globals.ClientRoles.INTERNAL, null, Globals.UserRoles.CUSTSERV3, null],
          [Globals.ClientRoles.INTERNAL, null, Globals.UserRoles.CUSTSERVADMIN, null],
        ],
        log
      );

      // Validate
      const validation = PostOrganization.validate(req.body);
      if (!validation.success) {
        throw new E.BadRequest(
          `The body of your request does not appear to conform to the documented input for this ` +
            `endpoint. Please read the docs: https://docs.openfinance.io/system/v3/api.html.\n\n` +
            `Error: ${validation.key ? `${validation.key}: ` : ``}${validation.message}`
        );
      }
      const postOrganization = validation.value.data;

      // Hand back to the functions
      const newOrganization = await r.io.insertOrganization(
        { name: postOrganization.name },
        req.auth,
        r.log
      );

      const response: { data: Auth.Api.Organization } = {
        data: {
          id: newOrganization.id,
          type: "organizations",
          name: newOrganization.name,
          createdMs: newOrganization.createdMs,
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
*/
