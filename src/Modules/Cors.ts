import { logger } from "@wymp/http-utils";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { AppDeps } from "../Types";

/**
 * CORS Handler
 *
 * Handles details of the CORS protocol, including the preflight OPTIONS request,  on
 * a per-request basis. By default, allows GET requests with auth, content type and
 * accept headers.
 */

export const handler = (
  r: Pick<AppDeps, "log"> & { config: { allowCorsCookies?: undefined | null | boolean } }
): SimpleHttpServerMiddleware => {
  return (req, res, next) => {
    const log = logger(r.log, req, res);
    log.debug(`Adding CORS headers`);

    let supportedMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
    let supportedHeaders = ["Authorization", "Content-Type", "Accept"];

    res.set("Access-Control-Allow-Headers", supportedHeaders.join(","));
    res.set("Access-Control-Allow-Methods", supportedMethods.join(","));
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Max-Age", "2592000"); // Cache for a month
    if (r.config.allowCorsCookies === true) {
      res.set("Access-Control-Allow-Credentials", "true");
    }

    if (req.method.toLowerCase() === "options") {
      log.debug(`OPTIONS request. Returning 200.`);
      res.status(200).send();
    } else {
      log.debug(`${req.method} request. Passing on to next handler.`);
      next();
    }
  };
};
