import { SimpleSqlDbInterface, SimpleLoggerInterface } from "@wymp/ts-simple-interfaces";
import * as HttpProxy from "http-proxy";
import { Io, Types } from "../src";
import { authz as Authz } from "./Authorizations";

export const io = (r: { sql: SimpleSqlDbInterface; cache: Io.CacheInterface }) => ({
  io: new Io.Io<Types.ClientRoles, Types.UserRoles>(r.sql, r.cache),
});

export const mockCache = () => ({
  cache: <Io.CacheInterface>{
    get<T>(
      k: string,
      v: () => T | Promise<T>,
      ttl?: number,
      log?: SimpleLoggerInterface
    ): T | Promise<T> {
      return v();
    },
    clear(k?: string) {},
  },
});

export const proxy = () => ({ proxy: HttpProxy.createProxyServer({ xfwd: true }) });
export const authz = () => ({ authz: Authz });

/**
 * To enable emailing, just implement `src/Types::Emailer` interface here. You can use whatever
 * service you'd like as a back-end.
 */
export const emailer = (): { emailer: Types.Emailer | null } => ({ emailer: null });
/* STUB EMAILER
export const emailer = (): { emailer: Types.Emailer | null } => ({
  emailer: {
    sendEmailVerificationCode: async (
      codeHex: string,
      fromEmail: string,
      toEmail: string,
      log: SimpleLoggerInterface
    ): Promise<void> => { log.warning(`THIS IS A STUB. WOULD HAVE SENT AN EMAIL FOR VERIFICATION CODE '${codeHex}'.`); },
    sendLoginCode: async (
      codeHex: string,
      fromEmail: string,
      toEmail: string,
      log: SimpleLoggerInterface
    ): Promise<void> => { log.warning(`THIS IS A STUB. WOULD HAVE SENT AN EMAIL FOR LOGIN CODE '${codeHex}'.`); },
  }
});
*/
