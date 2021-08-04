import { IncomingMessage, ServerResponse } from "http";
import * as rt from "runtypes";
import {
  SimpleLoggerInterface,
  SimpleHttpRequestHandlerInterface,
} from "@wymp/ts-simple-interfaces";
import * as Weenie from "@wymp/weenie-framework";
import { Io } from "./Io";

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
        numReqs: rt.Number,
        periodSecs: rt.Number,
      }),
    }),

    // Email regex for validating incoming email addresses
    emailRegex: rt.String,
  })
);

export type AppConfig = rt.Static<typeof AppConfigValidator>;

export type AppDeps = {
  config: AppConfig;
  log: SimpleLoggerInterface;
  http: SimpleHttpRequestHandlerInterface;
  io: Omit<Io<ClientRoles, UserRoles>, "db" | "cache" | "sqlizeParams">;
  cache: CacheInterface;
  proxy: ProxyInterface;
  rateLimiter?: RateLimiterInterface;
  authz: {
    [endpoint in Endpoints]: Array<[ClientRoles | null, boolean | null, UserRoles | null, null]>;
  };
  emailer: null | Emailer;
};

/**
 * For anyone who wants to implement the email flow, they can pass an emailer as a dependency that
 * will take care of actually sending the email. The service itself will be responsible for
 * generating the login code and passing the code into the emailer to be sent.
 */
export interface Emailer {
  sendEmailVerificationCode(
    codeHex: string,
    fromEmail: string,
    toEmail: string,
    log: SimpleLoggerInterface
  ): Promise<void>;
  sendLoginCode(
    codeHex: string,
    fromEmail: string,
    toEmail: string,
    log: SimpleLoggerInterface
  ): Promise<void>;
}

// TODO: Replace this with explicit list of keys
export type Endpoints = string;

export enum UserRoles {
  // A system administrator
  SYSADMIN = "sysadmin",

  // A regular, unprivileged user
  USER = "user",

  // An "insider" of the company
  EMPLOYEE = "employee",
}

export enum ClientRoles {
  // A low-level system service using the API as an integral part of the overall system
  SYSTEM = "system",

  // An "own" client; i.e., any client that you create for your own business
  INTERNAL = "internal",

  // A client you create for an external partner or user
  EXTERNAL = "external",
}

export interface CacheInterface {
  get<T>(k: string, cb: () => Promise<T>, ttl?: number, log?: SimpleLoggerInterface): Promise<T>;
  get<T>(k: string, cb: () => T, ttl?: number, log?: SimpleLoggerInterface): T;
  clear(k: string | RegExp): void | unknown;
}

export interface RateLimiterInterface {
  consume(client: string): Promise<RateLimiterResponse>;
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
