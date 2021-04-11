import { SimpleSqlDbInterface, SimpleLoggerInterface } from "@wymp/ts-simple-interfaces";
import { Io, CacheInterface, ClientRoles, UserRoles } from "../src";

export const io = (r: { sql: SimpleSqlDbInterface; cache: CacheInterface; }) => ({
  io: new Io<ClientRoles, UserRoles>(r.sql, r.cache)
})

export const mockCache = () => ({
  cache: <CacheInterface>{
    get<T>(
      k: string,
      v: () => T | Promise<T>,
      ttl?: number,
      log?: SimpleLoggerInterface
    ): T | Promise<T> {
      return v();
    },
    clear(k?: string) {},
  }
})
