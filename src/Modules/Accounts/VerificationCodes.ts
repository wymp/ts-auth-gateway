import { randomBytes, createHash } from "crypto";
import * as E from "@wymp/http-errors";
import { Auth } from "@wymp/types";
import { AppDeps } from "../../Types";

export const sendCode = async (
  type: "login" | "verification",
  email: string,
  userGeneratedToken: string | null,
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "log" | "emailer" | "config" | "io">
): Promise<void> => {
  const code = await generateCode(type, email, userGeneratedToken, auth, r);
  if (r.emailer) {
    r.log.info(`Sending ${type} email`);
    if (type === "login") {
      await r.emailer.sendLoginCode(code, r.config.emails.from, email, r.log);
    } else {
      await r.emailer.sendEmailVerificationCode(code, r.config.emails.from, email, r.log);
    }
  } else {
    r.log.warning(`No emailer configured. Not sending verificaiton code for new email.`);
  }
};

export const generateCode = async (
  type: "login" | "verification",
  email: string,
  userGeneratedToken: string | null,
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "log" | "config" | "io">
): Promise<string> => {
  r.log.notice(`Generating a new code for ${type}`);

  // Validate token
  if (userGeneratedToken !== null) {
    if (!userGeneratedToken.match(/^[a-fA-F0-9]{32}$/)) {
      throw new E.BadRequest(
        `User generated token does not match the given format: /^[a-fA-F0-9]{32}$/`
      );
    }
  }

  // Generate code
  const code = randomBytes(32).toString("hex");

  // Save code to db
  r.log.debug(`Saving ${type} code`);
  await r.io.save(
    "verification-codes",
    {
      type,
      codeSha256: createHash("sha256").update(code).digest(),
      email,
      userGeneratedToken,
      expiresMs:
        r.config.expires[type === "login" ? "loginCodeMin" : "emailVerCodeMin"] * 60 * 1000,
    },
    auth,
    r.log
  );

  // Return the raw code
  return code;
};
