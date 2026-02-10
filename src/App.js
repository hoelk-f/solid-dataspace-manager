import React, { useEffect, useState } from "react";
import session from "./solidSession";
import "./App.css";
import "@hoelk-f/solid-data-manager/embed.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import { DataManagerEmbed, setSession as setDataManagerSession } from "@hoelk-f/solid-data-manager/embed";
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
} from "./solidCatalog";
import { dataManagerVersion } from "./versions";

const App = () => {
  const [webId, setWebId] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);

  useEffect(() => {
    document.title = "Solid Dataspace";
    if (session.info.isLoggedIn) {
      const w = session.info.webId;
      if (w) {
        setWebId(w);
        setSessionActive(true);
      }
    }
  }, []);

  useEffect(() => {
    setDataManagerSession(session);
  }, []);

  useEffect(() => {
    const checkProfileCompleteness = async () => {
      if (!sessionActive || !webId) return;
      setCheckingProfile(true);
      try {
        const { getSolidDataset, getThing, getThingAll, getStringNoLocale, getUrl, getUrlAll } =
          await import("@inrupt/solid-client");
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
          `${getStringNoLocale(me, VCARD.given_name) || ""} ${getStringNoLocale(me, VCARD.family_name) || ""}`.trim();
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
        let missingCatalog = true;
        try {
          const catalogUrl = await resolveCatalogUrl(webId, session.fetch);
          if (catalogUrl) {
            await getSolidDataset(catalogUrl.split("#")[0], { fetch: session.fetch });
            missingCatalog = false;
          }
        } catch {
          missingCatalog = true;
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

  const loginToSolid = async (issuer) => {
    if (!issuer) return;
    await session.login({
      oidcIssuer: issuer,
      redirectUrl: window.location.href,
      clientName: "Solid Dataspace",
    });
  };

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
  }  if (onboardingRequired) {
    return (
      <div className="container">
        <OnboardingWizard
          webId={webId}
          onComplete={() => setOnboardingRequired(false)}
          onCancel={async () => {
            await session.logout({ logoutType: "app" });
            window.location.reload();
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

  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar webId={webId} />
        <div className="main">
          <div className="container">
            <Routes>
              <Route path="/" element={<DataManagerPage />} />
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
