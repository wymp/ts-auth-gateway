import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import * as rt from "runtypes";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Auth } from "@wymp/types";
import * as E from "@wymp/http-errors";
import * as Http from "@wymp/http-utils";
import * as T from "../../Translators";
import { AppDeps, ClientRoles, UserRoles } from "../../Types";
import * as Common from "./Common";
import { authorizeCallerForRole } from "./OrgMemberships";

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
  r: Pick<AppDeps, "log" | "io">
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
      await r.io.getOrganizationById(organizationId, log, true);

      // Possibly get client id
      const clientId = req.params.id;

      // Authorize
      await authorizeCallerForRole(organizationId, auth, "read", r);

      if (clientId) {
        // Sending a singular response
        const client = await r.io.getClientById(clientId, log, true);
        if (client.organizationId !== organizationId || client.deletedMs !== null) {
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
        const clients = await r.io.getClients(
          { _t: "filter", organizationId, deleted: false },
          log
        );
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
 * POST /organizations/:id/clients
 */
export const postClientHandler = (
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
          `POST-CLIENTS-BAD-PARAMS`
        );
      }

      // Validate input
      const validation = PostClientValidator.validate(req.body);
      Common.throwOnInvalidBody(validation);
      const clientData = validation.value.data;

      // Make sure org exists
      await r.io.getOrganizationById(organizationId, log, true);

      // Authorize
      await authorizeCallerForRole(organizationId, auth, "manage", r);

      // Only allow reqsPerSec parameter if caller is sysadmin or employee
      if (clientData.reqsPerSec !== undefined) {
        try {
          Http.authorize(req, r.authz["POST /organizations/:id/clients"], log);
        } catch (e) {
          // The native error isn't exactly what we want to convey, so wrap it in language that's
          // more appropriate
          throw new E.BadRequest(
            `You are not authorized to set the 'reqsPerSec' field.`,
            `POST-CLIENTS_UNAUTHORIZED-FIELD`
          );
        }
      }

      // Create a new client
      const client = await createClient(
        { organizationId, name: clientData.name, reqsPerSec: clientData.reqsPerSec || 10 },
        auth,
        { ...r, log }
      );

      const finishedClient = await addRoles(T.Clients.dbToApi(client, log), { ...r, log });

      const response: Auth.Api.Responses<
        ClientRoles,
        UserRoles
      >["POST /organizations/:id/clients"] = {
        t: "single",
        data: { ...finishedClient, secret: client.secret },
      };
      res.status(201).send(response);
    } catch (e) {
      next(e);
    }
  };
};

const PostClientValidator = rt.Record({
  data: rt.Record({
    type: rt.Literal("clients"),
    name: rt.String,
    reqsPerSec: rt.Optional(rt.Number),
  }),
});

export const createClient = async (
  newClient: { organizationId: string; name: string; reqsPerSec?: number },
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "io" | "log">
): Promise<Auth.Db.Client & { secret: string }> => {
  // Create and hash a secret for this client
  r.log.debug(`Generating client secret`);
  const secret = randomBytes(32).toString("hex");
  const secretBcrypt = await bcrypt.hash(secret, 10);

  // Store client
  const client = await r.io.saveClient({ ...newClient, secretBcrypt, reqsPerSec: 10 }, auth, r.log);

  // Add basic roles
  await r.io.saveClientRole({ clientId: client.id, roleId: ClientRoles.EXTERNAL }, auth, r.log);

  // Return everything
  return { ...client, secret };
};

/**
 * PATCH /organizations/:id/clients/:id
 */
