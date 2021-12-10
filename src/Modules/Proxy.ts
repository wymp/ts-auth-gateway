import * as fs from "fs";
import * as jwt from "jsonwebtoken";
import * as E from "@wymp/http-errors";
import * as Http from "@wymp/http-utils";
import { AppDeps } from "../Types";

/**
 * A very minimal IO interface to help better scope the dependnecies in this module.
 */
export type ProxyIoInterface = Pick<AppDeps["io"], "getApiConfig">;

type MinReq = {
  method: string;
  path: string;
  url: string;
  get(h: string): string | undefined;
  connection?: {
    remoteAddress?: string;
  };
};

/**
 * Use the passed in application dependencies to create a proxying middleware and then register that
 * middleware against the given HTTP request handler.
 */
export const register = (
  r: Pick<AppDeps, "http" | "config" | "log" | "proxy"> & { io: ProxyIoInterface }
) => {
  r.log.notice(`Adding proxy middleware`);
  r.http.use(getProxyMiddleware(r));
};

/**
 * Takes a set of dependnecies and uses them to create and return a middleware function that
 * forwards requests to the destination specified by the request's API configuration (from the
 * database). The forwarded request strips out the Authorization header and inserts a new header
 * containing full authentication information.
 *
 * Depending on configuration, the header may be signed to improve system security.
 *
 * Note that this middleware can be used with Express, but it is also compatible with
 * `SimpleHttpRequestHandlerInterface` from [`@wymp/ts-simple-interfaces`](https://github.com/wymp/ts-simple-interfaces).
 */
export const getProxyMiddleware = (
  r: Pick<AppDeps, "log" | "proxy"> & {
    io: ProxyIoInterface;
    config: {
      serviceName: string;
      authHeader: AppDeps["config"]["authHeader"];
    };
  }
) => {
  // Make sure we have a valid ECDSA key and prepare it
  const ecdsakey = (() => {
    let key: string | null = null;
    const config = r.config.authHeader;
    if (config.sign) {
      const ecdsaConf = config.ecdsaKey;
      if (ecdsaConf.t === "file") {
        const path = ecdsaConf.path;
        if (!fs.existsSync(path)) {
          throw new E.InternalServerError(
            `ECDSA key file not found at '${path}'! Please place a standard ECDSA pem file at ` +
              `that path.`
          );
        }
        key = fs.readFileSync(path, "utf8");
      } else {
        key = process.env[ecdsaConf.varname] || null;
        if (!key) {
          throw new E.InternalServerError(
            `Environment variable '${ecdsaConf.varname}' empty. Please set this variable to ` +
              `your PEM-encoded ECDSA signing key or change your config.`
          );
        }
      }

      // Test the key
      try {
        jwt.sign({ testing: "1-2" }, key, {
          algorithm: "ES256",
          audience: "example.com",
          expiresIn: 30,
          issuer: r.config.serviceName,
        });
      } catch (e) {
        throw new E.InternalServerError(
          `Something is wrong with your ECDSA key (failed to sign test payload): ${e.message}`
        );
      }
    }

    return key;
  })();

  // Now return the handler
  return async (req: MinReq, res: { locals: any }, next: (e?: Error) => unknown) => {
    const log = Http.logger(r.log, req, res);
    log.info(`Attempting to proxy request according to requested API and version`);

    const pathParts = req.path.split("/");
    const api = pathParts[1];
    const version = pathParts[2];

    try {
      // Our gateway logic should have added authn/z information to the request. Assert that
      if (!Http.isAuthdReq(req)) {
        throw new E.InternalServerError(
          `Cannot proxy requests that have not gone through the Auth Gateway middleware. (This ` +
            `request lacks a valid 'auth' parameter.)`
        );
      }

      // Get all available versions of the requested API
      const targetConfig = await r.io.getApiConfig(api, version, log);
      const target = targetConfig.url;

      // Need to manipulate headers on the request object (this is not normal, so using "any" casts
      // to do it)

      // First, make sure the 'headers' property exists
      const _req: any = req;
      if (!_req.headers) {
        _req.headers = {};
      }

      // Now remove the authorization header
      delete _req.headers.authorization;

      // Create a new auth header
      const algorithm: jwt.Algorithm = "ES256";
      const authHeader = ecdsakey
        ? // If we're configured to sign it, make it a JWT
          jwt.sign(req.auth, ecdsakey, {
            algorithm,
            audience: target,
            expiresIn: 30,
            issuer: r.config.serviceName,
          })
        : // Otherwise, just base64 the JSON representation
          Buffer.from(JSON.stringify(req.auth)).toString("base64");

      // And add the auth header
      _req.headers[`${r.config.authHeader.headerName}-signed`] = String(Number(!!ecdsakey));
      _req.headers[`${r.config.authHeader.headerName}-algorithm`] = algorithm;
      _req.headers[r.config.authHeader.headerName] = authHeader;

      // Since proxying is a weird use-case for our Simple Request and Response objects, we're
      // casting to "any" here.
      log.notice(`Passing request for ${req.url} on to target: ${target}`);
      r.proxy.web(<any>req, <any>res, { target }, function (err, errReq, errRes, targetUrl) {
        next(
          new E.ServiceUnavailable(
            `Sorry, the ${api} API is currently not responding. Please try again later.`
          )
        );
      });
      log.info("Request sent to destination.");
    } catch (e) {
      next(e);
    }
  };
};
