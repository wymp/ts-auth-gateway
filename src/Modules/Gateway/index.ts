import * as E from "@openfinanceio/http-errors";
import { logger } from "@wymp/http-utils";
import { Auth } from "@wymp/types";
import { AppDeps, ClientRoles } from "../../Types";
import * as lib from "./Lib";

export type GatewayMiddlewareIo = Pick<
  AppDeps["io"],
  | "getResource" 
  | "getApiConfig"
  | "getAndValidateClientData"
  | "getAccessRestrictionsForClient"
  | "getSessionByToken"
  | "getRolesForUser"
>;

type MinReq = {
  method: string;
  path: string;
  get(h: string): string | undefined;
  connection?: {
    remoteAddress?: string;
  }
}

export const middleware = (
  r: Pick<AppDeps, "config" | "log" | "cache" | "rateLimiter"> & { io: GatewayMiddlewareIo }
) => {
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
        const clientData = await r.io.getAndValidateClientData(clientId, log);
        clientRoles = clientData.roles;

        // Authenticate, if requested
        authenticated = await lib.authenticateCredentials(secret, clientData.secretBcrypt, {
          ...r,
          log,
        });

        // Validate request against access restrictions
        const { data: restrictions } = await r.io.getAccessRestrictionsForClient(
          clientId,
          null,
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
        const fullUser = await r.io.getResource<Auth.Db.User, "id">(
          "users",
          { t: "id", v: sessionUser.id },
          log,
          true
        );
        if (fullUser.banned === 1 || fullUser.deleted === 1) {
          throw new E.Forbidden(
            `Sorry, this account has been disabled.`,
            fullUser.deleted === 1 ? `USER-DELETED` : `USER-BANNED`
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
      next();
    } catch (e) {
      next(e);
    }
  };
};