export const patchClientHandler = (
  r: Pick<AppDeps, "log" | "io" | "authz">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      // Make sure it's an authd request so we can access the auth object
      Http.assertAuthdReq(req);
      const auth = req.auth;
      Common.assertAuth(auth);

      // Get organization and client ids from params and verify
      const organizationId = req.params.orgId;
      const clientId = req.params.id;
      if (!organizationId || !clientId) {
        throw new E.InternalServerError(
          `Programmer: This endpoint is not set up correctly. Expecting 'orgId' and 'clientId' ` +
            `url parameters, but one or both were missing.`,
          `PATCH-CLIENTS-BAD-PARAMS`
        );
      }

      // Validate input
      const validation = PatchClientValidator.validate(req.body);
      Common.throwOnInvalidBody(validation);
      const clientData = validation.value.data;

      // Make sure org and client exist
      await r.io.getOrganizationById(organizationId, log, true);
      const existing = await r.io.getClientById(clientId, log, true);

      // Authorize
      await authorizeCallerForRole(organizationId, auth, "manage", r);

      // Make sure the client belongs to the org
      if (existing.organizationId !== organizationId) {
        throw new E.BadRequest(
          `The given client is not owned by the given organization. Please use the correct ids.`,
          `PATCH-CLIENT_ID-MISMATCH`
        );
      }

      // Only allow reqsPerSec parameter if caller is sysadmin or employee
      if (clientData.reqsPerSec !== undefined) {
        try {
          Http.authorize(req, r.authz["PATCH /organizations/:id/clients/:id"], log);
        } catch (e) {
          // The native error isn't exactly what we want to convey, so wrap it in language that's
          // more appropriate
          throw new E.BadRequest(
            `You are not authorized to set the 'reqsPerSec' field.`,
            `PATCH-CLIENTS_UNAUTHORIZED-FIELD`
          );
        }
      }

      // Update client if necessary
      let client: Auth.Db.Client;
      if ((!clientData.name || !clientData.name.trim()) && clientData.reqsPerSec === undefined) {
        client = existing;
      } else {
        // Update the client
        client = await r.io.updateClient(
          clientId,
          {
            ...(clientData.name?.trim() ? { name: clientData.name.trim() } : {}),
            ...(clientData.reqsPerSec !== undefined ? { reqsPerSec: clientData.reqsPerSec } : {}),
          },
          auth,
          log
        );
      }

      const response: Auth.Api.Responses<
        ClientRoles,
        UserRoles
      >["PATCH /organizations/:id/clients/:id"] = {
        t: "single",
        data: await addRoles(T.Clients.dbToApi(client, log), { ...r, log }),
      };
      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

const PatchClientValidator = rt.Record({
  data: rt.Record({
    type: rt.Literal("clients"),
    name: rt.Optional(rt.String),
    reqsPerSec: rt.Optional(rt.Number),
  }),
});

/**
 * DELETE /organizations/:id/clients/:id
 */
export const deleteClientHandler = (
  r: Pick<AppDeps, "log" | "io" | "authz">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      // Make sure it's an authd request so we can access the auth object
      Http.assertAuthdReq(req);
      const auth = req.auth;
      Common.assertAuth(auth);

      // Get organization and client ids from params and verify
      const organizationId = req.params.orgId;
      const clientId = req.params.id;
      if (!organizationId || !clientId) {
        throw new E.InternalServerError(
          `Programmer: This endpoint is not set up correctly. Expecting 'orgId' and 'clientId' ` +
            `url parameters, but one or both were missing.`,
          `PATCH-CLIENTS-BAD-PARAMS`
        );
      }

      // Make sure org and client exist
      await r.io.getOrganizationById(organizationId, log, true);
      const existing = await r.io.getClientById(clientId, log, true);

      // Authorize
      await authorizeCallerForRole(organizationId, auth, "manage", r);

      // Make sure the client belongs to the org and is not already deleted
      if (existing.organizationId !== organizationId || existing.deletedMs !== null) {
        throw new E.BadRequest(
          `The given client is not owned by the given organization. Please use the correct ids.`,
          `PATCH-CLIENT_ID-MISMATCH`
        );
      }

      // Mark client deleted
      await r.io.updateClient(clientId, { deletedMs: Date.now() }, auth, log);

      const response: Auth.Api.Responses<
        ClientRoles,
        UserRoles
      >["DELETE /organizations/:id/clients/:id"] = { data: null };
      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

/**
 * POST /organizations/:id/clients/:id/refresh-secret
 */
export const refreshSecretHandler = (
  r: Pick<AppDeps, "log" | "io" | "authz">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      // Make sure it's an authd request so we can access the auth object
      Http.assertAuthdReq(req);
      const auth = req.auth;
      Common.assertAuth(auth);

      // Get organization and client ids from params and verify
      const organizationId = req.params.orgId;
      const clientId = req.params.id;
      if (!organizationId || !clientId) {
        throw new E.InternalServerError(
          `Programmer: This endpoint is not set up correctly. Expecting 'orgId' and 'clientId' ` +
            `url parameters, but one or both were missing.`,
          `PATCH-CLIENTS-BAD-PARAMS`
        );
      }

      // Make sure org and client exist
      await r.io.getOrganizationById(organizationId, log, true);
      const existing = await r.io.getClientById(clientId, log, true);

      // Authorize
      await authorizeCallerForRole(organizationId, auth, "manage", r);

      // Make sure the client belongs to the org and is not already deleted
      if (existing.organizationId !== organizationId || existing.deletedMs !== null) {
        throw new E.BadRequest(
          `The given client is not owned by the given organization. Please use the correct ids.`,
          `REFRESH-CLIENT-SECRET_ID-MISMATCH`
        );
      }

      // Generate new secret and save
      r.log.debug(`Generating new client secret`);
      const secret = randomBytes(32).toString("hex");
      const secretBcrypt = await bcrypt.hash(secret, 10);
      const client = await r.io.updateClient(clientId, { secretBcrypt }, auth, log);

      const finishedClient = await addRoles(T.Clients.dbToApi(client, log), { ...r, log });

      const response: Auth.Api.Responses<
        ClientRoles,
        UserRoles
      >["POST /organizations/:id/clients/:id/refresh-secret"] = {
        t: "single",
        data: { ...finishedClient, secret },
      };
      res.status(200).send(response);
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
  const roles = await r.io.getClientRoles({ _t: "filter", clientIdIn: clientIds }, r.log);

  const add = (client: Auth.Api.Client<ClientRoles>): Auth.Api.Client<ClientRoles> => {
    client.roles = roles.data.filter((row) => row.clientId === client.id).map((row) => row.roleId);
    return client;
  };

  return Array.isArray(clientOrClients) ? clientOrClients.map(add) : add(clientOrClients);
};
