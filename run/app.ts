import * as E from "@openfinanceio/http-errors";
import * as Weenie from "@wymp/weenie-framework";
import { Service, Types } from "../src";
import * as AppWeenie from "./Weenie";

// There are some minimal bootstrap options that you can configure via environment variables:
//
// 1. APP_CONFIG_WITH_ENV - (boolean) Use environment variables to configure the service, rather
//    than files. Defaults to false.
// 2. APP_CONFIG_PREFIX - Set the prefix for environment variable config keys. Defaults to "APP".
//    Only applicable if APP_CONFIG_WITH_ENV set to true.
// 3. APP_CONFIG_DEFAULTS_FILE - Set the path for the defaults file for config values. Defaults
//    to "./config.json".
// 4. APP_CONFIG_OVERRIDES_FILES - Set the path for the overrides file for config values. Only
//    applicable if APP_CONFIG_WITH_ENV not set to true. Defaults to "./config.local.json".

const envConfig = process.env.APP_CONFIG_WITH_ENV === "true";
const prefix = process.env["APP_CONFIG_PREFIX"] || "APP";
const defaults = process.env["APP_CONFIG_DEFAULTS_FILES"] || "./config.json";
const overrides = process.env["APP_CONFIG_OVERRIDES_FILE"] || "./config.local.json";

const die = (e: any) => {
  console.error(`Fatal error: `, e);
  process.exit(1);
};
process.on("uncaughtException", die);

(async () => {
  // Start off our dependencies with config, then attach others from here
  const d = await Weenie.Weenie(
    (envConfig
      ? Weenie.configFromEnv<Types.AppConfig>(
          process.env,
          Types.AppConfigValidator,
          defaults,
          prefix
        )
      : Weenie.configFromFiles<Types.AppConfig>(defaults, overrides, Types.AppConfigValidator))()
  )
    // Make sure config.http.parseJson is not turned on, since that will cause problems with proxying
    .and(
      (d: {
        config: {
          http: {
            parseJson?: boolean | null;
            errOnBlankPost?: boolean | null;
          };
        };
      }) => {
        if (d.config.http.parseJson !== false) {
          throw new E.InternalServerError(
            `Parsing bodies in this service causes proxying to fail. You have requested to enable ` +
              `JSON body parsing by default by either omitting or setting to 'true' the ` +
              `'config.http.parseJson' config key. Please set this key to false to proceed.`
          );
        }
        if (d.config.http.errOnBlankPost !== false) {
          throw new E.InternalServerError(
            `Automatically parsing bodies and running checks for blank bodies causes problems with ` +
              `proxying. You have requested to enable blank body checks by either omitting or ` +
              `setting to 'true' the 'config.http.errOnBlankPost' config key. Please set this key to ` +
              `'false' to proceed.`
          );
        }
        return {};
      }
    )
    .and(AppWeenie.mockCache)
    .and(Weenie.serviceManagement)
    .and(Weenie.logger)
    .and(Weenie.httpHandler)
    .and(Weenie.mysql)
    .and(AppWeenie.io)
    .and(AppWeenie.proxy)
    .and(AppWeenie.authz)
    .and(AppWeenie.emailer)
    .done((d) => {
      return {
        cache: d.cache,
        config: d.config,
        http: d.http,
        io: d.io,
        log: d.logger,
        proxy: d.proxy,
        svc: d.svc,
        authz: d.authz,
        emailer: d.emailer,
      };
    });

  // Start the service with the dependencies
  Service.start(d);

  // Alert everything that the service has been successfully initialized
  d.svc.initialized(true);
})().catch(die);
