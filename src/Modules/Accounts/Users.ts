import * as bcrypt from "bcryptjs";
import * as rt from "runtypes";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Auth } from "@wymp/types";
import * as E from "@wymp/http-errors";
import * as Http from "@wymp/http-utils";
import { AppDeps, UserRoles, ClientRoles } from "../../Types";
import * as T from "../../Translators";
import { InvalidBodyError } from "../Lib";
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
      const users = await r.io.get("users", Http.getCollectionParams(req.query), log);
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

      // Require user for this call
      if (!req.auth.u) {
        throw new E.Forbidden(`You must log in to view user data.`);
      }

      // Get user id
      let userId = req.params.id;

      // Require valid userId
      if (!userId) {
        throw new E.InternalServerError(
          `Programmer: this functionality is expecting req.params.id to be set, but it is ` + `not.`
        );
      }

      // Possibly de-alias
      if (userId === "current") {
        userId = req.auth.u?.id;
        log.info(`De-aliasing 'current' user id to '${userId}'`);
      }

      // If the user is not requesting their own user object, then this requires authorization
      if (userId !== undefined && userId !== req.auth.u.id) {
        Http.authorize(req, r.authz["GET /users(/:id)"], log);
      }

      // Get and send response
      const user = await r.io.get("users", { id: userId }, r.log, true);
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
      if (!validation.success) {
        throw InvalidBodyError(validation);
      }
      const user = validation.value.data;

      // Get and validate the referrer
      let referrer = req.auth.c;
      if (user.referrer) {
        if (!(await r.io.get("clients", { id: user.referrer }, log))) {
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
export const patchUsers = (r: Pick<AppDeps, "log">): SimpleHttpServerMiddleware => {
  return (req, res, next) => {
    next(new E.NotImplemented(`${req.method} ${req.path} is not yet implemented`));
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
  r: Pick<AppDeps, "config" | "log" | "io" | "emailer">
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
  if (await r.io.get("emails", { email: postUser.email }, r.log)) {
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
  const user = await r.io.save(
    "users",
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
    addEmail(postUser.email, user.id, auth, r),

    // Insert default user role
    r.io.save("user-roles", { roleId: UserRoles.USER, userId: user.id }, auth, r.log),

    // Associate referrer with user
    r.io.save("user-clients", { clientId: referrer || auth.c, userId: user.id }, auth, r.log),

    // Create a new session
    createSession(user.id, userAgent, auth, {}, r),
  ]);

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
  const roles = await r.io.get("user-roles", { _t: "filter", userIdIn: userIds }, r.log);

  const add = (user: Auth.Api.User<UserRoles>): Auth.Api.User<UserRoles> => {
    user.roles = roles.data.filter((row) => row.userId === user.id).map((row) => row.roleId);
    return user;
  };

  return Array.isArray(userOrUsers) ? userOrUsers.map(add) : add(userOrUsers);
};
