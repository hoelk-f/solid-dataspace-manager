import React, { useEffect, useState } from "react";
import session, { setLoginReturnTo, getSharedRedirectUrlForLogin } from "./solidSession";
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

const App = () => {
  const [webId, setWebId] = useState("");
  const [sessionActive, setSessionActive] = useState(false);

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

  const loginToSolid = async (issuer) => {
    if (!issuer) return;
    setLoginReturnTo();
    await session.login({
      oidcIssuer: issuer,
      redirectUrl: getSharedRedirectUrlForLogin(),
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

  return (
    <BrowserRouter>
      <div className="layout">
        <Sidebar />
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
