import * as E from "@wymp/http-errors";
import { SimpleLoggerInterface } from "@wymp/ts-simple-interfaces";

/**
 * Throttle incoming requests
 *
 * This is a basic rate limiter for emails on login. It is intended to prevent spamming by malicious
 * parties sending many login requests.
 */
export type ThrottleConfig = { numReqs: number; periodSecs: number };
export class Throttle {
  /** Instance config */
  protected config: ThrottleConfig;

  /**
   * `k` is the email or code being submitted for login; `selfDestruct` is a Timeout that destroys
   * the entry after the given number of seconds; and `reqs` is a simple counter of the number of
   * requests made in this period.
   */
  protected reqs: { [k: string]: { selfDestruct: any; reqs: number } } = {};

  /**
   * Allow for partial config submission on construct. Fill in with defaults.
   */
  public constructor(protected log: SimpleLoggerInterface, config?: Partial<ThrottleConfig>) {
    // Default to 10 requests per 5 minutes
    this.config = {
      numReqs: 10,
      periodSecs: 300,
      ...(config || {}),
    };
  }

  /**
   * Main throttle method. Returns the number of requests that have been made in this period,
   * including the current one.
   */
  public throttle(key: string): number {
    if (!this.reqs[key]) {
      this.reqs[key] = {
        selfDestruct: setTimeout(() => {
          delete this.reqs[key];
        }, this.config.periodSecs * 1000),
        reqs: 0,
      };
    }

    if (this.reqs[key].reqs === this.config.numReqs) {
      throw new E.TooManyRequests(
        `You've made too many login attempts. Please wait 5 minutes before trying again.`
      );
    }
    this.log.debug(
      `${this.reqs[key].reqs} current requests is less than ${this.config.numReqs} configured
      maximum requests per ${this.config.periodSecs} seconds. Request allowed.`
    );

    return this.reqs[key].reqs++;
  }
}
