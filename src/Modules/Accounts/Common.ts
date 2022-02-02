import * as rt from "runtypes";
import * as E from "@wymp/http-errors";
import { SimpleLoggerInterface } from "@wymp/ts-simple-interfaces";
import { Auth } from "@wymp/types";
import { ClientRoles, UserRoles } from "../../Types";

export function assertAuth(auth: Auth.ReqInfo): asserts auth is Auth.ReqInfoString {
  if (auth.t !== 0) {
    throw new E.InternalServerError(
      `Bad configuration: auth object is bitwise-type, but should be string-type`,
      `BAD-AUTH-OBJECT-ROLE-TYPE`
    );
  }
}

/**
 * Check to see if the client being used to make this call is an authenticated internal system client
 */
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
      log.notice(`Client is an authenticated and authorized. Proceeding.`);
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

/**
 * Check to see if the calling user is the owner of the given resource or is a member of a
 * privileged group.
 */
export const callerIsOwnerOrPrivilegedUser = (
  ownerId: string,
  auth: Auth.ReqInfoString,
  _privilegedRoles: Array<string> | null | undefined,
  log: SimpleLoggerInterface
): boolean => {
  // Default to sysadmin and employee
  const privilegedRoles = _privilegedRoles || [UserRoles.SYSADMIN, UserRoles.EMPLOYEE];

  let proceed: boolean = false;
  if (auth.u) {
    log.info(`Request made with user session attached. Checking permissions.`);
    if (auth.u.id === ownerId) {
      log.notice(`Resource owned by calling user. Proceeding with operation.`);
      proceed = true;
    } else {
      log.info(`Resource not owned by calling user. Checking caller permissions.`);
      if (auth.u.r.find((role) => privilegedRoles.includes(role))) {
        log.notice(`Calling user is sufficiently privileged. Proceeding.`);
        proceed = true;
      } else {
        log.notice(`Calling user is not sufficiently privileged. Not proceeding.`);
      }
    }
  }

  return proceed;
};

/**
 * Convert a runtypes error into a standard BadRequest error
 */
export function throwOnInvalidBody<T>(
  val: rt.Result<T>,
  errString: string = ""
): asserts val is rt.Success<T> {
  if (val.success === false) {
    errString =
      errString ||
      `The body of your request does not appear to conform to the documented input for this ` +
        `endpoint. Please read the docs. Error: ${val.message}.`;
    if (val.details) {
      errString += " Details:\n";
      const addDetails = (k: string, v: string | rt.Details) => {
        if (typeof v === "string") {
          errString += `\n* ${k}: ${v}`;
        } else {
          for (const newKey in v) {
            addDetails(`${k}.${newKey}`, v[newKey]);
          }
        }
      };
      for (const k in val.details) {
        addDetails(k, val.details[k]);
      }
    }
    throw new E.BadRequest(errString, "BAD-BODY");
  }
}
