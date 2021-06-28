import { randomBytes, createHash } from "crypto";
import { Auth } from "@wymp/types";
import { AppDeps } from "../../Types";

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
