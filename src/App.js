import React, { useCallback, useEffect, useState } from "react";
import session from "./solidSession";
import "@hoelk-f/solid-data-manager/embed.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import {
  DataManagerEmbed,
  setSession as setDataManagerSession,
} from "@hoelk-f/solid-data-manager/embed";
import "@hoelk-f/semantic-data-catalog/embed.css";
import {
  CatalogEmbed as SemanticDataCatalogEmbed,
  setSession as setCatalogSession,
  catalogVersion,
} from "@hoelk-f/semantic-data-catalog/embed";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBookOpen } from "@fortawesome/free-solid-svg-icons";
import "./App.css";
import ExternalHost from "./components/ExternalHost";
import Info from "./components/Info";
import LoginScreen from "./components/LoginScreen";
import ProfilePage from "./components/ProfilePage";
import Notifications from "./components/Notifications";
import DecisionInbox from "./components/DecisionInbox";
import TransactionHistory from "./components/TransactionHistory";
import OnboardingWizard from "./components/OnboardingWizard";
import {
  buildDefaultPrivateRegistry,
  loadRegistryConfig,
  resolveCatalogUrl,
  SDP_CATALOG,
} from "./solidCatalog";
import { dataManagerVersion } from "./versions";

const AUTH_BRIDGE_KEY = "__SOLID_DATASPACE_AUTH__";

