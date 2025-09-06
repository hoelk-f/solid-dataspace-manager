import { Session } from "@inrupt/solid-client-authn-browser";

// Use the browser's sessionStorage so that the authentication state for the
// Solid Dataspace Manager does not interfere with other apps running on the
// same origin. The session is kept for the lifetime of the tab and restored on
// refresh.
const sessionStorageWrapper = {
  get: async (key) =>
    typeof window === "undefined"
      ? undefined
      : window.sessionStorage.getItem(key) ?? undefined,
  set: async (key, value) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(key, value);
    }
  },
  delete: async (key) => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(key);
    }
  },
};

const session = new Session({
  clientName: "Solid Dataspace Manager",
  sessionId: "dataspace-manager",
  secureStorage: sessionStorageWrapper,
  insecureStorage: sessionStorageWrapper,
});

export async function restoreSession() {
  if (typeof window === "undefined") return session;
  await session.handleIncomingRedirect(window.location.href, {
    restorePreviousSession: true,
  });
  return session;
}

export default session;
