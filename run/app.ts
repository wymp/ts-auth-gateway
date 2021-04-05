import { Service, AppConfigValidator, AppConfig } from "../src";
import * as Weenie from "@wymp/weenie-framework";

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

(async () => {
  // Start off our dependencies with config, then attach others from here
  const d = await Weenie.Weenie(
    (
      envConfig
        ? Weenie.configFromEnv<AppConfig>(process.env, AppConfigValidator, defaults, prefix)
        : Weenie.configFromFiles<AppConfig>(defaults, overrides, AppConfigValidator)
    )()
  )
  .and(Weenie.serviceManagement)
  .and(Weenie.logger)
  .and(Weenie.httpHandler)
  .done(d => {
    return {
      config: d.config,
      log: d.logger,
      http: d.http,
      svc: d.svc,
    }
  });

  // Start the service with the dependencies
  Service.start(d);

  // Alert everything that the service has been successfully initialized
  d.svc.initialized(true);
})()
.catch(e => {
  console.error(`Fatal error: `, e);
  process.exit(1);
});

