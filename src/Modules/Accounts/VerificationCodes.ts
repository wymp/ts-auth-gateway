import { randomBytes, createHash } from "crypto";
import * as E from "@wymp/http-errors";
import { Auth } from "@wymp/types";
import { AppDeps, Db } from "../../Types";

export const sendCode = async (
  params:
    | { type: "signup" | "verification" }
    | {
        type: "login";
        userGeneratedToken: string;
      },
  toEmail: string,
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "log" | "emailer" | "config" | "io">
): Promise<void> => {
  const code = await generateCode(
    params.type === "login" ? "login" : "verification",
    toEmail,
    params.type === "login" ? params.userGeneratedToken : null,
    auth,
    r
  );

  if (r.emailer) {
    r.log.info(`Sending ${params.type} email`);
    if (params.type === "login") {
      await r.emailer.sendLoginEmail(
        code,
        params.userGeneratedToken,
        r.config.emails.from,
        toEmail,
        r.log
      );
    } else {
      if (params.type === "signup") {
        await r.emailer.sendSignupEmail(code, r.config.emails.from, toEmail, r.log);
      } else {
        await r.emailer.sendVerificationEmail(code, r.config.emails.from, toEmail, r.log);
      }
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
  const code = randomBytes(32);

  // Save code to db
  r.log.debug(`Saving ${type} code`);
  await r.io.saveVerificationCode(
    {
      type,
      codeSha256: createHash("sha256").update(code).digest(),
      email: email.toLowerCase(),
      userGeneratedToken,
      expiresMs:
        Date.now() +
        r.config.expires[type === "login" ? "loginCodeMin" : "emailVerCodeMin"] * 60 * 1000,
    },
    auth,
    r.log
  );

  // Return the raw code
  return code.toString("hex");
};

export const verifyEmail = async (
  email: string,
  rawCodeHexOrBuffer: string | Buffer,
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "log" | "io">
): Promise<Db.Email> => {
  // Get the sha256 representation of the code
  const codeSha256 = createHash("sha256")
    .update(
      typeof rawCodeHexOrBuffer === "string"
        ? Buffer.from(rawCodeHexOrBuffer, "hex")
        : rawCodeHexOrBuffer
    )
    .digest();

  // Get the code from the database
  const codeRecord = await r.io.getVerificationCodeBySha256(codeSha256, r.log);

  if (
    !codeRecord ||
    codeRecord.type !== "verification" ||
    codeRecord.email !== email.toLowerCase()
  ) {
    throw new E.NotFound(
      `Sorry, it appears that you've passed an invalid verification code. Please try to execute ` +
        `the email verification flow again.`,
      `EMAIL-VERIFY-INVALID-CODE`
    );
  }

  // Make sure the code is not consumed, expired or invalidated
  if (codeRecord.consumedMs !== null) {
    throw new E.BadRequest(
      `This email verification code has already been consumed. You shouldn't need to take any ` +
        `additional action.`,
      `EMAIL-VERIFY-CODE-CONSUMED`
    );
  }
  if (codeRecord.expiresMs < Date.now()) {
    throw new E.BadRequest(
      `This email verification code has expired. Please try the verification flow again to get a ` +
        `fresh code`,
      `EMAIL-VERIFY-CODE-EXPIRED`
    );
  }
  if (codeRecord.invalidatedMs !== null) {
    throw new E.BadRequest(
      `This email verification code has been invalidated. Please try the verification flow again ` +
        `to get a fresh code`,
      `EMAIL-VERIFY-CODE-INVALIDATED`
    );
  }

  // If nothing is wrong, then let's go ahead and mark the email verified and consume the code
  const updatedEmail = await r.io.updateEmail(email, { verifiedMs: Date.now() }, auth, r.log);
  await r.io.updateVerificationCode(codeSha256, { consumedMs: Date.now() }, auth, r.log);

  return updatedEmail;
};
