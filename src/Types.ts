import { IncomingMessage, ServerResponse } from "http";
import * as rt from "runtypes";
import {
  SimpleLoggerInterface,
  SimpleHttpRequestHandlerInterface,
} from "@wymp/ts-simple-interfaces";
import * as Weenie from "@wymp/weenie-framework";
import { IoInterface } from "./Io";

export const AppConfigValidator = rt.Intersect(
  Weenie.baseConfigValidator,
  rt.Record({
    http: Weenie.webServiceConfigValidator,
    amqp: Weenie.mqConnectionConfigValidator,
    db: Weenie.databaseConfigValidator,
    domain: rt.Literal("auth"),
    debugKey: rt.String,

    // JWT keys
    authHeader: rt.Union(
      rt.Record({
        sign: rt.Literal(true),
        // The ECDSA key should be a PEM-format ECDSA private key string
        ecdsaKey: rt.Union(
          rt.Record({
            t: rt.Literal("file"),
            path: rt.String,
          }),
          rt.Record({
            t: rt.Literal("env"),
            varname: rt.String,
          })
        ),
      }),
      rt.Record({
        sign: rt.Literal(false),
      })
    ),

    // Expiration times for various items
    expires: rt.Record({
      sessionHour: rt.Number,
      sessionTokenMin: rt.Number,
      emailVerCodeMin: rt.Number,
      loginCodeMin: rt.Number,
    }),

    // Optional cache config
    cache: rt.Optional(
      rt.Record({
        maxLength: rt.Union(rt.Number, rt.Undefined),
        ttlSec: rt.Union(rt.Number, rt.Undefined),
      })
    ),

    emails: rt.Record({
      from: rt.String,
      templateFiles: rt.Record({
        login: rt.String,
        emailVerCode: rt.String,
      }),
    }),

    // Urls for various verification code emails
    verificationUrls: rt.Record({
      emailVerify: rt.String,
      login: rt.String,
    }),

    // Authentication flow throttling config
    authn: rt.Record({
      throttle: rt.Record({
        numReqs: rt.Union(rt.Number, rt.Undefined),
        periodSecs: rt.Union(rt.Number, rt.Undefined),
      }),
    }),
  })
);

export type AppConfig = rt.Static<typeof AppConfigValidator>;

export type AppDeps = {
  config: AppConfig;
  log: SimpleLoggerInterface;
  http: SimpleHttpRequestHandlerInterface;
  io: IoInterface<ClientRoles, UserRoles>;
  cache: CacheInterface;
  proxy: ProxyInterface;
  rateLimiter?: RateLimiterInterface;
};

export type UserRoles =
  // A system administrator
  | "sysadmin"

  // A regular, unprivileged user
  | "user";

export type ClientRoles =
  // A low-level system service using the API as an integral part of the overall system
  | "system"

  // An "own" client; i.e., any client that you create for your own business
  | "internal"

  // A client you create for an external partner or user
  | "external";

export interface CacheInterface {
  get<T>(k: string, cb: () => Promise<T>, ttl?: number, log?: SimpleLoggerInterface): Promise<T>;
  get<T>(k: string, cb: () => T, ttl?: number, log?: SimpleLoggerInterface): T;
  clear(k: string | RegExp): void | unknown;
}

export interface RateLimiterInterface {
  consume(client: string): RateLimiterResponse;
}

export interface RateLimiterResponse {
  remainingPoints: number;
  consumedPoints: number;
  msBeforeNext: number;
}

export interface ProxyInterface {
  web(
    req: IncomingMessage,
    res: ServerResponse,
    opts: { target: string },
    cb: (e: Error, eReq: IncomingMessage, eRes: ServerResponse, targetUrl: string) => unknown
  ): unknown;
}
