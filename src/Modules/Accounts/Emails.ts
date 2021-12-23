import * as rt from "runtypes";
import { SimpleHttpServerMiddleware } from "@wymp/ts-simple-interfaces";
import { Auth } from "@wymp/types";
import * as E from "@wymp/http-errors";
import * as Http from "@wymp/http-utils";
import * as T from "../../Translators";
import { AppDeps, ClientRoles, UserRoles } from "../../Types";
import { InvalidBodyError } from "../Lib";
import { getDealiasedUserIdFromReq } from "./Users";
import { sendCode, verifyEmail } from "./VerificationCodes";

/**
 *
 *
 *
 *
 * Request handlers
 *
 *
 *
 *
 */

/** GET /users/:id/emails */
export const getUserEmailsHandler = (
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
        Http.authorize(req, r.authz["GET /users/:id/roles"], log);
      }

      // Verify that user exists
      await r.io.getUserById(userId, log, true);

      // Get and send response
      const emails = await r.io.getEmailsForUser(userId, log);
      const response: Auth.Api.Responses<ClientRoles, UserRoles>["GET /users/:id/emails"] = {
        ...emails,
        data: emails.data.map((row) => T.Emails.dbToApi(row, log)),
      };
      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

/** POST /users/:id/emails */
export const postUserEmailHandler = (
  r: Pick<AppDeps, "log" | "io" | "config" | "authz" | "emailer">
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
        Http.authorize(req, r.authz["POST /users/:id/emails"], log);
      }

      // Validate
      const validation = PostEmail.validate(req.body);
      if (!validation.success) {
        throw InvalidBodyError(validation);
      }
      const emailAddr = validation.value.data.email;

      // Add user role
      const email = await addEmail(emailAddr, userId, req.auth, { ...r, log });

      // Get all user roles and return as response
      const response: Auth.Api.Responses<ClientRoles, UserRoles>["POST /users/:id/emails"] = {
        t: "single",
        data: T.Emails.dbToApi(email, log),
      };
      res.status(201).send(response);
    } catch (e) {
      next(e);
    }
  };
};

const PostEmail = rt.Record({
  data: rt.Record({
    type: rt.Literal("emails"),
    email: rt.String,
  }),
});

/** DELETE /users/:id/emails/:id */
export const deleteUserEmailHandler = (
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
        Http.authorize(req, r.authz["DELETE /users/:id/emails/:id"], log);
      }

      // Get email from params an verify that it exists
      // TODO: Make sure the incoming email address has any weird characters correctly decoded
      const emailAddr = req.params.emailId?.toLowerCase();
      if (!emailAddr) {
        throw new E.InternalServerError(
          `Programmer: This handler is intended to be hooked up to an endpoint specified as ` +
            `follows: DELETE /users/:id/emails/:emailId. However, no emailId parameter was found.`
        );
      }
      const email = await r.io.getEmailByAddress(emailAddr, log);
      if (!email) {
        throw new E.NotFound(
          `This email address was not found among your registered email addresses.`,
          `EMAIL-DELETE-EMAIL-NOT-FOUND`
        );
      }

      // Verify that it's owned by the calling user, if applicable
      if (userId !== undefined && userId === req.auth.u?.id) {
        if (email.userId !== userId) {
          throw new E.NotFound(
            `This email address was not found among your registered email addresses.`,
            `EMAIL-DELETE-EMAIL-NOT-FOUND`
          );
        }
      }

      // Finally, delete and respond
      await r.io.deleteEmail(emailAddr, req.auth, log);

      const response: Auth.Api.Responses<ClientRoles, UserRoles>["DELETE /users/:id/emails/:id"] = {
        data: null,
      };
      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

