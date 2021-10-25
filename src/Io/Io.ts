import { createHash /*randomBytes*/ } from "crypto";
import { SimpleSqlDbInterface, SimpleLoggerInterface } from "ts-simple-interfaces";
import { AbstractSql, Query } from "@wymp/sql";
import { Auth } from "@wymp/types";
import * as E from "@wymp/http-errors";
import { CacheInterface } from "../Types";
import { TypeMap, Defaults } from "./Types";

/**
 * Convenience definition
 */
type SessionAndToken = Auth.Db.Session & { token: Auth.Db.SessionToken };

/**
 * This class abstracts all io access into generalized or specific declarative method calls
 */
export class Io<ClientRoles extends string, UserRoles extends string> extends AbstractSql<
  TypeMap<ClientRoles, UserRoles>
> {
  protected defaults = Defaults;
  public constructor(protected db: SimpleSqlDbInterface, protected cache: CacheInterface) {
    super();
    this.primaryKeys["session-tokens"] = "tokenSha256";
    this.primaryKeys["verification-codes"] = "codeSha256";
    this.convertBuffersAndHex = false;
  }

  /**
   * Overriding default filter calculations for certain non-normal filters
   */
  protected getSqlForFilterField<T extends keyof TypeMap<ClientRoles, UserRoles>>(
    t: T,
    field: string,
    val: any
  ): Partial<Query> {
    if (t === "user-roles" && field === "userIdIn") {
      return { where: ["`userId` IN (?)"], params: [val] };
    }
    if (t === "client-roles" && field === "clientIdIn") {
      return { where: ["`clientId` IN (?)"], params: [val] };
    }
    if (t === "clients" && field === "deleted") {
      return { where: [val ? "`deletedMs` IS NOT NULL" : "`deletedMs` IS NULL"] };
    }
    if (t === "sessions" && field === "createdMs") {
      // Validate operator
      const ops = { lt: "<", gt: ">", eq: "=", lte: "<=", gte: ">=", ne: "!=" };
      const op: keyof typeof ops = val.op;
      if (!op || !ops[op]) {
        throw new E.InternalServerError(
          `Problem with filter value for filter sessions::createdMs - Missing or invalid 'op' ` +
            `field: '${op}'. Acceptable options are ${JSON.stringify(Object.keys(ops))}`
        );
      }

      // Validate timestamp
      const timestamp = val.val;
      if (typeof timestamp !== "number") {
        throw new E.InternalServerError(
          `Problem with filter value for filter sessions::createdMs - Missing or invalid ` +
            `'val' field: '${val.val}'. This field should be an integer timestamp in MS.`
        );
      }

      return { where: ["`createdMs` " + ops[op] + " ?"], params: [val.val] };
    }
    return super.getSqlForFilterField(t, field, val);
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
   * Get session from a raw session token passed in by a user
   */
  public async getSessionByToken(
    tokenStr: string | undefined | null,
    log: SimpleLoggerInterface
  ): Promise<SessionAndToken | undefined> {
    if (!tokenStr) {
      return undefined;
    }
    return this.cache.get<SessionAndToken | undefined>(
      `session-by-token-${tokenStr}`,
      async () => {
        const tokenSha256 = createHash("sha256").update(tokenStr).digest();

        const [{ rows: sessions }, token] = await Promise.all([
          this.db.query<Auth.Db.Session>(
            "SELECT `s`.* " +
              "FROM `sessions` `s` JOIN `session-tokens` `t` ON (`s`.`id` = `t`.`sessionId`)" +
              "WHERE `tokenSha256` = ?",
            [tokenSha256]
          ),
          this.get("session-tokens", { tokenSha256 }, log, false),
        ]);

        const session = sessions[0];
        if (!session || !token) {
          return undefined;
        }

        return { ...session, token };
      },

      // Clear out of cache after 20 minutes, since these tokens are only supposed to be 20-minute
      // tokens
      1200000,
      log
    );
  }

  /**
   * With the current @wymp/sql library it's not possible to delete rows with complex keys, so we
   * have to make those declarative methods here on our local object.
   */
  public async deleteClientRole(
    clientId: string,
    roleId: string,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<void> {
    log.debug(`Deleting client role '${clientId}:${roleId}'`);
    const resource = this.get("client-roles", { clientId, roleId }, log, false);
    if (resource) {
      await this.db.query("DELETE FROM `client-roles` WHERE `clientId` = ? && `roleId` = ?", [
        clientId,
        roleId,
      ]);
      log.debug(`Resource deleted, publishing messages`);

      // Bust cache
      this.cache.clear(new RegExp(`client-roles-.*`));

      // Publish audit message
      const p: Array<Promise<unknown>> = [];
      if (this.audit) {
        log.debug(`Publishing audit message`);
        p.push(
          this.audit.delete({
            auth,
            targetType: "client-roles",
            targetId: `${clientId}:${roleId}`,
          })
        );
      }

      // Publish domain message
      if (this.pubsub) {
        log.debug(`Publishing domain message`);
        p.push(
          this.pubsub.publish({
            action: "deleted",
            resource: { type: "client-roles", ...resource },
          })
        );
      }

      await Promise.all(p);
    } else {
      log.info(`Resource not found. Nothing to delete.`);
    }
  }

  /**
   * With the current @wymp/sql library it's not possible to delete rows with complex keys, so we
   * have to make those declarative methods here on our local object.
   */
  public async deleteUserRole(
    userId: string,
    roleId: string,
    auth: Auth.ReqInfo,
    log: SimpleLoggerInterface
  ): Promise<void> {
    log.debug(`Deleting user role '${userId}:${roleId}'`);
    const resource = this.get("user-roles", { userId, roleId }, log, false);
    if (resource) {
      await this.db.query("DELETE FROM `user-roles` WHERE `userId` = ? && `roleId` = ?", [
        userId,
        roleId,
      ]);
      log.debug(`Resource deleted, publishing messages`);

      // Bust cache
      this.cache.clear(new RegExp(`user-roles-.*`));

      // Publish audit message
      const p: Array<Promise<unknown>> = [];
      if (this.audit) {
        log.debug(`Publishing audit message`);
        p.push(
          this.audit.delete({
            auth,
            targetType: "user-roles",
            targetId: `${userId}:${roleId}`,
          })
        );
      }

      // Publish domain message
      if (this.pubsub) {
        log.debug(`Publishing domain message`);
        p.push(
          this.pubsub.publish({
            action: "deleted",
            resource: { type: "user-roles", ...resource },
          })
        );
      }

      await Promise.all(p);
    } else {
      log.info(`Resource not found. Nothing to delete.`);
    }
  }
}
