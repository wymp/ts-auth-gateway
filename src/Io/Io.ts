import { createHash /*randomBytes*/ } from "crypto";
import { SimpleSqlDbInterface, SimpleLoggerInterface } from "ts-simple-interfaces";
import { AbstractSql } from "@wymp/sql";
import { Auth } from "@wymp/types";
import * as E from "@wymp/http-errors";
import { CacheInterface } from "../Types";
import { TypeMap, Defaults } from "./Types";

/**
 * This class abstracts all io access into generalized or specific declarative method calls
 */
export class Io<ClientRoles extends string, UserRoles extends string> extends AbstractSql<
  TypeMap<ClientRoles, UserRoles>
> {
  protected defaults = Defaults;
  public constructor(protected db: SimpleSqlDbInterface, protected cache: CacheInterface) {
    super();
  }

  /**
   * Get config for the given api and version, throwing specific errors if not found
   */
  public async getApiConfig(
    domain: string,
    version: string,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.Api> {
    log.debug(`Getting config for API '/${domain}/${version}'`);
    return await this.cache.get<Auth.Db.Api>(
      `api-${domain}-${version}`,
      async () => {
        const { data: versions } = await this.get("apis", { _t: "filter", domain }, log);

        if (versions.length === 0) {
          throw new E.BadRequest(`API '${domain}' does not exist.`);
        }

        // Get the requested version of the API
        const config = versions.find((v) => v.version === version);
        if (!config) {
          throw new E.BadRequest(
            `API '${domain}' exists, but not in version '${version}'. Available versions are ${versions
              .map((v) => v.version)
              .join(", ")}.`
          );
        }

        return config;
      },
      undefined,
      log
    );
  }

  /**
   * Get and return Client data, throwing specific errors if not found
   */
  public async getAndValidateClientData(
    clientId: string | null,
    log: SimpleLoggerInterface
  ): Promise<Auth.Db.Client & { roles: Array<ClientRoles> }> {
    log.debug(`Getting and validating client id ${clientId}`);

    // If null, throw
    if (clientId === null) {
      throw new E.Forbidden(
        "You must pass a client id and (optional) secret via a standard Authorization header using " +
          "the 'Basic' scheme."
      );
    }

    return await this.cache.get<Auth.Db.Client & { roles: Array<ClientRoles> }>(
      `client-${clientId}`,
      async () => {
        // First get the Client
        const { rows } = await this.db.query<Auth.Db.Client>(
          "SELECT * FROM `clients` WHERE `id` = ?",
          [clientId]
        );

        // If nothing, throw
        if (rows.length === 0) {
          throw new E.Unauthorized(
            `The Client ID you passed ('${clientId}') is not known to our system.`
          );
        }

        // Now get this client's roles, attach and return
        const { rows: roles } = await this.db.query<{ roleId: ClientRoles }>(
          "SELECT `roleId` FROM `client-roles` WHERE `clientId` = ?",
          [clientId]
        );
        return { ...rows[0], roles: roles.map((r) => r.roleId) };
      },
      undefined,
      log
    );
  }

  /**
   * Get session from a raw session token passed in by a user
   */
  public async getSessionByToken(
    token: string | undefined | null,
    log: SimpleLoggerInterface
  ): Promise<(Auth.Db.Session & { tokenExpiresMs: number }) | undefined> {
    if (!token) {
      return undefined;
    }
    return this.cache.get<(Auth.Db.Session & { tokenExpiresMs: number }) | undefined>(
      `session-by-token-${token}`,
      async () => {
        // prettier-ignore
        const { rows } = await this.db.query<Auth.Db.Session & { tokenExpiresMs: number }>(
          "SELECT `s`.*, `t`.`expiresMs` as `tokenExpiresMs` " +
          "FROM `sessions` `s` JOIN `session-tokens` `t` ON (`s`.`id` = `t`.`sessionId`)" +
          "WHERE `tokenSha256` = ?",
          [ createHash("sha256").update(token).digest() ]
        );
        return rows[0];
      },

      // Clear out of cache after 20 minutes, since these tokens are only supposed to be 20-minute
      // tokens
      1200000,
      log
    );
  }
}