/** POST /users/:id/emails/:id/generate-verification */
export const generateEmailVerificationHandler = (
  r: Pick<AppDeps, "log" | "io" | "authz" | "emailer" | "config">
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
        Http.authorize(req, r.authz["POST /users/:id/emails/:id/generate-verification"], log);
      }

      // Get email from params an verify that it exists
      // TODO: Make sure the incoming email address has any weird characters correctly decoded
      const emailAddr = req.params.emailId?.toLowerCase();
      if (!emailAddr) {
        throw new E.InternalServerError(
          `Programmer: This handler is intended to be hooked up to an endpoint specified as ` +
            `follows: POST /users/:id/emails/:emailId/generate-verification. However, no emailId ` +
            `parameter was found.`
        );
      }
      const email = await r.io.getEmailByAddress(emailAddr, log);
      if (!email) {
        throw new E.NotFound(
          `This email address was not found among your registered email addresses.`,
          `EMAIL-GEN-VER-EMAIL-NOT-FOUND`
        );
      }

      // Verify that it's owned by the calling user, if applicable
      if (userId !== undefined && userId === req.auth.u?.id) {
        if (email.userId !== userId) {
          throw new E.NotFound(
            `This email address was not found among your registered email addresses.`,
            `EMAIL-GEN-VER-EMAIL-NOT-FOUND`
          );
        }
      }

      // Verify that it's not already verified
      if (email.verifiedMs !== null) {
        throw new E.BadRequest(
          `This email address has already been verified. There's nothing more you need to do.`,
          `EMAIL-GEN-VER-ALREADY-VERIFIED`
        );
      }

      // Make sure we have an emailer
      if (!r.emailer) {
        throw new E.BadRequest(
          `This service does not have an email system in place, so we cannot verify your email ` +
            `at this time.`,
          `EMAIL-GEN-VER-NO-EMAILER`
        );
      }

      // Now send a verification code to the email and respond with "null"
      await sendCode("verification", emailAddr, null, req.auth, { ...r, log });

      const response: Auth.Api.Responses<
        ClientRoles,
        UserRoles
      >["POST /users/:id/emails/:id/generate-verification"] = {
        data: null,
      };
      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

/** POST /users/:id/emails/:id/verify */
export const verifyUserEmailHandler = (
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
        Http.authorize(req, r.authz["POST /users/:id/emails/:id/verify"], log);
      }

      // Get email from params an verify that it exists
      // TODO: Make sure the incoming email address has any weird characters correctly decoded
      const emailAddr = req.params.emailId?.toLowerCase();
      if (!emailAddr) {
        throw new E.InternalServerError(
          `Programmer: This handler is intended to be hooked up to an endpoint specified as ` +
            `follows: POST /users/:id/emails/:emailId/verify. However, no emailId parameter was found.`
        );
      }
      const email = await r.io.getEmailByAddress(emailAddr, log);
      if (!email) {
        throw new E.NotFound(
          `This email address was not found among your registered email addresses.`,
          `VERIFY-EMAIL-EMAIL-NOT-FOUND`
        );
      }

      // Verify that it's owned by the calling user, if applicable
      if (userId !== undefined && userId === req.auth.u?.id) {
        if (email.userId !== userId) {
          throw new E.NotFound(
            `This email address was not found among your registered email addresses.`,
            `VERIFY-EMAIL-EMAIL-NOT-FOUND`
          );
        }
      }

      // Verify that it's not already verified
      if (email.verifiedMs !== null) {
        throw new E.BadRequest(
          `This email address has already been verified. There's nothing more you need to do.`,
          `VERIFY-EMAIL-ALREADY-VERIFIED`
        );
      }

      // Validate payload
      const validation = VerifyEmailValidator.validate(req.body);
      if (!validation.success) {
        throw InvalidBodyError(validation);
      }
      const code = validation.value.data.code;

      // Now try to verify
      const updatedEmail = await verifyEmail(emailAddr, code, req.auth, { ...r, log });

      const response: Auth.Api.Responses<
        ClientRoles,
        UserRoles
      >["POST /users/:id/emails/:id/verify"] = {
        t: "single",
        data: T.Emails.dbToApi(updatedEmail),
      };
      res.status(200).send(response);
    } catch (e) {
      next(e);
    }
  };
};

const VerifyEmailValidator = rt.Record({
  data: rt.Record({
    type: rt.Literal("verification-codes"),
    code: rt.String,
  }),
});

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

export const addEmail = async (
  email: string,
  userId: string,
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "log" | "emailer" | "io" | "config">
): Promise<Auth.Db.Email> => {
  // Lower-case the incoming email address
  email = email.toLowerCase();

  // Validate against regex
  if (!new RegExp(r.config.emailRegex, "i").test(email)) {
    throw new E.BadRequest(
      `The email address you've provided does not meet our criteria for an acceptable email. ` +
        `Please try a different one. For reference, all emails much match the following regex: ` +
        r.config.emailRegex,
      `POST-EMAIL-UNACCEPTABLE-ADDRESS`
    );
  }

  // Make sure it doesn't already exist
  const existing = await r.io.getEmailByAddress(email, r.log);
  if (existing) {
    throw new E.DuplicateResource("This email is already being used.", "DUPLICATE-EMAIL");
  }

  // Save email to database
  const newEmail = r.io.saveEmail(
    {
      id: email,
      userId,
      verifiedMs: null,
      createdMs: Date.now(),
    },
    auth,
    r.log
  );

  // Send verification code, if we have an emailer to do that with
  if (r.emailer) {
    await sendCode("verification", email, null, auth, r);
  } else {
    r.log.warning(`No emailer configured. Not sending verificaiton code for new email.`);
  }

  return newEmail;
};
