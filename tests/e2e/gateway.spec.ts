import { RateLimiterMemory } from "rate-limiter-flexible";
import { SimpleHttpClientRpn } from "simple-http-client-rpn";
import { MockSimpleLogger } from "@wymp/ts-simple-interfaces-testing";
import * as Weenie from "@wymp/weenie-framework";
import { Types, Service } from "../../src";
import * as AppWeenie from "../../run/Weenie";

// For easy typing of the 'r' parameter
declare type PromiseValue<T> = T extends PromiseLike<infer U> ? U : T;
export type FakeDeps = PromiseValue<ReturnType<typeof startFakeService>>;

let r: FakeDeps;
const http = new SimpleHttpClientRpn();
const port = 11223;

// Standard auth info to make basic request testing easier
let apikey = "1eb9b2d9-aa0b-68b0-2d59-5a25779175e7";
let secret = "2c51a52f2dec9998292dab987bd24eee136916898abab14f8a060f47b6287535";
/*
let headers = {
  Authorization: `Basic ${Buffer.from(`${apikey}:${secret}`, "utf8").toString("base64")}`,
  "User-Agent": "test1",
};
*/

// Create a fake web proxy function to monitor proxy calls
let webProxyStub: any;
const fakeWebProxyFunction = (req: any, res: any, opts: any, err: Function) => {
  if (res.send) {
    res.send({
      req: {
        path: req.path,
        headers: req.headers,
      },
      res: {
        headers: res.headers,
      },
    });
  } else {
    throw new Error("Stub didn't provide res object with send method");
  }
};

const startFakeService = async (port: number) => {
  // prettier-ignore
  const r = await Weenie.Weenie(
    Weenie.configFromFiles<Types.AppConfig>(
      "./config.json",
      "./config.local.json",
      Types.AppConfigValidator
    )()
  )
    // Change the listening port to ${port} for testing
    .and((r: { config: Types.AppConfig }) => {
      r.config.http.listeners = [[port, "localhost"]];
      return {};
    })
    // Mock logger
    .and(AppWeenie.mockCache)
    .and(Weenie.serviceManagement)
    .and(() => ({ logger: new MockSimpleLogger() }))
    .and(Weenie.mysql)
    // Mock proxy handler, real rate-limiter
    .and(() => {
      return {
        proxy: <any>{ web: (a: any, b: any, c: any, err: Function) => {
          throw new Error("This function should never execute. Something must be wrong with your web proxy stub.");
        }},
        rateLimiter: new RateLimiterMemory({ duration: 1 }),
      }
    })
    // Mock emailer
    .and(AppWeenie.emailer)
    // Mock cache
    .and(Weenie.httpHandler)
    // Real io
    .and(AppWeenie.io)
    // Real authz rules
    .and(AppWeenie.authz)

    // Wrap it all up
    .done(async (d) => {
      webProxyStub = jest.spyOn(d.proxy, "web");
      webProxyStub.mockImplementation(fakeWebProxyFunction);
      return {
        config: d.config,
        log: d.logger,
        http: d.http,
        getTcpListeners: d.getTcpListeners,
        proxy: d.proxy,
        rateLimiter: d.rateLimiter,
        sql: d.sql,
        cache: d.cache,
        svc: d.svc,
        io: d.io,
        authz: d.authz,
        emailer: d.emailer,
      };
    });

  Service.start(r);
  r.svc.initialized(true);

  return r;
};

