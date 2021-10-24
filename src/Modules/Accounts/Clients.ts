//import * as rt from "runtypes";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Auth } from "@wymp/types";
import * as E from "@wymp/http-errors";
import * as Http from "@wymp/http-utils";
import * as T from "../../Translators";
import { AppDeps, ClientRoles, UserRoles } from "../../Types";
import * as Common from "./Common";
import { authorizeCallerForRole } from "./OrgMemberships";
//import { InvalidBodyError } from "../Lib";

/**
 *
 *
 *
 *
 * Request handlers
 *
 *
 *
 *
 */

/** GET /organizations/:orgId/clients */
export const getClientsForOrgHandler = (
  r: Pick<AppDeps, "log" | "io" | "authz">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      // Make sure it's an authd request so we can access the auth object
      Http.assertAuthdReq(req);
      const auth = req.auth;
      Common.assertAuth(auth);

      // Get organization id from params and verify
      const organizationId = req.params.orgId;
      if (!organizationId) {
        throw new E.InternalServerError(
          `Programmer: This endpoint is not set up correctly. Expecting 'orgId' url parameter, ` +
            `but it was missing.`,
          `GET-CLIENTS-BAD-PARAMS`
        );
      }

      // Make sure org exists
      await r.io.get("organizations", { id: organizationId }, log, true);

      // Possibly get client id
      const clientId = req.params.id;

      // Authorize
      await authorizeCallerForRole(organizationId, auth, "read", r);

      if (clientId) {
        // Sending a singular response
        const client = await r.io.get("clients", { id: clientId }, log, true);
        if (client.organizationId !== organizationId) {
          throw new E.NotFound(
            `The client id you've requested was not found in our system.`,
            `GET-CLIENT_CLIENT-NOT-FOUND`
          );
        }
        const response: Auth.Api.Responses<
          ClientRoles,
          UserRoles
        >["GET /organizations/:id/clients/:id"] = {
          t: "single",
          data: await addRoles(T.Clients.dbToApi(client, log), { ...r, log }),
        };
        res.status(200).send(response);
      } else {
        // Get clients and send response
        const clients = await r.io.get("clients", { _t: "filter", organizationId }, log);
        const response: Auth.Api.Responses<
          ClientRoles,
          UserRoles
        >["GET /organizations/:id/clients"] = {
          ...clients,
          data: await addRoles(
            clients.data.map((row) => T.Clients.dbToApi(row, log)),
            { ...r, log }
          ),
        };
        res.status(200).send(response);
      }
    } catch (e) {
      next(e);
    }
  };
};

/**
 * Use the database to get one or more clients' roles and then add them to the corresponding client
 * record for return via the API.
 */
declare interface AddRoles {
  (client: Auth.Api.Client<ClientRoles>, r: Pick<AppDeps, "io" | "log">): Promise<
    Auth.Api.Client<ClientRoles>
  >;
  (clients: Array<Auth.Api.Client<ClientRoles>>, r: Pick<AppDeps, "io" | "log">): Promise<
    Array<Auth.Api.Client<ClientRoles>>
  >;
}
const addRoles: AddRoles = async (clientOrClients, r): Promise<any> => {
  const clientIds = Array.isArray(clientOrClients)
    ? clientOrClients.map((u) => u.id)
    : [clientOrClients.id];
  const roles = await r.io.get("client-roles", { _t: "filter", clientIdIn: clientIds }, r.log);

  const add = (client: Auth.Api.Client<ClientRoles>): Auth.Api.Client<ClientRoles> => {
    client.roles = roles.data.filter((row) => row.clientId === client.id).map((row) => row.roleId);
    return client;
  };

  return Array.isArray(clientOrClients) ? clientOrClients.map(add) : add(clientOrClients);
};
