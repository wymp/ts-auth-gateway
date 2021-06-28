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
 * /

/** GET /users/:id/roles * /
export const getRoles = (r: Pick<AppDeps, "log" | "io">): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      let userId = req.params.userId;
      if (!userId) {
        throw new E.InternalServerError(
          `Programmer: this functionality is expecting req.params.userId to be set, but it is ` +
            `not.`
        );
      }

      // Our authorization for this will be a bit complex, so we're doing a basic assertion for now
      assertAuthdReq(req);
      if (!req.auth.u) {
        throw new E.Unauthorized(
          `You must pass a valid session token in order to access this functionality.`
        );
      }

      // De-alias user id, if necessary
      if (userId === "current") {
        userId = req.auth.u.id;
      }

      // Make sure that only the owner and Openfinance employees can do this
      if (userId !== req.auth.u.id) {
        authorize(
          req,
          [[Globals.ClientRoles.INTERNAL, null, Globals.UserRoles.EMPLOYEE, null]],
          log
        );
      }

      const response = await getUserRoles(
        userId,
        { pg: req.query.pg, sort: req.query.sort },
        { ...r, log }
      );

      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

/** POST /users/:id/roles * /
const PostRoles = rt.Record({
  data: rt.Array(
    rt.Record({
      type: rt.Literal("user-roles"),
      roleId: rt.String,
    })
  ),
});

export const postRoles = (r: Pick<AppDeps, "log" | "io">): SimpleHttpServerMiddleware => {
  return async (req, res, next) => {
    const log = Http.logger(r.log, req, res);
    try {
      let userId = req.params.userId;
      if (!userId) {
        throw new E.InternalServerError(
          `Programmer: this functionality is expecting req.params.userId to be set, but it is ` +
            `not.`
        );
      }

      // For now, we want to make sure that only Openfinance sysadmins can adjust user roles
      authorize(req, [[Globals.ClientRoles.INTERNAL, null, Globals.UserRoles.SYSADMIN, null]], log);

      // De-alias user id, if necessary
      if (userId === "current") {
        userId = req.auth.u!.id;
      }

      // Validate body structure
      const validation = PostRoles.validate(req.body);
      if (!validation.success) {
        throw new E.BadRequest(
          `The body of your request does not appear to conform to the documented input for this ` +
            `endpoint. Please read the docs: https://docs.openfinance.io/system/v3/api.html.\n\n` +
            `Error: ${validation.key ? `${validation.key}: ` : ``}${validation.message}`
        );
      }
      const newRoles = validation.value.data;

      // Now process the roles
      const response = await addUserRoles(userId, newRoles, req.auth, { ...r, log });

      // And return the result
      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

/** DELETE /users/:id/roles * /
export const deleteRoles = (r: Pick<AppDeps, "log">): SimpleHttpServerMiddleware => {
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
 * /

/**
 * Get user access roles, optionally paginated
 * /
export const getUserRoles = async (
  userId: string,
  params: CollectionParams,
  r: Pick<AppDeps, "log" | "io">
): Promise<CollectionResult<Auth.Api.UserRole>> => {
  // Make sure user exists
  await r.io.getResource<Auth.Db.User, "id">("users", { t: "id", v: userId }, r.log, true);

  // Get from database
  const response = await r.io.getRolesForUser(userId, params, r.log);

  // Transform into api format
  const roles: Array<Auth.Api.UserRole> = [];
  for (const role of response.data) {
    roles.push(UserRolesLib.dbToApi(role));
  }

  // Return with metadata
  return {
    data: roles,
    meta: response.meta,
  };
};

/**
 * Add new user access roles
 * /
const addUserRoles = async (
  userId: string,
  newRoles: rt.Static<typeof PostRoles>["data"],
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "io" | "log">
): Promise<CollectionResult<Auth.Api.UserRole>> => {
  r.log.debug(`Processing ${newRoles.length} new roles`);

  // Make sure user exists
  await r.io.getResource<Auth.Db.User, "id">("users", { t: "id", v: userId }, r.log, true);

  // Make sure each passed role is a real role
  for (const role of newRoles) {
    if (!Object.values(Globals.UserRoles).includes(role.roleId as Globals.UserRoles)) {
      throw new E.BadRequest(
        `Role '${role.roleId}' is not a valid user role. Valid user roles are: '${Object.values(
          Globals.UserRoles
        ).join(`', '`)}'.`
      );
    }
  }

  // Insert into db
  await r.io.insertUserRoles(
    newRoles.map(role => {
      return {
        roleId: role.roleId as Globals.UserRoles,
        userId,
      };
    }),
    auth,
    r.log
  );

  // Get the new access roles collection
  return await getUserRoles(userId, {}, r);
};

const UserRolesLib = {
  dbToApi: (role: Auth.Db.UserRole): Auth.Api.UserRole => {
    return {
      type: "user-roles",
      roleId: role.roleId,
      user: { data: { type: "users", id: role.userId } },
    };
  },
};
*/
