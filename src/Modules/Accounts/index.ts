import * as E from "@wymp/http-errors";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Parsers } from "@wymp/weenie-framework";
import { AppDeps } from "../../Types";
import { IoInterface } from "./Types";
import * as Organizations from "./Organizations";
import * as Users from "./Users";
import * as Sessions from "./Sessions";

const json = Parsers.json();
const parseBody = ((): SimpleHttpServerMiddleware => {
  return (req, res, next) => {
    // Validate that we've passed a content type and that it's correct
    const contentType = req.get("content-type");
    if (!contentType || contentType.toLowerCase() !== "application/json") {
      return next(
        new E.UnsupportedMediaType(
          `Your request must have a 'Content-Type' header with value 'application/json'.${
            contentType
              ? ` You passed '${contentType}'.`
              : `You did not pass a content-type header.`
          }`
        )
      );
    }

    // Use the parser to parse the body
    json(req, res, (e?: any) => {
      // If there was an error, return it
      if (e) {
        return next(e);
      } else {
        // Otherwise, if there's supposed to be a body, check that we see one
        if (!req.body || Object.keys(req.body).length === 0) {
          return next(
            new E.BadRequest(
              "The body of your request is blank or does not appear to have been parsed correctly. " +
                "Please be sure to pass a content-type header with the value 'application/json'. " +
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

  // Organizations
  r.log.notice(`HTTP: GET    /accounts/v1/organizations(/:id)`);
  r.http.get(
    ["/accounts/v1/organizations", "/accounts/v1/organizations/:id"],
    Organizations.getOrganizations(r)
  );
  r.log.notice(`HTTP: POST   /accounts/v1/organizations`);
  r.http.post("/accounts/v1/organizations", [parseBody, Organizations.postOrganizations(r)]);

  // Users
  r.log.notice(`HTTP: GET    /accounts/v1/users`);
  r.http.get(`/accounts/v1/users`, Users.getUsers(r));
  r.log.notice(`HTTP: GET    /accounts/v1/users/:id`);
  r.http.get(`/accounts/v1/users/:id`, Users.getUserById(r));
  r.log.notice(`HTTP: POST   /accounts/v1/users`);
  r.http.post(`/accounts/v1/users`, [parseBody, Users.postUsers(r)]);

  // Sessions
  r.log.notice(`HTTP: GET    /accounts/v1/sessions`);
  r.http.get(`/accounts/v1/sessions`, Sessions.handleGetAllSessions(r));
  r.log.notice(`HTTP: GET    /accounts/v1/users/:id/sessions`);
  r.http.get(`/accounts/v1/users/:id/sessions`, Sessions.handleGetUserSessions(r));
  r.log.notice(`HTTP: POST   /accounts/v1/sessions/login/email`);
  r.http.post(`/accounts/v1/sessions/login/email`, [
    parseBody,
    Sessions.handlePostSessionsLoginEmail(r),
  ]);
  r.log.notice(`HTTP: POST   /accounts/v1/sessions/login/password`);
  r.http.post(`/accounts/v1/sessions/login/password`, [
    parseBody,
    Sessions.handlePostSessionsLoginPassword(r),
  ]);
  r.log.notice(`HTTP: POST   /accounts/v1/sessions/login/code`);
  r.http.post(`/accounts/v1/sessions/login/code`, [
    parseBody,
    Sessions.handlePostSessionsLoginCode(r),
  ]);
  r.log.notice(`HTTP: POST   /accounts/v1/sessions/login/totp`);
  r.http.post(`/accounts/v1/sessions/login/totp`, [
    parseBody,
    Sessions.handlePostSessionsLoginTotp(r),
  ]);
  r.log.notice(`HTTP: POST   /accounts/v1/sessions/refresh`);
  r.http.post(`/accounts/v1/sessions/refresh`, [parseBody, Sessions.handlePostSessionsRefresh(r)]);
  r.log.notice(`HTTP: POST   /accounts/v1/sessions/logout`);
  r.http.post(`/accounts/v1/sessions/logout`, [parseBody, Sessions.handlePostSessionsLogout(r)]);

  // Catch-all for unhandled accounts endpoints
  r.log.notice(`HTTP: Fallthrough handler for accounts module: ALL    /accounts/v1/*`);
  r.http.all(`/accounts/v1/*`, (req, res, next) => {
    next(
      new E.BadRequest(`Unknown Endpoint: ${req.method} ${req.path}`, `ACCOUNTS-UNKNOWN-ENDPOINT`)
    );
  });
};
