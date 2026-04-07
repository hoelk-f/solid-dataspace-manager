import { Session } from "@inrupt/solid-client-authn-browser";

const session = new Session();

export async function restoreSession() {
  await session.handleIncomingRedirect({ restorePreviousSession: true });
  return session;
}

export default session;