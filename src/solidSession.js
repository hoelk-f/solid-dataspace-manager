import { Session } from "@inrupt/solid-client-authn-browser";

const session = new Session({
  clientName: "Solid Dataspace Manager",
  sessionId: "dataspace-manager",
});

export async function restoreSession() {
  await session.handleIncomingRedirect({ restorePreviousSession: true });
  return session;
}

export default session;
