import * as bcrypt from "bcryptjs";
import * as rt from "runtypes";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Auth } from "@wymp/types";
import * as E from "@wymp/http-errors";
import * as Http from "@wymp/http-utils";
import { AppDeps, UserRoles, ClientRoles } from "../../Types";
import * as T from "../../Translators";
import * as Common from "./Common";
import { addEmail } from "./Emails";
import { createSession } from "./Sessions";

/**
 *
 *
 *
 *
 * Handlers
 *
 *
 *
 *
 */

/** GET /users */
export const getUsers = (r: Pick<AppDeps, "log" | "io" | "authz">): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      // Authorize
      Http.authorize(req, r.authz["GET /users(/:id)"], log);

      // Get response
      const users = await r.io.getUsers(undefined, Http.getCollectionParams(req.query), log);
      const response: Auth.Api.Responses<ClientRoles, UserRoles>["GET /users"] = {
        ...users,
        data: await addRoles(
          users.data.map((u) => T.Users.dbToApi(u, log)),
          r
        ),
      };

      // Send response
      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

/** GET /users/:id */
export const getUserById = (
  r: Pick<AppDeps, "log" | "io" | "authz">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      // Make sure it's an authd request so we can access the auth object
      Http.assertAuthdReq(req);

      // Get user id
      const userId = getDealiasedUserIdFromReq(req, log);

      // If the user is not requesting their own user object, then this requires authorization
      if (userId !== undefined && userId !== req.auth.u?.id) {
        Http.authorize(req, r.authz["GET /users(/:id)"], log);
      }

      // Get and send response
      const user = await r.io.getUserById(userId, r.log, true);
      const response: Auth.Api.Responses<ClientRoles, UserRoles>["GET /users/:id"] = {
        t: "single",
        data: await addRoles(T.Users.dbToApi(user), r),
      };
      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

/** POST /users */
const PostUser = rt.Record({
  data: rt.Record({
    name: rt.String,
    email: rt.String,
    password: rt.Optional(rt.String),
    passwordConf: rt.Optional(rt.String),
    referrer: rt.Optional(rt.Union(rt.Null, rt.String)),
  }),
});
export const postUsers = (
  r: Pick<AppDeps, "config" | "log" | "io" | "authz" | "emailer">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      // Authorize
      Http.authorize(req, r.authz["POST /users"], log);

      // Validate
      const validation = PostUser.validate(req.body);
      Common.throwOnInvalidBody(validation);
      const user = validation.value.data;

      // Get and validate the referrer
      let referrer = req.auth.c;
      if (user.referrer) {
        if (!(await r.io.getClientById(user.referrer, log))) {
          throw new E.BadRequest(
            `Unknown Referrer '${user.referrer}'. The referrer must be a valid client known to ` +
              `system`,
            `USER-CREATE.INVALID-REFERRER`
          );
        }
        referrer = user.referrer;
      }

      // Create user, obtaining session
      const session = await createUser(user, req.get("user-agent"), referrer, req.auth, {
        ...r,
        log,
      });

      // Return session in response
      const response: Auth.Api.Responses<ClientRoles, UserRoles>["POST /users"] = { data: session };
      res.status(201).send(response);
    } catch (e) {
      next(e);
    }
  };
};

/** PATCH /users/:id */
export const patchUsers = (r: Pick<AppDeps, "log" | "io">): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      Http.assertAuthdReq(req);

      // Get user id
      const userId = getDealiasedUserIdFromReq(req, log);

      // If the user is not requesting their own user object, then this requires authorization
      if (userId !== undefined && userId !== req.auth.u?.id) {
        // This operation is only available to sysadmin users
        Http.authorize(req, [[null, null, UserRoles.SYSADMIN, null]], log);
      }

      // Validate body
      const validation = PatchUserValidator.validate(req.body);
      Common.throwOnInvalidBody(validation);
      const payload = validation.value.data;

      const user = await r.io.updateUser(
        userId,
        {
          // Name and 2fa are the only two editable attributes, so we're just adding them directly
          // to avoid dirty payloads
          ...(payload.name ? { name: payload.name } : {}),
          ...(payload["2fa"] !== undefined ? { "2fa": Number(payload["2fa"]) as 0 | 1 } : {}),
        },
        req.auth,
        log
      );

      const response: Auth.Api.Responses<ClientRoles, UserRoles>["PATCH /users/:id"] = {
        t: "single",
        data: await addRoles(T.Users.dbToApi(user), { ...r, log }),
      };
      res.send(response);
    } catch (e) {
      next(e);
    }
  };
};

const PatchUserValidator = rt.Record({
  data: rt.Record({
    name: rt.Optional(rt.String),
    "2fa": rt.Optional(rt.String),
  }),
});

/**
 * POST /users/:id/change-password
 */
