import * as bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import * as rt from "runtypes";
import * as E from "@wymp/http-errors";
import * as Http from "@wymp/http-utils";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Auth } from "@wymp/types";
import { Throttle } from "../../Throttle";
import { AppDeps, ClientRoles, UserRoles } from "../../Types";
import { sendCode, generateCode } from "./VerificationCodes";

/**
 *
 *
 *
 *
 * Input Validators and Misc Functions
 *
 *
 *
 *
 */

// Session filters
const sessionCreatedFilterValidator = rt.Optional(
  rt.Union(
    rt.Record({
      op: rt.Union(
        rt.Literal("lt"),
        rt.Literal("gt"),
        rt.Literal("eq"),
        rt.Literal("lte"),
        rt.Literal("gte"),
        rt.Literal("ne")
      ),
      val: rt.Number,
    }),
    rt.Null
  )
);
const sessionFilterValidator = rt.Record({
  userId: rt.Optional(rt.Union(rt.String, rt.Null)),
  createdMs: sessionCreatedFilterValidator,
});
const userSessionFilterValidator = rt.Record({
  createdMs: sessionCreatedFilterValidator,
});

// Session create endpoint inputs
const stateParam = rt.String.withConstraint((st) => {
  return !!st.match(/^[a-fA-F0-9]{32}$/) || "'state' parameter must be exactly 32 hex characters";
});
const emailStepPayloadValidator = rt.Record({
  data: rt.Record({
    t: rt.Literal("email-step"),
    email: rt.String,
    state: stateParam,
  }),
});
export const passwordStepPayloadValidator = rt.Record({
  data: rt.Record({
    t: rt.Literal("password-step"),
    email: rt.String,
    password: rt.String,
    state: stateParam,
  }),
});
export const codeStepPayloadValidator = rt.Record({
  data: rt.Record({
    t: rt.Literal("code-step"),
    code: rt.String.withConstraint((code) => {
      return (
        !!code.match(/^[a-fA-F0-9]{32}$/) || "'code' parameter must be exactly 32 hex characters"
      );
    }),
    state: stateParam,
  }),
});
export const totpStepPayloadValidator = rt.Record({
  data: rt.Record({
    t: rt.Literal("totp-step"),
    totp: rt.String,
    state: stateParam,
  }),
});

const baseErr =
  `The body of your request does not appear to conform to the documented input for this ` +
  `endpoint. Please read the docs: /docs/api.v1.html.\n\n`;

/**
 *
 *
 *
 *
 * Request Handlers
 *
 *
 *
 *
 */

