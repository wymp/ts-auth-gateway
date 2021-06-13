import * as E from "@wymp/http-errors";

export const InvalidBodyError = (val: { key?: string; message: string }) => {
  return new E.BadRequest(
    `The body of your request does not appear to conform to the documented input for this ` +
      `endpoint. Please read the docs.\n\nError: ${val.key ? `${val.key}: ` : ``}${val.message}`
  );
};
