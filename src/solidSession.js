import { Session } from "@inrupt/solid-client-authn-browser";

const SHARED_SESSION_ID = "solid-dataspace";
const STORAGE_KEY = `solidClientAuthenticationUser:${SHARED_SESSION_ID}`;

const session = new Session({
  clientName: "Solid Dataspace Manager",
  sessionId: SHARED_SESSION_ID,
});

const ensureRedirectUrl = () => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (url.searchParams.has("code") || url.searchParams.has("state")) return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    const nextUrl = url.toString();
    if (data.redirectUrl !== nextUrl) {
      data.redirectUrl = nextUrl;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {}
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
