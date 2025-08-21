import React, { useEffect, useState } from "react";
import {
  getSolidDataset,
  getContainedResourceUrlAll,
  deleteFile,
  deleteContainer,
  createContainerAt,
  overwriteFile,
} from "@inrupt/solid-client";
import { fetch as solidFetch } from "@inrupt/solid-client-authn-browser";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolder,
  faFileLines,
  faPlus,
  faUpload,
  faPen,
  faTrash,
  faDownload,
  faArrowLeft,
  faShareNodes
} from "@fortawesome/free-solid-svg-icons";
import "./DataManager.css";

const noCacheFetch = (input, init = {}) =>
  solidFetch(input, {
    ...init,
    cache: "no-store",
    headers: { ...(init.headers || {}), "Cache-Control": "no-cache" }
  });

function TopHeader() {
  return (
    <div className="toolbar toolbar--title">
      <div className="crumb">
        <FontAwesomeIcon icon={faFolder} className="crumb-icon" />
        <span>Data Manager</span>
      </div>
      <div />
    </div>
  );
}

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
  const [hideTtl, setHideTtl] = useState(true);
  const visibleItems = hideTtl ? items.filter((url) => !url.toLowerCase().endsWith(".ttl")) : items;
  return (
    <>
      <div className="toolbar">
        <div className="crumb">
          <FontAwesomeIcon className="crumb-icon" />
          <span>All files</span>
        </div>
        <div className="primary-actions">
          <label
            className="pill-checkbox"
            title="Hide Semantic Model files"
            style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}
          >
            <input
              type="checkbox"
              checked={hideTtl}
              onChange={(e) => setHideTtl(e.target.checked)}
              aria-label="Hide .ttl files"
            />
            <span>Hide Semantic Model</span>
          </label>
          <button onClick={createFolder} className="pill-btn" title="Create new folder">
            <FontAwesomeIcon icon={faPlus} /> <span>Folder</span>
          </button>
          <button onClick={uploadFile} className="pill-btn" title="Upload file">
            <FontAwesomeIcon icon={faUpload} /> <span>Upload</span>
          </button>
        </div>
      </div>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <div className="file-table-container">
            <table className="file-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((url) => {
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
                          title="Rename"
                          aria-label="Rename"
                        >
                          <FontAwesomeIcon icon={faPen} />
                        </button>
                        {!isFolder && (
                          <button
                            onClick={() => downloadFile(url)}
                            className="icon-btn download"
                            title="Download"
                            aria-label="Download"
                          >
                            <FontAwesomeIcon icon={faDownload} />
                          </button>
                        )}
                        <button
                          onClick={() => {}}
                          className="icon-btn share"
                          title="Share"
                          aria-label="Share"
                        >
                          <FontAwesomeIcon icon={faShareNodes} />
                        </button>
                        <button
                          onClick={() => deleteItem(url)}
                          className="icon-btn delete"
                          title="Delete"
                          aria-label="Delete"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bottom-right">
            <button onClick={goBack} className="back-btn" title="Go back">
              <FontAwesomeIcon icon={faArrowLeft} />
              <span>Back</span>
            </button>
          </div>
        </>
      )}
    </>
  );
}

export default function DataManager({ webId }) {
  const [currentUrl, setCurrentUrl] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!webId) return;
    const rootUrl = new URL(webId).origin + "/public/";
    setCurrentUrl(rootUrl);
    loadItems(rootUrl);
  }, [webId]);

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
            fetch: noCacheFetch,
          });
        } catch {}
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

  const loadItems = async (url) => {
    try {
      setLoading(true);
      const dataset = await getSolidDataset(url, { fetch: noCacheFetch });
      const containedUrls = getContainedResourceUrlAll(dataset);
      setItems(containedUrls);
    } catch {} finally {
      setLoading(false);
    }
  };

  const navigateTo = (url) => {
    const nextUrl = url.endsWith("/") ? url : url + "/";
    setCurrentUrl(nextUrl);
    loadItems(nextUrl);
  };

  const createFolder = async () => {
    const name = prompt("Folder name?");
    if (!name) return;
    const folderUrl = currentUrl + name + "/";
    try {
      await createContainerAt(folderUrl, { fetch: noCacheFetch });
      await loadItems(currentUrl);
    } catch {
      alert("Failed to create folder.");
    }
  };

  const deleteItem = async (url) => {
    if (!window.confirm("Delete permanently?")) return;
    try {
      if (url.endsWith("/")) {
        await deleteContainer(url, { fetch: noCacheFetch });
      } else {
        await deleteFile(url, { fetch: noCacheFetch });
      }
      await loadItems(currentUrl);
    } catch {
      alert("Delete failed.");
    }
  };

  const renameItem = async (url) => {
    const newName = prompt("New name?");
    if (!newName) return;
    const newUrl = currentUrl + newName + (url.endsWith("/") ? "/" : "");
    try {
      const res = await noCacheFetch(url);
      const data = await res.blob();
      await overwriteFile(newUrl, data, {
        contentType: res.headers.get("Content-Type") || "application/octet-stream",
        fetch: noCacheFetch,
      });
      if (url.endsWith("/")) await deleteContainer(url, { fetch: noCacheFetch });
      else await deleteFile(url, { fetch: noCacheFetch });
      await loadItems(currentUrl);
    } catch {
      alert("Rename failed.");
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
          fetch: noCacheFetch,
        });
        await loadItems(currentUrl);
      } catch {
        alert("Upload failed.");
      }
    };
    input.click();
  };

  const downloadFile = async (fileUrl) => {
    try {
      const response = await noCacheFetch(fileUrl);
      const blob = await response.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileUrl.split("/").pop();
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      alert("Download failed.");
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

  return (
    <>
      <TopHeader />
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
    </>
  );
}
