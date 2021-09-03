import { Auth } from "@wymp/types";
import * as E from "@wymp/http-errors";
import * as CidrMatcher from "cidr-matcher";
import * as bcrypt from "bcryptjs";
import { AppDeps, RateLimiterInterface } from "../../Types";

/**
 * Parse and process credentials from request.
 */
export const parseAuthFromRequest = (authHeader: string | undefined, log: AppDeps["log"]) => {
  log.info("Parsing request credentials");
  let clientId: string | null = null;
  let secret: string | null = null;
  let bearerToken: string | null = null;

  // If no header passed, short-circuit
  if (!authHeader || !authHeader.match(/\bBasic\b/)) {
    return { clientId, secret, bearerToken };
  }

  const auths = authHeader.split(/, */g);
  for (let authLine of auths) {
    const info = authLine.split(/ /);
    log.debug(`Parsing auth for scheme ${info[0]}`);
    if (info[0].toLowerCase() === "basic") {
      const decoded = new Buffer(info[1], "base64").toString("utf8").split(/:/);
      if (decoded[0] !== "") {
        log.debug("Found Client");
        clientId = decoded[0];
        if (decoded.length > 1 && decoded[1].trim().length > 0) {
          log.debug("Found Secret");
          secret = decoded[1];
        }
      }
    } else if (info[0].toLowerCase() === "bearer") {
      log.debug("Found bearer token");
      bearerToken = info[1];
    }
  }

  return { clientId, secret, bearerToken };
};

/**
 * Authenticate the passed in credentials against what's in the database
 */
export const authenticateCredentials = async (
  secret: string | null,
  secretBcrypt: string,
  r: Pick<AppDeps, "log" | "cache">
): Promise<boolean> => {
  let authenticated: boolean = false;
  if (secret !== null) {
    const key = `${secret}:${secretBcrypt}`;
    authenticated = await r.cache.get<boolean>(
      key,
      async () => {
        try {
          return await bcrypt.compare(secret, secretBcrypt);
        } catch (e) {
          r.log.error(
            "Found a malformed apikey/secret hash in database: " +
              secretBcrypt +
              "; Message: " +
              e.message
          );
          return false;
        }
      },
      300000
    );
    if (!authenticated) {
      throw new E.Unauthorized(
        "While your Client ID appears to be valid, the secret you've passed is not. Please check " +
          "your credentials."
      );
    }
  }
  return authenticated;
};

/**
 * Enforce access restrictions for the given Client as defined in the database
 */
export const enforceAccessRestrictions = (
  restrictionsData: Array<Auth.Db.ClientAccessRestriction>,
  ip: string,
  host: string,
  api: string,
  log: AppDeps["log"]
) => {
  const accessRestrictions: { [k in Auth.ClientAccessRestrictionTypes]: Array<string> } = {
    ip: [],
    host: [],
    api: [],
  };

  // Restructure restriction data into something more usable
  for (let record of restrictionsData) {
    accessRestrictions[record.type].push(record.value);
  }

  // If we've got any restrictions....
  if (
    accessRestrictions.ip.length > 0 ||
    accessRestrictions.host.length > 0 ||
    accessRestrictions.api.length > 0
  ) {
    // If we've got ip restrictions, enforce them using CIDR notation
    if (accessRestrictions.ip.length > 0) {
      const matcher = new CidrMatcher(
        accessRestrictions.ip.map((v) => {
          // Enforce CIDR notation
          if (v.match(/\/[0-9]{1,2}$/)) {
            return v;
          } else {
            return `${v}/32`;
          }
        })
      );
      if (!matcher.contains(ip)) {
        throw new E.Unauthorized(
          `This client does not allow access from ip '${ip}'.`,
          "ACCESS-RESCTRICTION-IP"
        );
      }
    }

    // If we've got host restrictions, enforce those.
    if (accessRestrictions.host.length > 0) {
      let passed = false;
      for (let allowed of accessRestrictions.host) {
        log.debug(`Checking '${host}' against '${allowed}'`);
        if (host === allowed) {
          log.debug(`MATCHED`);
          passed = true;
          break;
        }
      }
      if (!passed) {
        throw new E.Unauthorized(
          `This client does not allow access from host '${host}'.`,
          "ACCESS-RESCTRICTION-HOST"
        );
      }
    }

    // If we've got API restrictions, enforce those.
    if (accessRestrictions.api.length > 0) {
      let passed = false;
      for (let allowed of accessRestrictions.api) {
        if (api === allowed) {
          passed = true;
          break;
        }
      }
      if (!passed) {
        throw new E.Forbidden(
          `You have not been given access to the ${api} API. Please contact partner support to ` +
            `obtain access to this API.`,
          "ACCESS-RESCTRICTION-API"
        );
      }
    } else {
      log.info(`No API access restrictions defined.`);
    }

    log.info(`Passed all applicable access restrictions. Allowing request.`);
  } else {
    log.info(`No access restrictions defined for this client. Allowing request.`);
  }
};

