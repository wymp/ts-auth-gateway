import { IncomingMessage, ServerResponse } from "http";
import * as rt from "runtypes";
import {
  SimpleLoggerInterface,
  SimpleHttpRequestHandlerInterface,
} from "@wymp/ts-simple-interfaces";
import * as Weenie from "@wymp/weenie-framework";
import { Io } from "./Io";

/**
 * For generated documentation: See source for more useful understanding of config requirements.
 */
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
        headerName: rt.String,
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
        headerName: rt.String,
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

/**
 * The full set of interfaces that this application depends on. This object is passed down from
 * boot-up through the various modules and provides the actual IO and external functionality
 * necessary for the functioning of the app.
 *
 * Most things in this library will depend on a slice of this object.
 */
export type AppDeps = {
  /** The current configuration object */
  config: AppConfig;

  /** A logger */
  log: SimpleLoggerInterface;

  /** An HTTP Request Handler */
  http: SimpleHttpRequestHandlerInterface;

  /** Our IO object for accessing the database */
  io: Omit<Io<ClientRoles, UserRoles>, "db" | "cache" | "sqlizeParams">;

  /** A cache (possibly stubbed if you don't want to mess with caching) */
  cache: CacheInterface;

  /** An object that can be used to proxy requests */
  proxy: ProxyInterface;

  /** An optional rate limiter */
  rateLimiter?: RateLimiterInterface;

  /**
   * An authorization map. This provides for centralized authorization, which can help to maintain
   * control and transparency in this very important function.
   */
  authz: {
    [endpoint in Endpoints]: Array<[ClientRoles | null, boolean | null, UserRoles | null, null]>;
  };

  /** An optional emailer for sending emails (email address verification, login, etc.) */
  emailer: null | Emailer;

  /**
   * Because user creation in particular will often need to be propagated synchronously to other
   * subservices, our User module allows for the provision of a "hook" that takes the data of the
   * user created and returns a promise.
   *
   * Ordinarily you might use an MQ to handle this functionality, but for those who do not want to
   * fire up an MQ, this mechanism is also available. Note, however, that if the hook throws an
   * error for any reason, it will NOT be re-run. This is considered an acceptable cost for the
   * benefit of not having to set up an MQ.
   */
  onCreateUser?: null | ((user: unknown, r: { log: SimpleLoggerInterface }) => Promise<void>);
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

/**
 * A discrete list of endpoints (e.g., "GET /users" or "POST /clients/:id/access-restrictions").
 * This allows us to ensure that we have authorization defined for every endpoint (even if we choose
 * to provide blank authorization, thus allowing anyone access).
 *
 * TODO: Replace this with explicit list of keys
 */
export type Endpoints = string;

/**
 * A list of User Roles in this system
 */
export enum UserRoles {
  // A system administrator
  SYSADMIN = "sysadmin",

  // A regular, unprivileged user
  USER = "user",

  // An "insider" of the company
  EMPLOYEE = "employee",
}

/**
 * A list of Client Roles in this system
 */
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
