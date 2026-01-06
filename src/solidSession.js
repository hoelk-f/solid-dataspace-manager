import { Session } from "@inrupt/solid-client-authn-browser";

const session = new Session({
  clientName: "Solid Dataspace Manager",
  sessionId: "solid-dataspace",
});

export async function restoreSession() {
  await session.handleIncomingRedirect({ restorePreviousSession: true });
  return session;
}

export default session;
