/**
 * An error whose message is written for the person using the app. The
 * safe-action layer passes its message through as `serverError`; any other
 * error becomes "Something went wrong" so internals never leak.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}