export const handleGetAllSessions = (
  r: Pick<AppDeps, "io" | "log" | "authz">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      // Authorize
      Http.authorize(req, r.authz["GET /sessions"], log);

      // Parse out filter, if provided
      let filter: rt.Static<typeof sessionFilterValidator> | undefined;
      if (req.query.filter) {
        try {
          log.debug(`Filter passed: '${req.query.filter}'`);
          const validate = sessionFilterValidator.validate(JSON.parse(req.query.filter));
          if (validate.success === false) {
            throw new E.BadRequest(
              `The 'filter' query parameter you passed did not pass validation: ` +
                `${validate.message}`
            );
          }
          filter = validate.value;
        } catch (e) {
          // Repackage JSON errors for easier consumption by users
          if (e.name === "SyntaxError") {
            throw new E.BadRequest(
              `The 'filter' query parameter should be a valid JSON string. You passed ` +
                `'${req.query.filter}'.`
            );
          } else {
            throw e;
          }
        }
      }

      // Parse out params, if provided
      let params = Http.getCollectionParams(req.query);

      // Make request and return response
      const sessions = await r.io.get("sessions", { _t: "filter", ...filter }, params, log);
      const response: Auth.Api.Responses<ClientRoles, UserRoles>["GET /sessions"] = sessions;

      // Send response
      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

export const handleGetUserSessions = (
  r: Pick<AppDeps, "io" | "log" | "authz">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      // Internal: Validate user id param
      if (!req.params.id) {
        throw new E.InternalServerError(
          `Programmer: No user ID parameter found in path. You may have specified this endpoint ` +
            `incorrectly. The endpoint must define an 'id' param representing the user's id.`
        );
      }

      Http.assertAuthdReq(req);

      // De-alias and assign
      const userId = req.params.id === "current" ? req.auth.u?.id || "current" : req.params.id;

      // Authorize
      if (!req.auth.u || req.auth.u.id !== userId) {
        Http.authorize(req, r.authz["GET /users/:id/sessions"], log);
      }

      // Parse out filter, if provided
      let filter: rt.Static<typeof userSessionFilterValidator> | undefined;
      if (req.query.filter) {
        try {
          log.debug(`Filter passed: '${req.query.filter}'`);
          const validate = userSessionFilterValidator.validate(JSON.parse(req.query.filter));
          if (validate.success === false) {
            throw new E.BadRequest(
              `The 'filter' query parameter you passed did not pass validation: ` +
                `${validate.message}`
            );
          }
          filter = validate.value;
        } catch (e) {
          // Repackage JSON errors for easier consumption by users
          if (e.name === "SyntaxError") {
            throw new E.BadRequest(
              `The 'filter' query parameter should be a valid JSON string. You passed ` +
                `'${req.query.filter}'.`
            );
          } else {
            throw e;
          }
        }
      }

      // Parse out params, if provided
      let params = Http.getCollectionParams(req.query);

      // Make request and return response
      const sessions = await r.io.get(
        "sessions",
        { _t: "filter", userId, createdMs: filter?.createdMs },
        params,
        log
      );
      const response: Auth.Api.Responses<ClientRoles, UserRoles>["GET /sessions"] = sessions;

      // Send response
      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

export const handlePostSessionsLoginEmail = (
  r: Pick<AppDeps, "io" | "log" | "config" | "emailer">
): SimpleHttpServerMiddleware => {
  const throttle = getThrottle(r);
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      Http.assertAuthdReq(req);

      // If no emailer passed, then throw a NotImplemented error
      if (!r.emailer) {
        log.info(`Emailer not passed as a dependency.`);
        throw new E.NotImplemented(
          `This login flow has not been implemented. Please try the password flow instead`
        );
      }

      const val = emailStepPayloadValidator.validate(req.body);
      if (!val.success) {
        throw new E.BadRequest(baseErr + `Error: ${val.message}`);
      }

      const response: Auth.Api.Responses<ClientRoles, UserRoles>["POST /sessions/login/email"] =
        await logInWithEmail(val.value.data, throttle, req.auth, { ...r, log });

      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

export const handlePostSessionsLoginPassword = (
  r: Pick<AppDeps, "io" | "log" | "config" | "emailer">
): SimpleHttpServerMiddleware => {
  const throttle = getThrottle(r);
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      Http.assertAuthdReq(req);

      const val = passwordStepPayloadValidator.validate(req.body);
      if (!val.success) {
        throw new E.BadRequest(baseErr + `Error: ${val.message}`);
      }

      const response: Auth.Api.Responses<ClientRoles, UserRoles>["POST /sessions/login/password"] =
        await logInWithPassword(val.value.data, req.get("user-agent"), throttle, req.auth, {
          ...r,
          log,
        });

      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

export const handlePostSessionsLoginCode = (
  r: Pick<AppDeps, "io" | "log">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      //const log = Http.logger(r.log, req, res);
      next(new E.NotImplemented(`This endpoint is not yet implemented`));
    } catch (e) {
      next(e);
    }
  };
};

export const handlePostSessionsLoginTotp = (
  r: Pick<AppDeps, "io" | "log">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      //const log = Http.logger(r.log, req, res);
      next(new E.NotImplemented(`This endpoint is not yet implemented`));
    } catch (e) {
      next(e);
    }
  };
};

export const handlePostSessionsRefresh = (
  r: Pick<AppDeps, "io" | "log">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      //const log = Http.logger(r.log, req, res);
      next(new E.NotImplemented(`This endpoint is not yet implemented`));
    } catch (e) {
      next(e);
    }
  };
};

export const handlePostSessionsLogout = (
  r: Pick<AppDeps, "io" | "log">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      //const log = Http.logger(r.log, req, res);
      next(new E.NotImplemented(`This endpoint is not yet implemented`));
    } catch (e) {
      next(e);
    }
  };
};

/**
 *
 *
 *
 *
 * Functions
 *
 *
 *
 *
 */

