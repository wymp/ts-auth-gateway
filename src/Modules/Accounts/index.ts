import * as E from "@wymp/http-errors";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Parsers } from "@wymp/weenie-framework";
import { AppDeps } from "../../Types";
import { IoInterface } from "./Types";
import * as Organizations from "./Organizations";
import * as Users from "./Users";

const parseBody = ((): SimpleHttpServerMiddleware => {
  // Create a function for generating an error
  const generateError = (contentType?: string): Error => {
    return new E.UnsupportedMediaType(
      `Your request must have a 'Content-Type' header with value 'application/json'.${
        contentType ? ` You passed ${contentType}.` : ``
      }`
    );
  };

  const json = Parsers.json();

  return (req, res, next) => {
    // Validate that we've _passed_ a content type
    const contentType = req.get("content-type");
    if (!contentType) {
      return next(generateError());
    }

    // Use the parser to parse the body
    json(req, res, (e?: any) => {
      if (e) {
        return next(e);
      } else {
        // Now if there's supposed to be a body, check that we see one
        if (
          ["post", "patch", "put"].includes(req.method.toLowerCase()) &&
          (!req.body || Object.keys(req.body).length === 0)
        ) {
          return next(
            new E.BadRequest(
              "The body of your request is blank or does not appear to have been parsed correctly. " +
                "Please be sure to pass a content-type header specifying the content type of your body. " +
                (contentType
                  ? `You passed 'Content-Type: ${contentType}'.`
                  : `You did not pass a content-type header.`)
            )
          );
        }
      }
      next();
    });
  };
})();

export const register = (
  r: Pick<AppDeps, "http" | "log" | "io" | "authz" | "config" | "emailer"> & { io: IoInterface }
) => {
  r.log.notice(`Registering Accounts Module`);

  // Selectively parse JSON and check for blank bodies
  r.http.use((req, res, next) => {
    if (["post", "patch", "put"].includes(req.method.toLowerCase())) {
    }
    next();
  });

  r.log.notice(`HTTP: GET    /accounts/v1/organizations(/:id)`);
  r.http.get(
    ["/accounts/v1/organizations", "/accounts/v1/organizations/:id"],
    Organizations.getOrganizations(r)
  );
  r.log.notice(`HTTP: POST   /accounts/v1/organizations`);
  r.http.post("/accounts/v1/organizations", [parseBody, Organizations.postOrganizations(r)]);

  r.log.notice(`HTTP: GET    /accounts/v1/users`);
  r.http.get(`/accounts/v1/users`, Users.getUsers(r));
  r.log.notice(`HTTP: GET    /accounts/v1/users/:id`);
  r.http.get(`/accounts/v1/users/:id`, Users.getUserById(r));
  r.log.notice(`HTTP: POST   /accounts/v1/users`);
  r.http.post(`/accounts/v1/users`, [parseBody, Users.postUsers(r)]);

  // Catch-all for unhandled accounts endpoints
  r.log.notice(`HTTP: ALL    /accounts/v1/*`);
  r.http.all(`/accounts/v1/*`, (req, res, next) => {
    next(
      new E.BadRequest(`Unknown Endpoint: ${req.method} ${req.path}`, `ACCOUNTS-UNKNOWN-ENDPOINT`)
    );
  });
};
