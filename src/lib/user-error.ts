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

/**
 * Refusal for staff acting on an account their workspace didn't make (a
 * student or parent who signed up themselves, or one another workspace
 * made). Only the owner of the account, or the workspace that made it,
 * may reset its password, issue sign-in codes or delete it.
 */
export function assertWorkspaceManages(account: { managedByWorkspaceId: string | null }, workspaceId: string): void {
  if (account.managedByWorkspaceId !== workspaceId) {
    throw new UserError("This person manages their own account. They can reset their password from the sign-in page, or delete the account in their settings.");
  }
}
