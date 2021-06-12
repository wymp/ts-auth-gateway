import { AppDeps } from "../../Types";
import { IoInterface } from "./Types";

export const register = (r: Pick<AppDeps, "http" | "log"> & { io: IoInterface }) => {
  r.log.notice(`Registering Accounts Module`);
};
