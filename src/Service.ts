import * as E from "@openfinanceio/http-errors";
import { Cors, Gateway, Proxy } from "./Modules";
import { AppDeps } from "./Types";

export const start = (r: AppDeps) => {
  // Add CORS handling for all requests
  r.log.notice(`Adding CORS middleware for all requests`);
  r.http.use(Cors.handler(r));

  // Add handler for enforcing path format. This would ordinarily be a fall-through handler, but
  // other logic depends on this enforcement happening up front.
  r.log.notice(`Adding route format enforcement`);
  r.http.use((req, res, next) => {
    if (req.path.match(new RegExp("^/[^/]+/v[0-9]+"))) {
      return next();
    }
    next(
      new E.BadRequest(
        "You must specify an API and version for your request, e.g., `/accounts/v1/...`"
      )
    );
  });

  // Run primary gateway middleware for all requests
  r.log.notice(`Adding Gateway middleware for all requests`);
  r.http.use(Gateway.middleware(r));

  // Now that we have CORS headers and we've passed the gateway, we can route accordingly
  //Accounts.register(r);
  Proxy.register(r);
};