export const postChangePasswordHandler = (
  r: Pick<AppDeps, "io" | "log">
): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      Http.assertAuthdReq(req);

      // Get user id
      const userId = getDealiasedUserIdFromReq(req, log);

      // If the user is not requesting their own user object, then this requires authorization
      if (userId !== undefined && userId !== req.auth.u?.id) {
        // This operation is only available to sysadmin users
        Http.authorize(req, [[null, null, UserRoles.SYSADMIN, null]], log);
      }

      // Validate body
      const validation = PostChangePasswordValidator.validate(req.body);
      Common.throwOnInvalidBody(validation);
      const payload = validation.value.data;

      // Hand back to function
      await changeUserPassword(userId, payload, req.auth, { ...r, log });

      res.send({ data: null });
    } catch (e) {
      next(e);
    }
  };
};

const ForgotPasswordValidator = rt.Record({
  type: rt.Literal("forgot-password"),
  token: rt.String,
  newPassword: rt.String,
});
const ChangePasswordValidator = rt.Record({
  type: rt.Literal("change-password"),
  currentPassword: rt.Union(rt.String, rt.Null),
  newPassword: rt.Union(rt.String, rt.Null),
});
const PostChangePasswordValidator = rt.Record({
  data: rt.Union(ForgotPasswordValidator, ChangePasswordValidator),
});

/** DELETE /users/:id */
export const deleteUsers = (r: Pick<AppDeps, "log" | "io">): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      Http.assertAuthdReq(req);

      // Get user id
      const userId = getDealiasedUserIdFromReq(req, log);

      // If the user is not requesting their own user object, then this requires authorization
      if (userId !== undefined && userId !== req.auth.u?.id) {
        // This operation is only available to sysadmin users
        Http.authorize(req, [[null, null, UserRoles.SYSADMIN, null]], log);
      }

      // Do the deletion
      await r.io.updateUser(userId, { deletedMs: Date.now() }, req.auth, log);

      // Return response
      const response: Auth.Api.Responses<ClientRoles, UserRoles>["DELETE /users/:id"] = {
        data: null,
      };
      res.send(response);
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

/**
 * Create a user and return a session for the user
 *
 * TODO: Break into smaller pieces for better testing
 */
export const createUser = async (
  postUser: Auth.Api.PostUser,
  userAgent: string | undefined,
  referrer: string | undefined,
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "config" | "log" | "io" | "emailer" | "onCreateUser">
): Promise<Auth.Api.Authn.Session> => {
  r.log.debug(`Called createUser`);

  const obstructions: Array<E.ObstructionInterface> = [];

  // Check to see if payload looks good
  if (!postUser.email.match(new RegExp(r.config.emailRegex, "i"))) {
    obstructions.push({
      code: "Invalid Email",
      text: "The email address you've provided doesn't appear valid according to our standards.",
      params: {
        input: postUser.email,
        regex: r.config.emailRegex,
      },
    });
  }
  if (postUser.email.length > 255) {
    obstructions.push({
      code: "Email Too Long",
      text:
        "Sorry, while your email address is probably valid, it won't fit in our database. " +
        "Please try with an email address less than 255 characters in length.",
    });
  }

  if (postUser.password) {
    // Strength
    obstructions.push(...checkPasswordStrength(postUser.password));

    // Confirmation
    if (!postUser.passwordConf) {
      obstructions.push({
        code: "Missing Password Confirmation",
        text: "You must fill out the 'Password confirmation' (passwordConf) field",
      });
    } else {
      if (postUser.password !== postUser.passwordConf) {
        obstructions.push({
          code: "Invalid Password Confirmation",
          text: "The password confirmation you passed doesn't match the password you've specified",
        });
      }
    }
  }

  if (obstructions.length > 0) {
    const e = new E.BadRequest("Couldn't create user", "USER_DATA_INVALID");
    e.obstructions = obstructions;
    throw e;
  }

  // Check to see if user already exists
  if (await r.io.getEmailByAddress(postUser.email, r.log)) {
    const e = new E.DuplicateResource("A user with this email already exists", "DUPLICATE");
    e.obstructions = [
      {
        code: "Duplicate User",
        text:
          `Email ${postUser.email} is already registered to a user in our system. Please try ` +
          `logging in.`,
      },
    ];
    throw e;
  }

  r.log.info(`New user passed validation`);

  // Hash password, if present
  let passwordBcrypt: string | null = null;
  if (postUser.password) {
    r.log.debug(`Hashing password`);
    passwordBcrypt = await bcrypt.hash(postUser.password, 10);
  }

  // Insert user into database
  const user = await r.io.saveUser(
    {
      name: postUser.name,
      passwordBcrypt,
      createdMs: Date.now(),
    },
    auth,
    r.log
  );

  const [_a, _b, _c, session] = await Promise.all([
    // Insert login email
    addEmail(postUser.email, user.id, "creation", auth, r),

    // Insert default user role
    r.io.saveUserRole({ roleId: UserRoles.USER, userId: user.id }, auth, r.log),

    // Associate referrer with user
    r.io.saveUserClient({ clientId: referrer || auth.c, userId: user.id }, auth, r.log),

    // Create a new session
    createSession(user.id, userAgent, auth, {}, r),
  ]);

  // If we've got an `onCreateUser` hook, send the user data to it
  if (r.onCreateUser) {
    r.log.notice(`\`onCreateUser\` hook provided. Calling it with user data.`);
    await r
      .onCreateUser(
        {
          ...user,
          email: postUser.email,
        },
        r
      )
      .catch((e) => r.log.error(`\`onCreateUser\` hook failed! Error: ${e.message}`));
  }

  // Return the session
  return session;
};

