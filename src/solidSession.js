import { Session } from "@inrupt/solid-client-authn-browser";

const SHARED_SESSION_ID = "solid-dataspace";
const KEY_CURRENT_SESSION = "solidClientAuthn:currentSession";
const STORAGE_PREFIX = "solidClientAuthenticationUser:";

const session = new Session({
  clientName: "Solid Dataspace Manager",
  sessionId: SHARED_SESSION_ID,
});

const ensureRedirectUrl = () => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.has("code") || url.searchParams.has("state")) return;
  const nextUrl = url.toString();
  const sameOrigin = (value) => {
    try {
      return new URL(value).origin === window.location.origin;
    } catch {
      return false;
    }
  };
  const currentSessionId = window.localStorage.getItem(KEY_CURRENT_SESSION);
  const sessionIds = new Set(
    [SHARED_SESSION_ID, currentSessionId].filter(Boolean)
  );
  sessionIds.forEach((sessionId) => {
    try {
      const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${sessionId}`);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data.redirectUrl || !sameOrigin(data.redirectUrl)) {
        data.redirectUrl = nextUrl;
      } else if (data.redirectUrl !== nextUrl) {
        data.redirectUrl = nextUrl;
      }
      window.localStorage.setItem(
        `${STORAGE_PREFIX}${sessionId}`,
        JSON.stringify(data)
      );
    } catch {}
  });
};

export async function restoreSession() {
  ensureRedirectUrl();
  await session.handleIncomingRedirect({
    restorePreviousSession: true,
    url: window.location.href,
  });
  return session;
}

export default session;
