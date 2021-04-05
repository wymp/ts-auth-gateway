import * as rt from "runtypes";
import { SimpleLoggerInterface, SimpleHttpRequestHandlerInterface } from "@wymp/ts-simple-interfaces";
import * as Weenie from "@wymp/weenie-framework";

export const AppConfigValidator = rt.Intersect(
  Weenie.baseConfigValidator,
  rt.Record({
    webservice: Weenie.webServiceConfigValidator,
    amqp: Weenie.mqConnectionConfigValidator,
    db: Weenie.databaseConfigValidator,
    domain: rt.Literal("auth"),

    // JWT keys
    authHeader: rt.Union(
      rt.Record({
        sign: rt.Literal(true),
        ecdsaKey: rt.Union(
          rt.Record({
            t: rt.Literal("file"),
            path: rt.String,
          }),
          rt.Record({
            t: rt.Literal("env"),
            varname: rt.String,
          })
        )
      }),
      rt.Record({
        sign: rt.Literal(false)
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
      })
    }),
  })
);

export type AppConfig = rt.Static<typeof AppConfigValidator>;

export type AppDeps = {
  config: AppConfig;
  log: SimpleLoggerInterface;
  http: SimpleHttpRequestHandlerInterface;
}
