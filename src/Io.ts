import { createHash /*randomBytes*/ } from "crypto";
import { SimpleSqlDbInterface, SimpleLoggerInterface, SqlValue } from "ts-simple-interfaces";
//import * as uuidv4 from "uuid";
import { Auth, CollectionParams, CollectionResult } from "@wymp/types";
import * as E from "@openfinanceio/http-errors";
import { CacheInterface } from "./Types";

/**
 * Export a trimmed down version of the class as an interface
 */
export type IoInterface<ClientRoles extends string, UserRoles extends string> = Omit<
  Io<ClientRoles, UserRoles>,
  "db" | "cache" | "sqlizeParams"
>;

/**
 * This class abstracts all io access into generalized or specific declarative method calls
 */
export class Io<ClientRoles extends string, UserRoles extends string> {
  public constructor(protected db: SimpleSqlDbInterface, protected cache: CacheInterface) {}

  /**
   *
   *
   *
   * Generic getters and other generic facilities
   *
   *
   *
   */

  public getResource<R extends { [k: string]: SqlValue }, K extends keyof R>(
    type: string,
    by: { t: K; v: R[K] },
    log: SimpleLoggerInterface,
    thrw: true
  ): Promise<R>;
  public getResource<R extends { [k: string]: SqlValue }, K extends keyof R>(
    type: string,
    by: { t: K; v: R[K] },
    log: SimpleLoggerInterface,
    thrw?: false
  ): Promise<R | undefined>;
  public getResource<R extends { [k: string]: SqlValue }, K extends keyof R>(
    type: string,
    by: { t: K; v: R[K] },
    log: SimpleLoggerInterface,
    thrw?: boolean
  ): Promise<R | undefined> {
    log.debug(`Getting ${type} by ${by.t}:${by.v} from database`);

    if (!by.v) {
      return Promise.resolve(undefined);
    }

    return this.cache.get<R>(`${type}-${by.t}:${by.v}`, async () => {
      const { rows } = await this.db.query<R>(
        "SELECT * FROM `" + type + "` WHERE `" + by.t + "` = ?",
        [by.v]
      );
      if (thrw && rows.length === 0) {
        throw new E.NotFound(`${type} ${by.t}:${by.v} not found`);
      }
      return rows[0];
    });
  }

  /**
   * Turns collection params (pagination and sort) into parameters that can be directly inserted
   * into a SQL query. Defaults to a page size of 25 if not otherwise specified.
   */
  protected sqlizeParams(
    params: null | CollectionParams,
    maxSize: number = 100
  ): { order: string; limit: string; pg: { size: number; num: number } } {
    if (!params || (!params.pg && !params.sort)) {
      return { order: "", limit: " LIMIT 25", pg: { size: 25, num: 1 } };
    }

    let order: string = "";
    let limit: string = "";
    let size: number = 25;
    let pgNum: number = 1;

    if (params.pg) {
      size = params.pg.size || 25;
      if (size > maxSize) {
        throw new E.BadRequest(`You've requested ${size} records, but the max size is ${maxSize}.`);
      }

      let offset: string = "";
      if (params.pg.cursor) {
        const e =
          `pg[cursor] must be a base64-encoded string of format 'num:[number]'. ` +
          `You passed ${JSON.stringify(params.pg.cursor)}`;
        if (typeof params.pg.cursor !== "string") {
          throw new E.BadRequest(e);
        }
        const cursor = Buffer.from(params.pg.cursor, "base64").toString("utf8").split(":");
        if (cursor[0] !== "num") {
          throw new E.BadRequest(e);
        }
        if (!cursor[1].match(/^[0-9]+$/)) {
          throw new E.BadRequest(e);
        }

        pgNum = Number(cursor[1]);
        if (pgNum < 1) {
          throw new E.BadRequest(`Page numbers start at 1`);
        }

        offset = ` OFFSET ${(pgNum - 1) * size}`;
      }

      limit = ` LIMIT ${size}${offset}`;
    }

    if (params.sort) {
      if (!params.sort.match(/^([+-]?[a-zA-Z0-9_]+,)*[+-]?[a-zA-Z0-9_]+$/)) {
        throw new E.BadRequest(
          `'sort' parameter may only contain valid column names prefixed by a + or -`
        );
      }

      const sortClauses = params.sort.split(",");
      const sortPieces: Array<string> = [];
      for (const clause of sortClauses) {
        if (clause.substr(0, 1) === "-") {
          sortPieces.push(`\`${clause.substr(1)}\` DESC`);
        } else {
          sortPieces.push(`\`${clause.replace(/^\+/, ``)}\` ASC`);
        }
      }
      order = ` ORDER BY ${sortPieces.join(", ")}`;
    }

    return {
      order,
      limit,
      pg: { size, num: pgNum },
    };
  }

  /**
   *
   *
   *
   *
   * Non-Generic Methods
   *
   *
   *
   *
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
        const { rows: versions } = await this.db.query<Auth.Db.Api>(
          "SELECT * FROM `apis` WHERE `domain` = ?",
          [domain]
        );

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
   * Get and return Client data, throwing errors if not found
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
   * Get Client access restrictions
   */
  public async getAccessRestrictionsForClient(
    clientId: string,
    params: null | CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<CollectionResult<Auth.Db.ClientAccessRestriction>> {
    log.debug(`Getting access restrictions for client ${clientId}`);
    const p = this.sqlizeParams(params);
    return this.cache.get<CollectionResult<Auth.Db.ClientAccessRestriction>>(
      `access-restrictions-for-client-${clientId}-${JSON.stringify(p)}`,
      async () => {
        const { rows } = await this.db.query<Auth.Db.ClientAccessRestriction>(
          "SELECT * FROM `client-access-restrictions` WHERE `clientId` = ?" + p.order + p.limit,
          [clientId]
        );
        return {
          data: rows,
          meta: {
            pg: {
              size: p.pg.size,
              nextCursor:
                rows.length < p.pg.size
                  ? null
                  : Buffer.from(`num:${p.pg.num + 1}`, `utf8`).toString(`base64`),
              prevCursor:
                p.pg.num === 1
                  ? null
                  : Buffer.from(`num:${p.pg.num - 1}`, `utf8`).toString(`base64`),
            },
          },
        };
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

  /**
   * Get User roles
   */
  public async getRolesForUser(
    userId: string,
    params: null | CollectionParams,
    log: SimpleLoggerInterface
  ): Promise<CollectionResult<Auth.Db.UserRole<UserRoles>>> {
    log.debug(`Getting roles for user ${userId}`);
    const p = this.sqlizeParams(params);
    return this.cache.get<CollectionResult<Auth.Db.UserRole<UserRoles>>>(
      `roles-for-user-${userId}-${JSON.stringify(p)}`,
      async () => {
        const { rows } = await this.db.query<Auth.Db.UserRole<UserRoles>>(
          "SELECT * FROM `user-roles` WHERE `userId` = ?" + p.order + p.limit,
          [userId]
        );
        return {
          data: rows,
          meta: {
            pg: {
              size: p.pg.size,
              nextCursor:
                rows.length < p.pg.size
                  ? null
                  : Buffer.from(`num:${p.pg.num + 1}`, `utf8`).toString(`base64`),
              prevCursor:
                p.pg.num === 1
                  ? null
                  : Buffer.from(`num:${p.pg.num - 1}`, `utf8`).toString(`base64`),
            },
          },
        };
      },
      undefined,
      log
    );
  }
}
