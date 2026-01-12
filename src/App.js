import React, { useEffect, useState } from "react";
import session from "./solidSession";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import DataManager from "./components/DataManager";
import ExternalHost from "./components/ExternalHost";
import Info from "./components/Info";
import LoginScreen from "./components/LoginScreen";
import ProfilePage from "./components/ProfilePage";
import Notifications from "./components/Notifications";
import DecisionInbox from "./components/DecisionInbox";
import OnboardingWizard from "./components/OnboardingWizard";
import { resolveCatalogUrl } from "./solidCatalog";

const App = () => {
  const [webId, setWebId] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);

  useEffect(() => {
    document.title = "Solid Dataspace Manager";
    if (session.info.isLoggedIn) {
      const w = session.info.webId;
      if (w) {
        setWebId(w);
        setSessionActive(true);
      }
    }
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

        setOnboardingRequired(missingBasics || missingEmail || missingInbox || missingCatalog);
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
      clientName: "Solid Dataspace Manager",
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
        <div style={{ padding: "24px 8px" }}>Checking profile...</div>
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
            await session.logout({ logoutType: "app" });
            window.location.reload();
          }}
        />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar webId={webId} />
        <div className="main">
          <div className="container">
            <Routes>
              <Route path="/" element={<DataManager webId={webId} />} />
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
