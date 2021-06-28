import { Auth } from "@wymp/types";
import { AppDeps } from "../../Types";
import { sendCode } from "./VerificationCodes";

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
 * /

/** POST /users/:id/login-emails * /
export const postLoginEmails = (r: Pick<AppDeps, "log">): SimpleHttpServerMiddleware => {
  return (req, res, next) => {
    next(new E.NotImplemented(`${req.method} ${req.path} is not yet implemented`));
  };
};

/** DELETE /users/:id/login-emails * /
export const deleteLoginEmails = (r: Pick<AppDeps, "log">): SimpleHttpServerMiddleware => {
  return (req, res, next) => {
    next(new E.NotImplemented(`${req.method} ${req.path} is not yet implemented`));
  };
};

*/

export const addEmail = async (
  email: string,
  userId: string,
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "log" | "emailer" | "io" | "config">
): Promise<void> => {
  // Save email to database
  r.io.save(
    "emails",
    {
      email,
      userId,
      verifiedMs: null,
      createdMs: Date.now(),
    },
    auth,
    r.log
  );

  // Send verification code, if we have an emailer to do that with
  if (r.emailer) {
    await sendCode("verification", email, auth, r);
  } else {
    r.log.warning(`No emailer configured. Not sending verificaiton code for new email.`);
  }
};
