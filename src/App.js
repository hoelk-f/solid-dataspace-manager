import React, { useEffect, useState } from "react";
import {
  getDefaultSession,
  login,
  handleIncomingRedirect,
  fetch,
  logout,
} from "@inrupt/solid-client-authn-browser";
import {
  getSolidDataset,
  getContainedResourceUrlAll,
  deleteFile,
  deleteContainer,
  createContainerAt,
  overwriteFile,
} from "@inrupt/solid-client";
import "./App.css";
import Profile from "./Profile";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolder,
  faFileLines,
  faPlus,
  faUpload,
  faUser,
  faRightFromBracket,
  faPen,
  faTrash,
  faDownload,
  faArrowLeft,
} from "@fortawesome/free-solid-svg-icons";

// React Router
import { BrowserRouter, Routes, Route, Link, useNavigate } from "react-router-dom";

const App = () => {
  const [webId, setWebId] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);

  useEffect(() => {
    handleIncomingRedirect({ restorePreviousSession: true }).then(() => {
      const session = getDefaultSession();
      if (session.info.isLoggedIn) {
        const webId = session.info.webId;
        if (webId) {
          setWebId(webId);
          setSessionActive(true);
          const rootUrl = new URL(webId).origin + "/public/";
          setCurrentUrl(rootUrl);
          loadItems(rootUrl);
        }
      }
    });
  }, []);

  useEffect(() => {
    const preventDefaults = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const dropHandler = async (e) => {
      preventDefaults(e);
      const files = e.dataTransfer.files;
      const uploadPromises = Array.from(files).map(async (file) => {
        const targetUrl = currentUrl + file.name;
        try {
          await overwriteFile(targetUrl, file, {
            contentType: file.type,
            fetch: fetch,
          });
        } catch (err) {
          console.error(`Fehler beim Hochladen von ${file.name}`, err);
        }
      });
      await Promise.all(uploadPromises);
      loadItems(currentUrl);
    };

    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) =>
      window.addEventListener(eventName, preventDefaults, false)
    );

    window.addEventListener("drop", dropHandler);
    return () => {
      ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) =>
        window.removeEventListener(eventName, preventDefaults, false)
      );
      window.removeEventListener("drop", dropHandler);
    };
  }, [currentUrl]);

  // Login mit frei wählbarem Issuer
  const loginToSolid = async (issuer) => {
    if (!issuer) return;
    await login({
      oidcIssuer: issuer,
      redirectUrl: window.location.href,
      clientName: "Solid Pod Manager",
    });
  };

  const logoutFromSolid = async () => {
    await logout();
    setSessionActive(false);
    setItems([]);
  };

  const loadItems = async (url) => {
    try {
      setLoading(true);
      const dataset = await getSolidDataset(url, { fetch: fetch });
      const containedUrls = getContainedResourceUrlAll(dataset);
      setItems(containedUrls);
    } catch (err) {
      console.error("Fehler beim Laden:", err);
    } finally {
      setLoading(false);
    }
  };

  const navigateTo = (url) => {
    const nextUrl = url.endsWith("/") ? url : url + "/";
    setCurrentUrl(nextUrl);
    loadItems(nextUrl);
  };

  const createFolder = async () => {
    const name = prompt("Ordnername?");
    if (!name) return;
    const folderUrl = currentUrl + name + "/";
    try {
      await createContainerAt(folderUrl, { fetch: fetch });
      loadItems(currentUrl);
    } catch (e) {
      alert("Fehler beim Erstellen des Ordners.");
    }
  };

  const deleteItem = async (url) => {
    if (!window.confirm("Wirklich löschen?")) return;
    try {
      if (url.endsWith("/")) {
        await deleteContainer(url, { fetch: fetch });
      } else {
        await deleteFile(url, { fetch: fetch });
      }
      loadItems(currentUrl);
    } catch (e) {
      alert("Löschen fehlgeschlagen.");
    }
  };

  const renameItem = async (url) => {
    const newName = prompt("Neuer Name?");
    if (!newName) return;
    const newUrl = currentUrl + newName + (url.endsWith("/") ? "/" : "");
    try {
      const res = await fetch(url);
      const data = await res.blob();
      await overwriteFile(newUrl, data, {
        contentType: res.headers.get("Content-Type") || "application/octet-stream",
        fetch: fetch,
      });
      if (url.endsWith("/")) await deleteContainer(url, { fetch });
      else await deleteFile(url, { fetch });
      loadItems(currentUrl);
    } catch (e) {
      alert("Fehler beim Umbenennen.");
    }
  };

  const uploadFile = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      const targetUrl = currentUrl + file.name;
      try {
        await overwriteFile(targetUrl, file, {
          contentType: file.type,
          fetch: fetch,
        });
        loadItems(currentUrl);
      } catch (e) {
        alert("Fehler beim Hochladen.");
      }
    };
    input.click();
  };

  const downloadFile = async (fileUrl) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileUrl.split("/").pop();
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error("Download-Fehler:", error);
      alert("Fehler beim Herunterladen.");
    }
  };

  const goBack = () => {
    if (!currentUrl) return;
    const url = new URL(currentUrl);
    let path = url.pathname;
    if (path === "/public/" || path === "/") return;
    const parts = path.split("/").filter((p) => p);
    parts.pop();
    const parentPath = "/" + parts.join("/") + "/";
    const parentUrl = url.origin + parentPath;
    setCurrentUrl(parentUrl);
    loadItems(parentUrl);
  };

  // --------- UI ----------
  if (!sessionActive) {
    return (
      <div className="container">
        <LoginScreen onLogin={loginToSolid} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="container">
        {/* HEADER */}
        <div className="app-header">
          <div className="brand">
            <span className="brand-title">Solid Pod Manager</span>
          </div>
          <div className="header-actions">
            <Link to="/profile" className="icon-circle" title="Profil">
              <FontAwesomeIcon icon={faUser} />
            </Link>
            <button onClick={logoutFromSolid} className="icon-pill danger" title="Logout">
              <FontAwesomeIcon icon={faRightFromBracket} />
              <span>Logout</span>
            </button>
          </div>
        </div>

        <Routes>
          <Route
            path="/"
            element={
              <FilesView
                currentUrl={currentUrl}
                items={items}
                loading={loading}
                createFolder={createFolder}
                uploadFile={uploadFile}
                navigateTo={navigateTo}
                renameItem={renameItem}
                deleteItem={deleteItem}
                downloadFile={downloadFile}
                goBack={goBack}
              />
            }
          />
          <Route path="/profile" element={<ProfilePage webId={webId} />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

// -------- Unterkomponenten --------

function FilesView({
  currentUrl,
  items,
  loading,
  createFolder,
  uploadFile,
  navigateTo,
  renameItem,
  deleteItem,
  downloadFile,
  goBack,
}) {
  return (
    <>
      <div className="toolbar">
        <div className="crumb">
          <FontAwesomeIcon icon={faFolder} className="crumb-icon" />
          <span>All files</span>
        </div>

        <div className="primary-actions">
          <button onClick={createFolder} className="pill-btn" title="Neuen Ordner erstellen">
            <FontAwesomeIcon icon={faPlus} /> <span>Folder</span>
          </button>
          <button onClick={uploadFile} className="pill-btn" title="Datei hochladen">
            <FontAwesomeIcon icon={faUpload} /> <span>Upload</span>
          </button>
        </div>
      </div>

      {loading ? (
        <p>Lade Inhalte...</p>
      ) : (
        <>
          <table className="file-table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="th-actions">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {items.map((url) => {
                const name = decodeURIComponent(url.replace(currentUrl, "").replace(/\/$/, ""));
                const isFolder = url.endsWith("/");
                return (
                  <tr key={url}>
                    <td
                      onClick={() => isFolder && navigateTo(url)}
                      style={{ cursor: isFolder ? "pointer" : "default" }}
                    >
                      <FontAwesomeIcon
                        icon={isFolder ? faFolder : faFileLines}
                        className={isFolder ? "cell-icon folder" : "cell-icon file"}
                      />
                      {name}
                    </td>
                    <td className="actions-cell">
                      <button
                        onClick={() => renameItem(url)}
                        className="icon-btn edit"
                        title="Umbenennen"
                        aria-label="Umbenennen"
                      >
                        <FontAwesomeIcon icon={faPen} />
                      </button>

                      {!isFolder && (
                        <button
                          onClick={() => downloadFile(url)}
                          className="icon-btn download"
                          title="Herunterladen"
                          aria-label="Herunterladen"
                        >
                          <FontAwesomeIcon icon={faDownload} />
                        </button>
                      )}

                      <button
                        onClick={() => deleteItem(url)}
                        className="icon-btn delete"
                        title="Löschen"
                        aria-label="Löschen"
                      >
                        <FontAwesomeIcon icon={faTrash} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="bottom-right">
            <button onClick={goBack} className="back-btn" title="Ordner zurück">
              <FontAwesomeIcon icon={faArrowLeft} />
              <span>Zurück</span>
            </button>
          </div>
        </>
      )}
    </>
  );
}

function ProfilePage({ webId }) {
  const navigate = useNavigate();
  return (
    <>
      <div className="toolbar">
        <div className="crumb">
          <FontAwesomeIcon icon={faUser} className="crumb-icon" />
          <span>Profil</span>
        </div>
        <div className="primary-actions">
          <button className="pill-btn" onClick={() => navigate("/")} title="Zur Dateiübersicht">
            <FontAwesomeIcon icon={faArrowLeft} /> <span>Zurück</span>
          </button>
        </div>
      </div>

      <div className="profile-panel">
        <Profile webId={webId} onClose={() => navigate("/")} />
      </div>
    </>
  );
}

/* ---------- Login Screen---------- */
function LoginScreen({ onLogin }) {
  const providers = [
    {
      label: "TMDT Solid",
      url: "https://tmdt-solid-community-server.de",
      note: "Empfohlen • EU-Hosting",
    },
    {
      label: "Solid Community",
      url: "https://solidcommunity.net",
      note: "Öffentlicher Community-Server",
    },
  ];

  const [selected, setSelected] = useState(providers[0].url);
  const [customIssuer, setCustomIssuer] = useState("");
  const useCustom = customIssuer.trim().length > 0;
  const issuerToLogin = useCustom ? customIssuer.trim() : selected;

  return (
    <div className="login-wrap">
      {/* Hero Header */}
      <div className="login-hero">
        <div className="login-hero-left">
          <div className="login-hero-icon">🔒</div>
          <div>
            <div className="login-hero-title">Solid Pod Browser</div>
            <div className="login-hero-sub">Wähle deinen Solid Pod Provider</div>
          </div>
        </div>
      </div>

      {/* Content Card */}
      <div className="login-card">

        {/* Provider-Liste */}
        <div className="login-section">
          <div className="section-head">
            <span className="section-title">Vorgeschlagene Provider</span>
            <span className="section-hint">Wähle eine Karte oder nutze unten „Custom Issuer“</span>
          </div>

          <div className="provider-grid">
            {providers.map((p) => {
              const isActive = selected === p.url && !useCustom;
              return (
                <button
                  key={p.url}
                  type="button"
                  className={"prov-card" + (isActive ? " active" : "")}
                  onClick={() => { setSelected(p.url); setCustomIssuer(""); }}
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

        {/* Custom Issuer */}
        <div className="login-section">
          <div className="section-head">
            <span className="section-title">Custom Issuer</span>
            <span className="section-hint">OIDC-Issuer-URL deines Pod-Anbieters</span>
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
                title="Zurück zur Providerliste"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="login-footer">
          <div className="login-meta">
            <span className="dot" /> Solid OIDC Login
          </div>
          <button
            className="login-primary"
            onClick={() => onLogin(issuerToLogin)}
            disabled={!issuerToLogin}
            title="Mit ausgewähltem Provider anmelden"
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