const App = () => {
  const [webId, setWebId] = useState(session.info.webId || "");
  const [sessionActive, setSessionActive] = useState(
    Boolean(session.info.isLoggedIn && session.info.webId)
  );
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);

  const getAuthState = useCallback(() => {
    return {
      isLoggedIn: Boolean(session.info.isLoggedIn),
      webId: session.info.webId || null,
    };
  }, []);

  const syncLocalStateFromSession = useCallback(() => {
    const auth = getAuthState();
    setSessionActive(auth.isLoggedIn);
    setWebId(auth.webId || "");
  }, [getAuthState]);

  const loginToSolid = useCallback(async (issuer) => {
    if (!issuer) return;

    await session.login({
      oidcIssuer: issuer,
      redirectUrl: `${window.location.origin}/`,
      clientName: "Solid Dataspace",
    });
  }, []);

  const logoutFromSolid = useCallback(async () => {
    await session.logout({ logoutType: "app" });
    setWebId("");
    setSessionActive(false);
    setOnboardingRequired(false);
  }, []);

  useEffect(() => {
    document.title = "Solid Dataspace";
    syncLocalStateFromSession();
  }, [syncLocalStateFromSession]);

  useEffect(() => {
    setDataManagerSession(session);
    setCatalogSession(session);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const listeners = new Set();

    const bridge = {
      source: "solid-dataspace-manager",
      version: 1,
      isReady: true,

      getState: () => getAuthState(),

      getFetch: () => session.fetch.bind(session),

      login: async (issuer) => {
        await loginToSolid(issuer);
      },

      logout: async () => {
        await logoutFromSolid();
      },

      subscribe: (callback) => {
        listeners.add(callback);
        return () => listeners.delete(callback);
      },

      notify: () => {
        const snapshot = getAuthState();

        listeners.forEach((callback) => {
          try {
            callback(snapshot);
          } catch (err) {
            console.error("Bridge listener failed:", err);
          }
        });

        window.dispatchEvent(
          new CustomEvent("solid-dataspace-auth-change", {
            detail: snapshot,
          })
        );
      },
    };

    window[AUTH_BRIDGE_KEY] = bridge;
    bridge.notify();

    return () => {
      if (window[AUTH_BRIDGE_KEY] === bridge) {
        delete window[AUTH_BRIDGE_KEY];
      }
    };
  }, [getAuthState, loginToSolid, logoutFromSolid]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bridge = window[AUTH_BRIDGE_KEY];
    bridge?.notify?.();
  }, [webId, sessionActive]);

  useEffect(() => {
    const checkProfileCompleteness = async () => {
      if (!sessionActive || !webId) return;

      setCheckingProfile(true);
      try {
        const {
          getSolidDataset,
          getThing,
          getThingAll,
          getStringNoLocale,
          getUrl,
          getUrlAll,
        } = await import("@inrupt/solid-client");
        const { FOAF, VCARD, LDP } = await import("@inrupt/vocab-common-rdf");

        const profileDocUrl = webId.split("#")[0];
        const ds = await getSolidDataset(profileDocUrl, { fetch: session.fetch });

        let me = getThing(ds, webId) || getThingAll(ds).find((t) => t.url === webId);

        if (!me) {
          setOnboardingRequired(true);
          return;
        }

        const name =
          getStringNoLocale(me, VCARD.fn) ||
          getStringNoLocale(me, FOAF.name) ||
          `${getStringNoLocale(me, VCARD.given_name) || ""} ${
            getStringNoLocale(me, VCARD.family_name) || ""
          }`.trim();

        const org = getStringNoLocale(me, VCARD.organization_name) || "";
        const role = getStringNoLocale(me, VCARD.role) || "";
        const inbox = getUrl(me, LDP.inbox) || "";

        const emailUris = getUrlAll(me, VCARD.hasEmail) || [];
        const collected = [];

        emailUris.forEach((uri) => {
          if (uri.startsWith("mailto:")) {
            collected.push(uri.replace(/^mailto:/, ""));
          } else {
            const emailThing = getThing(ds, uri);
            const mailto = emailThing ? getUrl(emailThing, VCARD.value) : "";
            if (mailto && mailto.startsWith("mailto:")) {
              collected.push(mailto.replace(/^mailto:/, ""));
            }
          }
        });

        const directEmails = (getUrlAll(me, VCARD.email) || [])
          .filter(Boolean)
          .map((uri) => uri.replace(/^mailto:/, ""));

        const allEmails = [...collected, ...directEmails].filter(Boolean);

        const missingBasics = !(name && org && role);
        const missingEmail = allEmails.length === 0;
        const missingInbox = !inbox;

        const profileCatalog = getUrl(me, SDP_CATALOG) || "";
        let missingCatalog = !profileCatalog;
        if (profileCatalog) {
          try {
            await getSolidDataset(profileCatalog.split("#")[0], { fetch: session.fetch });
            missingCatalog = false;
          } catch {
            missingCatalog = true;
          }
        } else {
          try {
            const catalogUrl = await resolveCatalogUrl(webId, session.fetch);
            if (catalogUrl) {
              await getSolidDataset(catalogUrl.split("#")[0], { fetch: session.fetch });
            }
          } catch {
            // Keep onboarding required until the new profile predicate is present.
          }
        }

        let missingRegistry = false;
        try {
          const registryConfig = await loadRegistryConfig(webId, session.fetch);
          if (registryConfig.mode === "private") {
            const privateRegistry = (
              registryConfig.privateRegistry || buildDefaultPrivateRegistry(webId)
            ).trim();
            missingRegistry = !privateRegistry;
          } else {
            missingRegistry = !(registryConfig.registries || []).length;
          }
        } catch {
          missingRegistry = true;
        }

        setOnboardingRequired(
          missingBasics || missingEmail || missingInbox || missingCatalog || missingRegistry
        );
      } catch (err) {
        console.error("Profile completeness check failed:", err);
        setOnboardingRequired(true);
      } finally {
        setCheckingProfile(false);
      }
    };

    checkProfileCompleteness();
  }, [sessionActive, webId]);

  if (!sessionActive) {
    return (
      <div className="container">
        <LoginScreen onLogin={loginToSolid} />
      </div>
    );
  }

  if (checkingProfile) {
    return (
      <div className="container">
        <div className="loading-screen">
          <div className="loading-card">
            <div className="loading-content">
              <div className="loading-eyebrow">Solid Dataspace</div>
              <div className="loading-title">Checking profile</div>
              <p className="loading-subtitle">
                We are connecting to your Solid Pod and verifying required profile details.
              </p>
              <div className="loading-bar" role="progressbar" aria-label="Checking profile">
                <span className="loading-bar__fill"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (onboardingRequired) {
    return (
      <div className="container">
        <OnboardingWizard
          webId={webId}
          onComplete={() => setOnboardingRequired(false)}
          onCancel={async () => {
            await logoutFromSolid();
          }}
        />
      </div>
    );
  }

  const DataManagerPage = () => (
    <div className="data-manager-embed">
      <DataManagerEmbed webId={webId} />
      <div className="data-manager-footer">
        Solid Data Manager {dataManagerVersion}
      </div>
    </div>
  );

  const CatalogPage = () => (
    <div className="data-catalog-embed">
      <div className="catalog-header toolbar--title">
        <div className="crumb">
          <FontAwesomeIcon icon={faBookOpen} className="crumb-icon" />
          <span>Semantic Data Catalog</span>
        </div>
      </div>
      <SemanticDataCatalogEmbed webId={webId} />
      <div className="catalog-footer">
        Semantic Data Catalog {catalogVersion}
      </div>
    </div>
  );

  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar webId={webId} />
        <div className="main">
          <div className="container">
            <Routes>
              <Route path="/" element={<DataManagerPage />} />
              <Route path="/catalog" element={<CatalogPage />} />
              <Route path="/transactions" element={<TransactionHistory webId={webId} />} />
              <Route path="/notifications" element={<Notifications webId={webId} />} />
              <Route path="/decisions" element={<DecisionInbox webId={webId} />} />
              <Route path="/profile" element={<ProfilePage webId={webId} />} />
              <Route path="/info" element={<Info />} />
              <Route path="/web/:slug" element={<ExternalHost />} />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
};

export default App;
