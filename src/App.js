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
import './App.css';

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

  const loginToSolid = async () => {
    await login({
      oidcIssuer: "https://solidcommunity.net",
      redirectUrl: window.location.href,
      clientName: "Solid Pod Browser",
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
      await deleteItem(url);
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
    a.download = fileUrl.split("/").pop(); // Dateiname
    document.body.appendChild(a); // nötig für Firefox
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

  // Entferne letzten Ordner aus dem Pfad
  const parts = path.split("/").filter((p) => p);
  parts.pop(); // aktuellen Ordner entfernen
  const parentPath = "/" + parts.join("/") + "/";

  const parentUrl = url.origin + parentPath;
  setCurrentUrl(parentUrl);
  loadItems(parentUrl);
};
return (
  <div className="container">
    <h1 className="main-title">Solid Pod Browser</h1>
    {sessionActive ? (
      <>
        <div className="topbar">
          <div className="breadcrumb-left">
            <span className="nav-folder-icon">📁</span>
            <span className="nav-label">All files</span>
            <span className="nav-separator">&gt;</span>
            <button onClick={createFolder} title="Neuen Ordner erstellen">
              ➕ Ordner
            </button>
            <button onClick={uploadFile} title="Datei hochladen">
              ⬆️ upload
            </button>
          </div>
          <div>
            <button
              onClick={logoutFromSolid}
              className="logout-btn"
              title="Abmelden"
            >
              🚪 Logout
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
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {items.map((url) => {
                  const name = decodeURIComponent(
                    url.replace(currentUrl, "").replace(/\/$/, "")
                  );
                  const isFolder = url.endsWith("/");
                  return (
                    <tr key={url}>
                      <td
                        onClick={() => isFolder && navigateTo(url)}
                        style={{ cursor: isFolder ? "pointer" : "default" }}
                      >
                        <span className="icon">{isFolder ? "📁" : "📄"}</span>
                        {name}
                      </td>
                      <td>
                        <button
                          onClick={() => renameItem(url)}
                          className="action-btn edit"
                          title="Umbenennen"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteItem(url)}
                          className="action-btn delete"
                          title="Löschen"
                        >
                          🗑️
                        </button>
                        {!isFolder && (
                          <button
                            onClick={() => downloadFile(url)}
                            className="action-btn download"
                            title="Herunterladen"
                          >
                            ⬇️
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="bottom-right">
              <button
                onClick={goBack}
                className="back-btn"
                title="Ordner zurück"
              >
                 ⬅️ Zurück
              </button>
            </div>
          </>
        )}
      </>
    ) : (
      <div className="center-login">
        <button onClick={loginToSolid} className="login-btn">
          🔐 Login
        </button>
      </div>
    )}
  </div>
);

};

export default App;
