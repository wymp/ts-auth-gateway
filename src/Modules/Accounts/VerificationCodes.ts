import { randomBytes, createHash } from "crypto";
import { Auth } from "@wymp/types";
import { AppDeps } from "../../Types";

export const sendCode = async (
  type: "login" | "verification",
  email: string,
  auth: Auth.ReqInfo,
  r: Pick<AppDeps, "log" | "emailer" | "config" | "io">
) => {
  r.log.notice(`Generating a new code for ${type}`);

  // Generate code
  const code = randomBytes(32).toString("hex");

  // Save code to db
  await r.io.save(
    "verification-codes",
    {
      type,
      codeSha256: createHash("sha256").update(code).digest(),
      email,
      userGeneratedToken: null,
      expiresMs:
        r.config.expires[type === "login" ? "loginCodeMin" : "emailVerCodeMin"] * 60 * 1000,
    },
    auth,
    r.log
  );

  if (r.emailer) {
    const text = r.config.emails.templateFiles[type === "login" ? "login" : "emailVerCode"].replace(
      /\$\{code\}/g,
      code
    );
    await r.emailer.send(
      {
        t: "simple",
        to: email,
        from: r.config.emails.from,
        text,
      },
      r.log
    );
  } else {
    r.log.warning(`No emailer configured. Not sending verificaiton code for new email.`);
  }
};
