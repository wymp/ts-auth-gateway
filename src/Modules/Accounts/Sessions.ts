import * as bcrypt from "bcryptjs";
import { randomBytes, createHash } from "crypto";
import * as rt from "runtypes";
import * as E from "@wymp/http-errors";
import * as Http from "@wymp/http-utils";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Auth } from "@wymp/types";
import { Throttle } from "../../Throttle";
import { AppDeps, ClientRoles, UserRoles } from "../../Types";
import * as Common from "./Common";
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
const passwordStepPayloadValidator = rt.Record({
  data: rt.Record({
    t: rt.Literal("password-step"),
    email: rt.String,
    password: rt.String,
    state: stateParam,
  }),
});
const codeStepPayloadValidator = rt.Record({
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
const totpStepPayloadValidator = rt.Record({
  data: rt.Record({
    t: rt.Literal("totp-step"),
    totp: rt.String,
    state: stateParam,
  }),
});
const refreshPayloadValidator = rt.Record({
  data: rt.Record({
    t: rt.Literal("refresh-tokens"),
    token: rt.String,
  }),
});
const invalidatePayloadValidator = rt.Record({
  data: rt.Array(
    rt.Record({
      t: rt.Union(
        rt.Literal("refresh-tokens"),
        rt.Literal("session-tokens"),
        rt.Literal("sessions")
      ),
      value: rt.String,
    })
  ),
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
  r: Pick<AppDeps, "io" | "config" | "log">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      Http.assertAuthdReq(req);

      const val = codeStepPayloadValidator.validate(req.body);
      if (!val.success) {
        throw new E.BadRequest(baseErr + `Error: ${val.message}`);
      }

      const response: Auth.Api.Responses<ClientRoles, UserRoles>["POST /sessions/login/code"] =
        await logInWithEmailCode(val.value.data, req.get("user-agent"), req.auth, { ...r, log });

      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

export const handlePostSessionsLoginTotp = (
  r: Pick<AppDeps, "io" | "config" | "log">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      Http.assertAuthdReq(req);

      const val = totpStepPayloadValidator.validate(req.body);
      if (!val.success) {
        throw new E.BadRequest(baseErr + `Error: ${val.message}`);
      }

      const response: Auth.Api.Responses<ClientRoles, UserRoles>["POST /sessions/login/totp"] =
        await logInWithTotp(val.value.data, req.get("user-agent"), req.auth, { ...r, log });

      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

export const handlePostSessionsRefresh = (
  r: Pick<AppDeps, "io" | "config" | "log">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      Http.assertAuthdReq(req);

      const val = refreshPayloadValidator.validate(req.body);
      if (!val.success) {
        throw new E.BadRequest(baseErr + `Error: ${val.message}`);
      }

      const response: Auth.Api.Responses<ClientRoles, UserRoles>["POST /sessions/refresh"] = {
        data: await refreshSession(val.value.data, req.auth, { ...r, log }),
      };

      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

export const handlePostSessionsLogout = (
  r: Pick<AppDeps, "io" | "config" | "log">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    try {
      const log = Http.logger(r.log, req, res);

      Http.assertAuthdReq(req);

      let data: rt.Static<typeof invalidatePayloadValidator>["data"];
      if (req.body && Object.keys(req.body).length > 0) {
        const val = invalidatePayloadValidator.validate(req.body);
        if (!val.success) {
          throw new E.BadRequest(baseErr + `Error: ${val.message}`);
        }
        data = val.value.data;
      } else {
        // If we didn't pass in a session and we don't have a user attached to the request, we can't
        // log anything out.
        if (!req.auth.u) {
          throw new E.BadRequest(
            `This endpoint requires either an array of session artifacts to invalidate or a ` +
              `valid session token passed as a credential. You passed neither.`,
            `NO-SESSION-TO-INVALIDATE`
          );
        }

        data = [
          {
            t: "sessions",
            value: req.auth.u.sid,
          },
        ];
      }

      await invalidateSession(data, req.auth, { ...r, log });

      const response: Auth.Api.Responses<ClientRoles, UserRoles>["POST /sessions/invalidate"] = {
        data: null,
      };

      res.status(200).send(response);
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

export const refreshSession = async (
  payload: rt.Static<typeof refreshPayloadValidator>["data"],
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "log" | "config" | "io">
): Promise<Auth.Api.Authn.Session> => {
  r.log.notice(`Attempting to refresh an existing session`);

  // Validate initial input
  if (!payload.token.match(/^[a-fA-F0-9]{64}$/)) {
    throw new E.Unauthorized(
      `Your refresh token does not meet our requirements. Please be sure you're using a token ` +
        `generated by our system. Try logging in again.`,
      `INVALID-REFRESH-TOKEN`
    );
  }

  const tokenSha256 = createHash("sha256").update(payload.token).digest();

  // Get from db and validate more
  const token = await r.io.get("session-tokens", { tokenSha256 }, r.log);
  if (!token) {
    throw new E.Unauthorized(
      `The refresh token you've passed is not valid. Please log in again.`,
      `REFRESH-TOKEN-INVALID`
    );
  }
  if (token.type !== "refresh") {
    throw new E.Unauthorized(
      `The refresh token you've passed is not valid. Please log in again.`,
      `REFRESH-TOKEN-INVALID`
    );
  }
  if (token.expiresMs < Date.now()) {
    throw new E.Unauthorized(
      `Refresh token has expired. Please try logging in again.`,
      `REFRESH-TOKEN-EXPIRED`
    );
  }
  if (token.consumedMs !== null) {
    throw new E.Unauthorized(
      `Refresh token has already been used and may only be used once. Please try logging in again.`,
      `REFRESH-TOKEN-CONSUMED`
    );
  }
  if (token.invalidatedMs !== null) {
    throw new E.Unauthorized(
      `Refresh token has been invalidated. Please try logging in again.`,
      `REFRESH-TOKEN-INVALIDATED`
    );
  }

  // Get the session and also validate that
  const session = await r.io.get("sessions", { id: token.sessionId }, r.log, true);
  if (session.expiresMs < Date.now()) {
    throw new E.Unauthorized(
      `Session has expired. Please try logging in again.`,
      `SESSION-EXPIRED`
    );
  }
  if (session.invalidatedMs !== null) {
    throw new E.Unauthorized(
      `Session has been invalidated. Please try logging in again.`,
      `SESSION-INVALIDATED`
    );
  }

  // Generate and save new tokens, and consume refresh token
  const refreshToken = randomBytes(32).toString("hex");
  const sessionToken = randomBytes(32).toString("hex");
  await Promise.all([
    r.io.save(
      "session-tokens",
      {
        type: "session",
        tokenSha256: createHash("sha256").update(sessionToken).digest(),
        sessionId: token.sessionId,
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
        sessionId: token.sessionId,
        expiresMs: Date.now() + 1000 * 60 * 60 * r.config.expires.sessionHour,
      },
      auth,
      r.log
    ),
    r.io.update("session-tokens", tokenSha256, { consumedMs: Date.now() }, auth, r.log),
  ]);

  // Return structured data
  return {
    t: "session",
    token: sessionToken,
    refresh: refreshToken,
  };
};

/**
 * This function accepts an array of session artifacts, which may be session tokens, refresh tokens,
 * or session ids. For each, it must validate the artifact, ensure that the calling user is
 * authorized to invalidate the associated session, then invalidate the session.
 *
 * @param payload An array of objects representing various session artifacts. These may either be
 * session ids or resolvable to session ids.
 * @param auth A standard request info object containing the auth information associated with the
 * request.
 * @param r Dependencies for the request.
 */
export const invalidateSession = async (
  payload: rt.Static<typeof invalidatePayloadValidator>["data"],
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "log" | "config" | "io">
): Promise<void> => {
  r.log.notice(`Attempting to log out ${payload.length} session(s)`);

  // Make sure auth object is the right paradigm
  Common.assertAuth(auth);

  // Parallelize invalidation operations
  const p: Array<Promise<unknown>> = payload.map(async (val) => {
    let token: undefined | Auth.Db.SessionToken = undefined;

    // Normalize to session id
    let sessionId: string;
    if (val.t === "sessions") {
      sessionId = val.value;
    } else {
      const tokenSha256 = createHash("sha256").update(val.value).digest();

      // Get from db and validate more
      token = await r.io.get("session-tokens", { tokenSha256 }, r.log);
      if (!token) {
        throw new E.Unauthorized(`The token you've passed is not valid.`, `TOKEN-INVALID`);
      }
      if (token.expiresMs < Date.now()) {
        throw new E.Unauthorized(`Token has expired.`, `TOKEN-EXPIRED`);
      }
      if (token.type === "refresh" && token.consumedMs !== null) {
        throw new E.Unauthorized(
          `Refresh token has already been used and may only be used once.`,
          `REFRESH-TOKEN-CONSUMED`
        );
      }
      if (token.invalidatedMs !== null) {
        throw new E.Unauthorized(`Token has been invalidated.`, `TOKEN-INVALIDATED`);
      }

      sessionId = token.sessionId;
    }

    // Get and validate the session
    r.log.info(`Retrieving session from database`);
    const session = await r.io.get("sessions", { id: sessionId }, r.log, false);
    if (!session) {
      // If no session returned, log this and continue
      r.log.warning(
        `No session returned for session id ${sessionId}. Seems weird, but continuing anyway.`
      );
      return;
    }

    // Make sure the requesting user owns the session or, if not, that the requesting user has
    // adequate permissions
    r.log.info(`Validating persmissions for logout of session id ${sessionId}`);
    let proceed = Common.isInternalSystemClient(auth.r, auth.a, r.log);

    // If we haven't been green-lighted by the client, maybe the user still has permission
    if (!proceed && auth.u) {
      r.log.info(`Request made with user session attached. Checking permissions.`);
      if (auth.u.id === session.userId) {
        r.log.notice(`Session ${sessionId} owned by calling user. Proceeding to invalidate.`);
        proceed = true;
      } else {
        r.log.info(`Session ${sessionId} not owned by calling user. Checking permissions.`);
        if (auth.u.r.includes(UserRoles.SYSADMIN) || auth.u.r.includes(UserRoles.EMPLOYEE)) {
          r.log.notice(`Calling user is a sysadmin or employee. Proceeding.`);
          proceed = true;
        } else {
          r.log.notice(`Calling user is not a sysadmin or employee.`);
        }
      }
    }

    // If we don't have permissions, then don't proceed
    if (!proceed) {
      r.log.notice(`Request has insufficient permissions to invalidate session ${sessionId}`);
      return;
    }

    // Now invalidate the session associated with this token and invalidate and/or consume related
    // tokens
    const p1: Array<Promise<unknown>> = [];
    p1.push(r.io.update("sessions", sessionId, { invalidatedMs: Date.now() }, auth, r.log));
    if (token && token.type === "refresh") {
      p1.push(
        r.io.update("session-tokens", token.tokenSha256, { consumedMs: Date.now() }, auth, r.log)
      );
    }

    // Wait for the invalidation operations to finish
    await Promise.all(p1);
  });

  // Now wait for all of the promises to resolve
  await Promise.all(p);
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
  r: Pick<AppDeps, "io" | "log" | "config">
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
    r.log.info(`2fa enabled for user. Sending back totp step.`);
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
    r.log.info(`2fa not enabled for user. Sending back session.`);
    return { data: await createSession(user.id, userAgent, auth, {}, r) };
  }
};

export const logInWithEmailCode = async (
  payload: rt.Static<typeof codeStepPayloadValidator>["data"],
  userAgent: string | undefined,
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "io" | "log" | "config">
): Promise<Auth.Api.Responses<ClientRoles, UserRoles>["POST /sessions/login/code"]> => {
  // Get and validate user
  const [user, email] = await getAndValidateUserForLoginCode(payload.code, payload.state, r);

  // Handle 2fa, if necessary
  if (user["2fa"] === 1) {
    // If 2fa enabled, generate a code and send back a step
    r.log.info(`2fa enabled for user. Sending back totp step.`);
    const code = await generateCode("login", email.email, payload.state, auth, r);
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
    r.log.info(`2fa not enabled for user. Sending back session.`);
    return { data: await createSession(user.id, userAgent, auth, {}, r) };
  }
};

export const logInWithTotp = async (
  payload: rt.Static<typeof totpStepPayloadValidator>["data"],
  userAgent: string | undefined,
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "io" | "log" | "config">
): Promise<Auth.Api.Responses<ClientRoles, UserRoles>["POST /sessions/login/code"]> => {
  throw new E.NotImplemented(`TOTP flows are not yet implemented.`);
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

const getAndValidateUserForLoginCode = async (
  _code: string,
  state: string,
  r: Pick<AppDeps, "io" | "log">
): Promise<[Auth.Db.User, Auth.Db.Email]> => {
  // Validate code
  if (!_code.match(/^[a-fA-F0-9]{64}$/)) {
    r.log.warning(
      `Invalid login code passed: ${
        _code.length > 100 ? `${_code.substr(0, 100)}...(length: ${_code.length})` : _code
      }`
    );
    throw new E.BadRequest(
      `The login code you've does not match the standard format. Make sure you pass a code that ` +
        `was actually generated by our system....`,
      `INVALID-LOGIN-CODE-FORMAT`
    );
  }

  // Now do a deeper validation of the code
  const code = await r.io.get(
    "verification-codes",
    { codeSha256: Buffer.from(_code, "hex") },
    r.log
  );
  if (!code) {
    throw new E.Unauthorized(
      `Code '${_code}' not found. Please try logging in again.`,
      `CODE-NOT-FOUND`
    );
  }
  if (code.type !== "login") {
    throw new E.Unauthorized(
      `Code '${_code}' is not a login code. Please try logging in again.`,
      `CODE-NOT-VALID-TYPE`
    );
  }
  if (code.userGeneratedToken !== state) {
    throw new E.Unauthorized(
      `Code '${_code}' not valid. Please try logging in again.`,
      `CODE-NOT-VALID`
    );
  }
  if (code.expiresMs < Date.now()) {
    throw new E.Unauthorized(
      `Code '${_code}' has expired. Please try logging in again.`,
      `CODE-EXPIRED`
    );
  }
  if (code.consumedMs !== null) {
    throw new E.Unauthorized(
      `Code '${_code}' has already been used. Please try logging in again.`,
      `CODE-CONSUMED`
    );
  }
  if (code.invalidatedMs !== null) {
    throw new E.Unauthorized(
      `Code '${_code}' has been invalidated. Please try logging in again.`,
      `CODE-INVALIDATED`
    );
  }

  // Get the email object for the code
  const email = await r.io.get("emails", { email: code.email }, r.log, true);
  const user = await r.io.get("users", { id: email.userId }, r.log, true);

  // Validate that the user is not banned or deleted
  if (user.bannedMs !== null) {
    throw new E.Forbidden(`Sorry, this user has been banned.`, `USER-BANNED`);
  }
  if (user.deletedMs !== null) {
    throw new E.Forbidden(`Sorry, this user has been deleted.`, `USER-DELETED`);
  }

  return [user, email];
};

let throttle: Throttle | null = null;
const getThrottle = (r: Pick<AppDeps, "config" | "log">) => {
  if (!throttle) {
    throttle = new Throttle(r.log, r.config.authn.throttle);
  }
  return throttle;
};