describe("End-to-End Tests of Auth Service", () => {
  // Start the service before all tests
  beforeAll(async () => {
    r = await startFakeService(port);
  });

  // Close connections after tests
  afterAll(async () => {
    (r.sql as any).close();
    r.getTcpListeners().map((l: any) => {
      l.close();
    });
  });

  // Reset the web proxy mock every time
  beforeEach(() => {
    webProxyStub.mockReset();
    webProxyStub.mockImplementation(fakeWebProxyFunction);
  });

  /**
   *
   *
   *
   *
   *
   * Basics
   *
   *
   *
   *
   *
   */

  test(`Returns error on root request`, async () => {
    const res = await http.request<any>({ url: `http://localhost:${port}/` });
    expect(res.status).toBe(400);
    expect(res.data).toMatchObject({
      error: {
        status: 400,
        title: "BadRequest",
        detail: "You must specify an API and version for your request, e.g., `/accounts/v1/...`",
        obstructions: [],
      },
    });
  });

  ["OPTIONS" as const, "GET" as const].map((method) => {
    test(`should respond with correct default access control headers for ${method} requests`, async () => {
      const res = await http.request<any>({
        method,
        url: `http://localhost:${port}/testing/v1/test`,
      });

      if (method === "OPTIONS") {
        expect(res.status).toBe(200);
      }

      expect(res.headers["access-control-allow-origin"]).toBeDefined();
      expect(res.headers["access-control-allow-origin"]).toBe("*");
      expect(res.headers["access-control-allow-credentials"]).not.toBeDefined();
      expect(res.headers["access-control-allow-headers"]).toBeDefined();
      expect(res.headers["access-control-allow-headers"]).toBe("Authorization,Content-Type,Accept");
      expect(res.headers["access-control-allow-methods"]).toBeDefined();
      expect(res.headers["access-control-allow-methods"]).toBe("GET,POST,PUT,PATCH,DELETE");
      expect(res.headers["access-control-max-age"]).toBeDefined();
      expect(res.headers["access-control-max-age"]).toBe("2592000");
    });
  });

  test("Rejects calls to non-existent APIs", async () => {
    const res = await http.request<any>({ url: `http://localhost:${port}/nope/v1` });
    expect(res.data).toMatchObject({
      error: {
        detail: "API 'nope' does not exist.",
      },
    });
    expect(res.status).toBe(400);
  });

  test("Rejects calls to non-existent versions of existing APIs", async () => {
    const res = await http.request<any>({ url: `http://localhost:${port}/accounts/v5399` });
    expect(res.data).toMatchObject({
      error: {
        detail: `API 'accounts' exists, but not in version 'v5399'. Available versions are v1.`,
      },
    });
    expect(res.status).toBe(400);
  });

  /**
   *
   *
   *
   *
   * Gateway logic
   *
   *
   *
   *
   */

  describe("Gateway Logic", () => {
    afterEach(async () => {
      await r.sql.query("DELETE FROM `apis` WHERE `domain` = '_testing'");
    });

    test.todo("rejects unidentified requests for apis that require identification");

    test("Rejects unknown client ids", async () => {
      const headers = {
        Authorization: `Basic ${Buffer.from(`${"fake-client"}:${secret}`, "utf8").toString(
          "base64"
        )}`,
      };

      const res = await http.request<any>({
        url: `http://localhost:${port}/accounts/v1/test`,
        headers,
      });

      expect(res.data).toMatchObject({
        error: {
          detail: "The Client ID you passed ('fake-client') is not known to our system.",
        },
      });
      expect(res.status).toBe(401);
    });

    test("rejects known client ids with bad secret when secret passed", async () => {
      const headers = {
        Authorization: `Basic ${Buffer.from(`${apikey}:lkahsdflkjhasdf`, "utf8").toString(
          "base64"
        )}`,
      };

      const res = await http.request<any>({
        url: `http://localhost:${port}/accounts/v1/test`,
        headers,
      });

      expect(res.data).toMatchObject({
        error: {
          detail:
            "While your Client ID appears to be valid, the secret you've passed is not. Please check your credentials.",
        },
      });
      expect(res.status).toBe(401);
    });

    test("rejects unidentified requests that exceed rate-limit of 1 per second per ip", async () => {
      // create api that allows unidentified requests
      await r.sql.query(
        'INSERT INTO `apis` VALUES ("_testing", "v1", "http://localhost:12345", 1, 1)'
      );

      // SHOULD NOT reject here as this is our FIRST request
      const res1 = await http.request<any>({ url: `http://localhost:${port}/_testing/v1/test` });
      expect(res1.data).not.toMatchObject({
        t: "error",
        error: { title: "TooManyRequests" },
      });
      expect(res1.status).not.toBe(429);

      // SHOULD reject here
      const res2 = await http.request<any>({ url: `http://localhost:${port}/_testing/v1/test` });
      expect(res2.data).toMatchObject({
        t: "error",
        error: {
          code: "HTTP_TOO_MANY_REQUESTS",
          title: "TooManyRequests",
        },
      });
      expect(res2.status).toBe(429);

      await new Promise<void>((res) => setTimeout(res, 1000));

      //Finally, should return a successful status after the rate limit has passed
      const res3 = await http.request<any>({ url: `http://localhost:${port}/_testing/v1/test` });
      expect(res3.data).not.toMatchObject({
        t: "error",
        error: {
          title: "TooManyRequests",
        },
      });
      expect(res3.status).not.toBe(429);
    });
  });
});
