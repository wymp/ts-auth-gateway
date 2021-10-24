import { Translator as T } from "@wymp/http-utils";
import { Auth } from "@wymp/types";
import { UserRoles } from "./Types";

export const Organizations = new T.Translator<Auth.Db.Organization, Auth.Api.Organization>(
  "/accounts/v1",
  "organizations",
  {
    name: "attr",
    createdMs: "attr",
    memberships: [null, "memberships"],
  }
);

export const Users = new T.Translator<Auth.Db.User, Auth.Api.User<UserRoles>>(
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

export const Emails = new T.Translator<Auth.Db.Email, Auth.Api.Email>("/accounts/v1/", "emails", {
  verifiedMs: "attr",
  createdMs: "attr",
  user: ["userId", "users"],
});

/**
 * An OrgMembership translator to translate between DB format and API format. Note that
 * OrgMemberships have booleans, so it's necessary to convert back and forth using a transformer
 * function. This object should be tested!!
 */
export const OrgMemberships = new T.Translator<Auth.Db.OrgMembership, Auth.Api.OrgMembership>(
  "/accounts/v1/org-memberships",
  "org-memberships",
  {
    read: "attr",
    edit: "attr",
    manage: "attr",
    delete: "attr",
    user: ["userId", "users"],
    organization: ["organizationId", "organizations"],
  },
  (from: "db" | "api", fieldName: string, val: unknown) => {
    if (["read", "edit", "manage", "delete"].includes(fieldName)) {
      return from === "db" ? Boolean(val) : Number(val);
    }
    return val;
  }
);
