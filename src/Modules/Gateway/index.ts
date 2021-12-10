import * as E from "@wymp/http-errors";
import { logger } from "@wymp/http-utils";
import { Auth } from "@wymp/types";
import { AppDeps, ClientRoles } from "../../Types";
import * as lib from "./Lib";

type MinReq = {
  method: string;
  path: string;
  get(h: string): string | undefined;
  connection?: {
    remoteAddress?: string;
  };
};

/**
 * Takes a set of application dependencies and returns a middleware function that can be used to
 * verify whether a given request is formatted correctly and is properly authn/z'd. **This is the
 * core functionality of the Gateway portion of this library - it is mostly the reason this library
 * was built.**
 *
 * Note that this middleware can be used with Express, but it is also compatible with
 * `SimpleHttpRequestHandlerInterface` from [`@wymp/ts-simple-interfaces`](https://github.com/wymp/ts-simple-interfaces).
 */
export const middleware = (r: Pick<AppDeps, "config" | "log" | "cache" | "rateLimiter" | "io">) => {
  return async (req: MinReq, res: any, next: (e?: Error) => void) => {
    const log = logger(r.log, req, res);
    log.debug(`Running gateway logic`);

    const pathParts = req.path.split("/");
    const api = pathParts[1];
    const version = pathParts[2];

    try {
      // Aux request data
      const ip = req.get("x-forwarded-for")
        ? req.get("x-forwarded-for")!
        : (req as any)?.connection?.remoteAddress || "(unknown)";
      const host = req.get("origin") || "unknown";

      // Initialize request auth variables
      let clientRoles: Array<ClientRoles> = [];
      let sessionUser: Auth.ReqInfo["u"] | undefined = undefined;
      let authenticated = false;

      // Extract Client ID and secret
      const { clientId, secret, bearerToken } = lib.parseAuthFromRequest(
        req.get("authorization"),
        log
      );

      // Do this stuff only if they've passed a Client
      const rateLimiter = r.rateLimiter;
      if (clientId) {
        // Get Client data, throwing errors if not found
        log.debug(`Getting and validating client id ${clientId}`);

        // First get the Client
        const clientData = await r.io.get("clients", { id: clientId }, log, false);

        // If nothing (or deleted), throw
        if (!clientData || clientData.deletedMs !== null) {
          throw new E.Unauthorized(
            `The Client ID you passed ('${clientId}') is not known to our system.`
          );
        }

        // Now get this client's roles, attach and return
        clientRoles = (await r.io.get("client-roles", { _t: "filter", clientId }, log)).data.map(
          (row) => row.roleId
        );

        // Authenticate, if requested
        authenticated = await lib.authenticateCredentials(secret, clientData.secretBcrypt, {
          ...r,
          log,
        });

        // Validate request against access restrictions
        const { data: restrictions } = await r.io.get(
          "client-access-restrictions",
          { _t: "filter", clientId },
          { __pg: { size: 10000000 } },
          log
        );
        lib.enforceAccessRestrictions(restrictions, ip, host, api, log);

        // Enforce Rate-Limiting
        if (rateLimiter) {
          await lib.enforceRateLimiting(clientData, { ...r, rateLimiter, log });
        }
      } else {
        // If they didn't pass a clientId and we're not allowing unidentified requests, throw
        const targetConfig = await r.io.getApiConfig(api, version, log);
        if (typeof targetConfig === "string" || !targetConfig.allowUnidentifiedReqs) {
          throw new E.Unauthorized(
            "You must pass a ClientID and (optional) secret via a standard Authorization " +
              "header using the 'Basic' scheme.",
            "MISSING-BASIC-AUTH",
            undefined,
            { "WWW-Authenticate": "Basic realm=openfinance-apis" }
          );
        }

        // Otherwise, enforce rate-limiting
        if (rateLimiter) {
          log.warning(
            `Allowing unidentified access from ip ${ip}, but rate-limiting to one request per sec.`
          );
          await lib.enforceRateLimiting({ id: ip, reqsPerSec: 1 }, { ...r, rateLimiter, log });
        } else {
          log.warning(
            `Allowing unidentified access from ip ${ip}, but we have not been giving a rate ` +
              `limiter! THIS IS A RECIPE FOR A DDOS!`
          );
        }
      }

      // Validate bearer token, if passed
      if (bearerToken) {
        log.info(`Validating bearer token`);
        const tokenParts = bearerToken.split(":");
        if (tokenParts.length !== 2) {
          throw new E.BadRequest(
            `Your bearer token must be prefixed with a protocol. Available protocols include: ` +
              `'session:'`
          );
        } else if (tokenParts[0] === "session") {
          log.info(`Validating session token`);
          sessionUser = await lib.validateSession(tokenParts[1], r.io, log);
        } else {
          throw new E.BadRequest(
            `Invalid bearer token protocol. Valid protocols include: 'session:'`
          );
        }
      } else {
        log.info(`No bearer token found.`);
      }

      if (authenticated) {
        log.info("Request is successfully authenticated");
      } else {
        log.info("Request is NOT authenticated");
      }

      // Make sure the given user isn't banned or deleted
      if (sessionUser) {
        log.info(`User passed; ensuring they're not banned or deleted.`);
        const fullUser = await r.io.get("users", { id: sessionUser.id }, log, true);
        if (fullUser.bannedMs !== null || fullUser.deletedMs !== null) {
          throw new E.Forbidden(
            `Sorry, this account has been disabled.`,
            fullUser.deletedMs !== null ? `USER-DELETED` : `USER-BANNED`
          );
        }
      }

      // See if debugging is enabled
      const debug = req.get("x-debug-key") && req.get("x-debug-key") === r.config.debugKey;
      if (debug) {
        log.warning(`Debugging enabled for this request`);
      }

      // Now that everything is authn/z'd, add info to request and pass it on to the next handler
      const auth = <Auth.ReqInfo>{
        t: 0,
        c: clientId || ip,
        a: authenticated,
        r: clientRoles,
        d: debug,
        ip,
      };
      if (sessionUser) {
        log.info(`User info found for request. Attaching to auth object.`);
        auth.u = sessionUser;
      }
      (req as any).auth = auth;

      // Pass it on to the next middleware
      log.info(`Auth gateway passed. Moving on to next module.`);
      next();
    } catch (e) {
      next(e);
    }
  };
};