export const checkPasswordStrength = (pw: string): Array<E.ObstructionInterface> => {
  const o: Array<E.ObstructionInterface> = [];

  // Length
  let m: Array<string> | null = null;
  if (pw.length < 8) {
    o.push({
      code: "Password",
      text: "Must be at least 8 characters long",
    });
  }
  if (pw.length > 72) {
    o.push({
      code: "Password",
      text: "Cannot exceed 72 characters",
    });
  }

  // If it's not a super long password, we'll require additional features
  if (pw.length < 26) {
    m = pw.match(/([a-z])/);
    if (m === null || m.length < 2) {
      o.push({
        code: "Password",
        text: "Must have at least 2 lower-case letters",
      });
    }
    m = pw.match(/([A-Z])/);
    if (m === null || m.length < 2) {
      o.push({
        code: "Password",
        text: "Must have at least 2 upper-case letters",
      });
    }
    m = pw.match(/([0-9])/);
    if (m === null || m.length < 2) {
      o.push({
        code: "Password",
        text: "Must have at least 2 numbers",
      });
    }
    m = pw.match(/([^a-zA-Z0-9])/);
    if (m === null || m.length < 2) {
      o.push({
        code: "Password",
        text: "Must have at least 2 non alpha-numeric characters",
      });
    }
  }

  return o;
};

/**
 * Change the given user's password
 */
export const changeUserPassword = async (
  userId: string,
  payload: rt.Static<typeof PostChangePasswordValidator>["data"],
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "log" | "io">
): Promise<void> => {
  const user = await r.io.getUserById(userId, r.log, true);

  if (payload.type === "forgot-password") {
    // "Forgot password" flow
    throw new E.NotImplemented(`The "forgot password" flow is not yet implemented.`);
  } else {
    // "Change password" flow
    // Check to see if the current password is correct
    const check =
      user.passwordBcrypt === null
        ? payload.currentPassword === null || payload.currentPassword === ""
        : payload.currentPassword !== null &&
          (await bcrypt.compare(payload.currentPassword, user.passwordBcrypt));
    if (!check) {
      throw new E.Unauthorized(
        `You did pass the correct existing password`,
        `CHANGE-PASSWORD_INCORRECT-CURRENT-PASSWORD`
      );
    }
  }

  // Hash password
  let passwordBcrypt: string | null = null;
  if (payload.newPassword !== null && payload.newPassword !== "") {
    r.log.debug(`Hashing password`);
    passwordBcrypt = await bcrypt.hash(payload.newPassword, 10);
  }

  // Update records
  await r.io.updateUser(userId, { passwordBcrypt }, auth, r.log);
};

/**
 * Use the database to get one or more users' roles and then add them to the corresponding user
 * record for return via the API.
 */
declare interface AddRoles {
  (user: Auth.Api.User<UserRoles>, r: Pick<AppDeps, "io" | "log">): Promise<
    Auth.Api.User<UserRoles>
  >;
  (users: Array<Auth.Api.User<UserRoles>>, r: Pick<AppDeps, "io" | "log">): Promise<
    Array<Auth.Api.User<UserRoles>>
  >;
}
const addRoles: AddRoles = async (userOrUsers, r): Promise<any> => {
  const userIds = Array.isArray(userOrUsers) ? userOrUsers.map((u) => u.id) : [userOrUsers.id];
  const roles = await r.io.getUserRoles({ _t: "filter", userIdIn: userIds }, undefined, r.log);

  const add = (user: Auth.Api.User<UserRoles>): Auth.Api.User<UserRoles> => {
    user.roles = roles.data.filter((row) => row.userId === user.id).map((row) => row.roleId);
    return user;
  };

  return Array.isArray(userOrUsers) ? userOrUsers.map(add) : add(userOrUsers);
};

/**
 * Use data from an Authd Request to get a de-aliased user id. This expects the endpoint to be set
 * up with the id in a param called `id`.
 *
 * This is an operation that is repeated for various endpoints, so it makes sense to abstract it.
 */
export const getDealiasedUserIdFromReq = (
  req: Auth.AuthdReq<{ params: { id?: string } }>,
  log: AppDeps["log"]
): string => {
  let userId = req.params.id;

  // Require valid userId
  if (!userId) {
    throw new E.InternalServerError(
      `Programmer: this functionality is expecting req.params.id to be set, but it is not.`
    );
  }

  // Possibly de-alias
  if (userId === "current") {
    const uid = req.auth.u?.id;
    if (!uid) {
      throw new E.BadRequest(
        `You must send this request with a session token in order to use the 'current' alias`,
        `CURRENT-ALIAS-NO-USER`
      );
    }
    userId = uid;
    log.info(`De-aliasing 'current' user id to '${userId}'`);
  }

  return userId;
};
