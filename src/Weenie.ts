/**
 * NOTE: This file differs from `/run/Weenie.ts` in that this file is exported as part of the
 * library. The functions in `/run/Weenie.ts` are meant to be useful to THIS PARTICULAR INSTANCE
 * of the gateway, not to dependents, while this file is meant to be useful to dependents.
 */
import { SimpleLoggerInterface } from "@wymp/ts-simple-interfaces";
import * as Weenie from "@wymp/weenie-framework";

/**
 * Since our amqp configuration is optional, we can't use the standard Weenie.amqp. This new
 * function accommodates the optional config.
 */
export const maybeAmqp = (r: {
  config: { amqp?: Weenie.MqConnectionConfig };
  logger: SimpleLoggerInterface;
}) => {
  const amqpConfig = r.config.amqp;
  if (amqpConfig) {
    r.logger.notice(`AMQP config provided - instantiating an AMQP connection`);
    return Weenie.amqp({ ...r, config: { ...r.config, amqp: amqpConfig } });
  } else {
    r.logger.notice(`AMQP config not provided - not instantiating an AMQP connection`);
    return { pubsub: undefined };
  }
};