/**
 * Enforce rate-limiting for the given api key as defined in the database
 */
export const enforceRateLimiting = async (
  clientData: { id: string; reqsPerSec: number },
  r: { log: AppDeps["log"]; rateLimiter: RateLimiterInterface }
) => {
  if (clientData.reqsPerSec > -1) {
    r.log.info(
      `Enforcing rate-limiting: ${clientData.reqsPerSec} requests per second for client ` +
        clientData.id
    );
    try {
      // Set rate-limiter points per api key (have to hack it a little)
      (r.rateLimiter as any)._points = clientData.reqsPerSec;
      const limiterRes = await r.rateLimiter.consume(clientData.id.replace(".", "-"));
      r.log.info(
        `Rate-limiting passed: ${limiterRes.remainingPoints} remaining; ` +
          `${limiterRes.consumedPoints} consumed.`
      );

      // Rate-limiter rejects promise with its response object
    } catch (rateLimiterRes) {
      if (typeof rateLimiterRes.msBeforeNext === "undefined") {
        throw rateLimiterRes;
      } else {
        throw new E.TooManyRequests(
          `Your client is configured to allow ${clientData.reqsPerSec} requests per second, ` +
            `which you have now exceeded. Please wait before making more requests.`
        );
      }
    }
  } else {
    r.log.notice(`Rate-limiting disabled for this client.`);
  }
};

/**
 * Validate Session
 *
 * The user is giving us a raw session token. We need to sha256 hash that and see if we can find
 * a match in the database. If there is a match, we need to make sure it's still valid. Assuming
 * everything checks out, we'll return the user information associated with the session.
 *
 * Note that we're caching several parts of this operation to better manage resources.
 */
export const validateSession = async (
  rawSessionToken: string,
  io: AppDeps["io"],
  log: AppDeps["log"]
): Promise<Auth.ReqInfo["u"]> => {
  log.info("Session token has been passed.");

  // Get and validate session
  const session = await io.getSessionByToken(rawSessionToken, log);
  if (!session) {
    throw new E.Unauthorized(`Invalid session: token not found`);
  }
  if (session.token.type === "refresh") {
    throw new E.BadRequest(
      `You've passed a refresh token, rather than a session token. The refresh token may only be ` +
        `used to obtain a new set of tokens - not to make requests. Please use a session token ` +
        `instead.`,
      `REFRESH-TOKEN-PASSED`
    );
  }
  if (session.expiresMs < Date.now()) {
    throw new E.Unauthorized(
      `Session expired at ${new Date(session.expiresMs)}. Obtain a new session by submitting a ` +
        `valid refresh token or by logging in again.`,
      `SESSION-EXPIRED`
    );
  }
  if (session.token.expiresMs < Date.now()) {
    throw new E.Unauthorized(
      `This session token expired at ${new Date(session.token.expiresMs)}. Obtain a new token by ` +
        `submitting a valid refresh token or by logging in again.`,
      `SESSION-TOKEN-EXPIRED`
    );
  }
  if (session.invalidatedMs !== null) {
    throw new E.Unauthorized(
      `Your session has been invalidated. Please log in again.`,
      `SESSION-INVALIDATED`
    );
  }

  // Now we know it's valid - get user information
  const roles = await io.get(
    "user-roles",
    { _t: "filter", userId: session.userId },
    { __pg: { size: 1000000 } },
    log
  );
  return {
    sid: session.id,
    id: session.userId,
    r: roles.data.map((r) => r.roleId),
    s: null,
  };
};
