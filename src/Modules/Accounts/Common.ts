import * as E from "@wymp/http-errors";
import { SimpleLoggerInterface } from "@wymp/ts-simple-interfaces";
import { Auth } from "@wymp/types";
import { ClientRoles } from "../../Types";

export function assertAuth(auth: Auth.ReqInfo): asserts auth is Auth.ReqInfoString {
  if (auth.t !== 0) {
    throw new E.InternalServerError(
      `Bad configuration: auth object is bitwise-type, but should be string-type`,
      `BAD-AUTH-OBJECT-ROLE-TYPE`
    );
  }
}

export const isInternalSystemClient = (
  roles: Array<string>,
  authenticated: boolean,
  log: SimpleLoggerInterface
): boolean => {
  let proceed: boolean = false;
  log.info(`Checking for internal, authenticated system client`);
  if (roles.includes(ClientRoles.SYSTEM) && roles.includes(ClientRoles.INTERNAL)) {
    log.info(`Client IS an internal system client. Checking authenticity.`);
    if (!authenticated) {
      log.notice(`Client is not authenticated; cannot proceed`);
    } else {
      log.notice(`Client is authenticated and authorized. Proceeding.`);
      proceed = true;
    }
  } else {
    log.notice(
      `Client IS NOT an internal system client. Client does not have sufficient roles for this ` +
        `operation.`
    );
  }
  return proceed;
};
