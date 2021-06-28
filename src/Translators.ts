import { Translator } from "@wymp/http-utils";
import { Auth } from "@wymp/types";
import { UserRoles } from "./Types";

export const Organizations = new Translator<Auth.Db.Organization, Auth.Api.Organization>(
  "/accounts/v1",
  "organizations",
  {
    name: "attr",
    createdMs: "attr",
    memberships: [null, "memberships"],
  }
);

export const Users = new Translator<Auth.Db.User, Auth.Api.User<UserRoles>>(
  "/accounts/v1",
  "users",
  {
    name: "attr",
    banned: "attr",
    deleted: "attr",
    "2fa": "attr",
    roles: "attr",
    createdMs: "attr",
    memberships: [null, "memberships"],
  },
  (from: "db" | "api", k: string, v: unknown) => {
    if (["banned", "deleted", "2fa"].includes(k)) {
      return from === "db" ? !!Number(v) : Number(v);
    }
    return v;
  }
);
