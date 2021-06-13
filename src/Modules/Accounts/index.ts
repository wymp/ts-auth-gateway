import { AppDeps } from "../../Types";
import { IoInterface } from "./Types";
import * as Organizations from "./Organizations";

export const register = (
  r: Pick<AppDeps, "http" | "log" | "io" | "authz"> & { io: IoInterface }
) => {
  r.log.notice(`Registering Accounts Module`);

  r.log.notice(`HTTP: GET    /organizations(/:id)`);
  r.http.get(["/organizations", "/organizations/:id"], Organizations.getOrganizations(r));

  r.log.notice(`HTTP: POST   /organizations`);
  r.http.post("/organizations", Organizations.postOrganizations(r));
};