export const createSession = async (
  userId: string,
  userAgent: string | null | undefined,
  auth: Auth.ReqInfo,
  overrides: { createdMs?: number; expiresMs?: number },
  r: Pick<AppDeps, "log" | "config" | "io">
): Promise<Auth.Api.Authn.Session> => {
  // Create session
  r.log.notice(`Generating a new session`);

  // Generate tokens
  const refreshToken = randomBytes(32).toString("hex");
  const sessionToken = randomBytes(32).toString("hex");

  // Save session
  const session = await r.io.save(
    "sessions",
    {
      userAgent: userAgent || null,
      ip: auth.ip,
      userId,
      invalidatedMs: null,
      createdMs: Date.now(),
      expiresMs: Date.now() + 1000 * 60 * 60 * r.config.expires.sessionHour,

      // Override certain values, if supplied
      ...overrides,
    },
    auth,
    r.log
  );

  // Save tokens
  await Promise.all([
    r.io.save(
      "session-tokens",
      {
        type: "session",
        tokenSha256: createHash("sha256").update(sessionToken).digest(),
        sessionId: session.id,
        expiresMs: Date.now() + 1000 * 60 * r.config.expires.sessionTokenMin,
      },
      auth,
      r.log
    ),
    r.io.save(
      "session-tokens",
      {
        type: "refresh",
        tokenSha256: createHash("sha256").update(refreshToken).digest(),
        sessionId: session.id,
        expiresMs: Date.now() + 1000 * 60 * 60 * r.config.expires.sessionHour,
      },
      auth,
      r.log
    ),
  ]);

  // Return structured data
  return {
    t: "session",
    token: sessionToken,
    refresh: refreshToken,
  };
};

export const logInWithEmail = async (
  payload: rt.Static<typeof emailStepPayloadValidator>["data"],
  throttle: Throttle,
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "io" | "log" | "config" | "emailer">
): Promise<Auth.Api.Responses<ClientRoles, UserRoles>["POST /sessions/login/email"]> => {
  // Throttle requests for the given email
  throttle.throttle(payload.email);

  // Validate email
  await getAndValidateUserForEmail(payload.email, r);

  // Send the login code to the email
  await sendCode("login", payload.email, payload.state, auth, r);

  return { data: null };
};

export const logInWithPassword = async (
  payload: rt.Static<typeof passwordStepPayloadValidator>["data"],
  userAgent: string | undefined,
  throttle: Throttle,
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "io" | "log" | "config" | "emailer">
): Promise<Auth.Api.Responses<ClientRoles, UserRoles>["POST /sessions/login/password"]> => {
  // Throttle requests for the given email
  throttle.throttle(payload.email);

  // Get and validate user
  const user = await getAndValidateUserForEmail(payload.email, r);

  // Verify the password hash against the incoming password
  const check = user.passwordBcrypt
    ? await bcrypt.compare(payload.password, user.passwordBcrypt)
    : false;
  if (!check) {
    throw new E.Unauthorized(`Incorrect password`, `INCORRECT-PASSWORD`);
  }

  // Handle 2fa, if necessary
  if (user["2fa"] === 1) {
    // If 2fa enabled, generate a code and send back a step
    const code = await generateCode("login", payload.email, payload.state, auth, r);
    return {
      data: {
        t: "step",
        step: Auth.Api.Authn.Types.Totp,
        code,
        state: payload.state,
      },
    };
  } else {
    // If 2fa not enabled, generate and return a session
    return { data: await createSession(user.id, userAgent, auth, {}, r) };
  }
};

const getAndValidateUserForEmail = async (
  _email: string,
  r: Pick<AppDeps, "io" | "log">
): Promise<Auth.Db.User> => {
  // Verify that the email exists
  const email = await r.io.get("emails", { email: _email }, r.log);
  if (!email) {
    throw new E.BadRequest(
      `Email '${_email}' not found. Please register before trying to log in.`,
      `EMAIL-NOT-FOUND`
    );
  }

  // Get the user for the given email
  const user = await r.io.get("users", { id: email.userId }, r.log, true);

  // Validate that the user is not banned or deleted
  if (user.bannedMs !== null) {
    throw new E.Forbidden(`Sorry, this user has been banned.`, `USER-BANNED`);
  }
  if (user.deletedMs !== null) {
    throw new E.Forbidden(`Sorry, this user has been deleted.`, `USER-DELETED`);
  }

  return user;
};

let throttle: Throttle | null = null;
const getThrottle = (r: Pick<AppDeps, "config" | "log">) => {
  if (!throttle) {
    throttle = new Throttle(r.log, r.config.authn.throttle);
  }
  return throttle;
};
