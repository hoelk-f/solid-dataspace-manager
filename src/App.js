import React, { useEffect, useState } from "react";
import { getDefaultSession, login, handleIncomingRedirect } from "@inrupt/solid-client-authn-browser";
import "./App.css";
import "./LoginScreen.css";
import Profile from "./components/Profile";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faRightFromBracket, faLock } from "@fortawesome/free-solid-svg-icons";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import DataManager from "./components/DataManager";
import ExternalHost from "./components/ExternalHost";
import Info from "./components/Info";

const App = () => {
  const [webId, setWebId] = useState("");
  const [sessionActive, setSessionActive] = useState(false);

  useEffect(() => {
    document.title = "Solid Dataspace";
    handleIncomingRedirect({ restorePreviousSession: true }).then(() => {
      const session = getDefaultSession();
      if (session.info.isLoggedIn) {
        const w = session.info.webId;
        if (w) {
          setWebId(w);
          setSessionActive(true);
        }
      }
    });
  }, []);

  const loginToSolid = async (issuer) => {
    if (!issuer) return;
    await login({
      oidcIssuer: issuer,
      redirectUrl: window.location.href,
      clientName: "Solid Data Manager",
    });
  };

  if (!sessionActive) {
    return (
      <div className="container">
        <LoginScreen onLogin={loginToSolid} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar />
        <div className="main">
          <div className="container">
            <Routes>
              <Route path="/" element={<DataManager webId={webId} />} />
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

function ProfilePage({ webId }) {
  const navigate = useNavigate();
  return (
    <>
      <div className="toolbar">
        <div className="crumb">
          <FontAwesomeIcon icon={faUser} className="crumb-icon" />
          <span>Profile Manager</span>
        </div>
      </div>
      <div className="profile-panel">
        <Profile webId={webId} onClose={() => navigate("/")} />
      </div>
    </>
  );
}

function LoginScreen({ onLogin }) {
  const providers = [
    { label: "TMDT Solid", url: "https://tmdt-solid-community-server.de", note: "Recommended" },
    { label: "Solid Community", url: "https://solidcommunity.net", note: "Public community server" },
  ];
  const [selected, setSelected] = useState(providers[0].url);
  const [customIssuer, setCustomIssuer] = useState("");
  const useCustom = customIssuer.trim().length > 0;
  const issuerToLogin = useCustom ? customIssuer.trim() : selected;
  return (
    <div className="login-wrap">
      <div className="login-hero">
        <div className="login-hero-left">
          <div className="login-hero-icon">
            <FontAwesomeIcon icon={faLock} />
          </div>
          <div>
            <div className="login-hero-title">Solid Dataspace Connector</div>
            <div className="login-hero-sub">Choose your Solid Pod provider</div>
          </div>
        </div>
      </div>
      <div className="login-card">
        <div className="login-section">
          <div className="provider-guide">
            <div className="provider-guide-head">
              <span className="guide-title">No Solid Pod yet?</span>
              <span className="guide-sub">Example using the <strong>TMDT Solid Server</strong></span>
            </div>
            <div className="guide-steps">
              <div className="guide-step">
                <span className="step-num">1</span>
                <p>
                  Visit <a href="https://tmdt-solid-community-server.de" target="_blank" rel="noreferrer">tmdt-solid-community-server.de</a> or any other Solid Pod Provider.
                </p>
              </div>
              <div className="guide-step">
                <span className="step-num">2</span>
                <p>Click <strong>Register</strong> to create your account.</p>
              </div>
              <div className="guide-step">
                <span className="step-num">3</span>
                <p>Log in and choose a name to create your Pod.</p>
              </div>
              <div className="guide-step">
                <span className="step-num">4</span>
                <p>Come back here, pick the provider and sign in with your new Pod.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="login-section">
          <div className="section-head">
            <span className="section-title">Suggested providers</span>
            <span className="section-hint">Pick a card or use “Custom issuer” below</span>
          </div>
          <div className="provider-grid">
            {providers.map((p) => {
              const isActive = selected === p.url && !useCustom;
              return (
                <button
                  key={p.url}
                  type="button"
                  className={"prov-card" + (isActive ? " active" : "")}
                  onClick={() => {
                    setSelected(p.url);
                    setCustomIssuer("");
                  }}
                  title={p.url}
                >
                  <span className={"radio" + (isActive ? " on" : "")} aria-hidden />
                  <div className="prov-text">
                    <div className="prov-label">{p.label}</div>
                    <div className="prov-url">{p.url}</div>
                    <div className="prov-note">{p.note}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="login-section">
          <div className="section-head">
            <span className="section-title">Custom issuer</span>
            <span className="section-hint">OIDC issuer URL of your Pod provider</span>
          </div>
          <div className="custom-row">
            <input
              className="custom-input"
              placeholder="https://your-pod-provider.example"
              value={customIssuer}
              onChange={(e) => setCustomIssuer(e.target.value)}
            />
            {useCustom && (
              <button
                type="button"
                className="clear-btn"
                onClick={() => setCustomIssuer("")}
                title="Back to provider list"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <div className="login-footer">
          <div className="login-meta">
            <span className="dot" /> Solid OIDC Login
          </div>
          <button
            className="login-primary"
            onClick={() => onLogin(issuerToLogin)}
            disabled={!issuerToLogin}
            title="Log in with selected provider"
          >
            <FontAwesomeIcon icon={faRightFromBracket} />
            <span>Login</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
