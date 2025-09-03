import React, { useEffect, useState, useRef } from "react";
import {
  getSolidDataset,
  getContainedResourceUrlAll,
  deleteFile,
  deleteContainer,
  createContainerAt,
  overwriteFile,
  getFileWithAcl,
  getSolidDatasetWithAcl,
  getResourceAcl,
  hasResourceAcl,
  hasAccessibleAcl,
  createAclFromFallbackAcl,
  setAgentResourceAccess,
  getAgentResourceAccessAll,
  saveAclFor,
} from "@inrupt/solid-client";
import { fetch as solidFetch } from "@inrupt/solid-client-authn-browser";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFolder,
  faFile,
  faPlus,
  faUpload,
  faPen,
  faTrash,
  faDownload,
  faShareNodes,
  faChevronRight
} from "@fortawesome/free-solid-svg-icons";
import "./DataManager.css";
import CreateFolderModal from "./CreateFolderModal";
import ShareFileModal from "./ShareFileModal";
import RenameItemModal from "./RenameItemModal";

const noCacheFetch = (input, init = {}) =>
  solidFetch(input, {
    ...init,
    cache: "no-store",
    headers: { ...(init.headers || {}), "Cache-Control": "no-cache" }
  });

function guessContentType(filename, fallback = "application/octet-stream") {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ttl":
      return "text/turtle";
    case "json":
      return "application/json";
    case "csv":
      return "text/csv";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "txt":
      return "text/plain";
    default:
      return fallback;
  }
}

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
  shareItem,
  crumbs,
}) {
  const [hideTtl, setHideTtl] = useState(true);
  const visibleItems = (hideTtl
    ? items.filter((item) => !item.url.toLowerCase().endsWith(".ttl"))
    : items
  )
    .slice()
    .sort((a, b) => {
      const aIsFolder = a.url.endsWith("/");
      const bIsFolder = b.url.endsWith("/");
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;
      const nameA = decodeURIComponent(
        a.url.replace(currentUrl, "").replace(/\/$/, "")
      ).toLowerCase();
      const nameB = decodeURIComponent(
        b.url.replace(currentUrl, "").replace(/\/$/, "")
      ).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  return (
    <>
      <div className="toolbar">
        <div className="crumb">
          {crumbs.map((crumb, index) => (
            <React.Fragment key={crumb.url}>
              {index > 0 && (
                <FontAwesomeIcon
                  icon={faChevronRight}
                  className="crumb-separator"
                />
              )}
              {index === crumbs.length - 1 ? (
                <span>{crumb.name}</span>
              ) : (
                <span
                  className="crumb-link"
                  onClick={() => navigateTo(crumb.url)}
                >
                  {crumb.name}
                </span>
              )}
            </React.Fragment>
          ))}
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
                  <th>Last Modified</th>
                  <th className="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map(({ url, lastModified }) => {
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
                        <FontAwesomeIcon
                          icon={isFolder ? faFolder : faFile}
                          className={`file-icon ${isFolder ? "folder" : "file"}`}
                        />
                        {name}
                      </td>
                      <td>
                        {lastModified
                          ? new Date(lastModified).toLocaleString()
                          : "-"}
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
                        {!isFolder && (
                          <button
                            onClick={() => shareItem(url)}
                            className="icon-btn share"
                            title="Share"
                            aria-label="Share"
                          >
                            <FontAwesomeIcon icon={faShareNodes} />
                          </button>
                        )}
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
        </>
      )}
    </>
  );
}

export default function DataManager({ webId }) {
  const [currentUrl, setCurrentUrl] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const rootUrlRef = useRef("");

  useEffect(() => {
    if (!webId) return;
    const url = new URL(webId);
    const segments = url.pathname.split("/").filter(Boolean);
    const profileIndex = segments.indexOf("profile");
    const baseSegments = profileIndex > -1 ? segments.slice(0, profileIndex) : segments;
    const basePath = baseSegments.length ? `/${baseSegments.join("/")}/` : "/";
    const rootUrl = `${url.origin}${basePath}`;
    rootUrlRef.current = rootUrl;
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
            contentType: file.type || guessContentType(file.name),
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
      const itemInfos = await Promise.all(
        containedUrls.map(async (itemUrl) => {
          try {
            const res = await noCacheFetch(itemUrl, { method: "HEAD" });
            return {
              url: itemUrl,
              lastModified: res.headers.get("Last-Modified"),
            };
          } catch {
            return { url: itemUrl, lastModified: null };
          }
        })
      );
      setItems(itemInfos);
    } catch {} finally {
      setLoading(false);
    }
  };

  const navigateTo = (url) => {
    const nextUrl = url.endsWith("/") ? url : url + "/";
    setCurrentUrl(nextUrl);
    loadItems(nextUrl);
  };

  const computeCrumbs = () => {
    const rootUrl = rootUrlRef.current;
    if (!rootUrl) return [];
    const url = new URL(currentUrl);
    const root = new URL(rootUrl);
    const relative = url.pathname.replace(root.pathname, "");
    const parts = relative.split("/").filter(Boolean);
    const crumbs = [{ name: "All files", url: rootUrl }];
    parts.forEach((part, idx) => {
      const partUrl = rootUrl + parts.slice(0, idx + 1).join("/") + "/";
      crumbs.push({ name: decodeURIComponent(part), url: partUrl });
    });
    return crumbs;
  };

  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTargetUrl, setShareTargetUrl] = useState("");
  const [shareAgents, setShareAgents] = useState([]);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTargetUrl, setRenameTargetUrl] = useState("");
  const [renameCurrentName, setRenameCurrentName] = useState("");

  const openCreateFolderModal = () => setFolderModalOpen(true);

  const handleCreateFolder = async (name) => {
    if (!name) return;
    const folderUrl = currentUrl + name + "/";
    try {
      await createContainerAt(folderUrl, { fetch: noCacheFetch });
      await loadItems(currentUrl);
    } catch {
      alert("Failed to create folder.");
    }
  };

  const deleteRecursive = async (url) => {
    if (url.endsWith("/")) {
      try {
        const dataset = await getSolidDataset(url, { fetch: noCacheFetch });
        const contained = getContainedResourceUrlAll(dataset);
        for (const item of contained) {
          await deleteRecursive(item);
        }
      } catch {}
      await deleteContainer(url, { fetch: noCacheFetch });
    } else {
      await deleteFile(url, { fetch: noCacheFetch });
    }
  };

  const deleteItem = async (url) => {
    if (!window.confirm("Delete permanently?")) return;
    try {
      await deleteRecursive(url);
      await loadItems(currentUrl);
    } catch {
      alert("Delete failed.");
    }
  };

  const openRenameModal = (url) => {
    const name = decodeURIComponent(url.replace(currentUrl, "").replace(/\/$/, ""));
    setRenameTargetUrl(url);
    setRenameCurrentName(name);
    setRenameModalOpen(true);
  };

  const performRename = async (url, newName) => {
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

  const handleRenameSubmit = async (newName) => {
    await performRename(renameTargetUrl, newName);
    setRenameModalOpen(false);
    setRenameTargetUrl("");
    setRenameCurrentName("");
  };

  const uploadFile = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      const targetUrl = currentUrl + file.name;
      try {
        await overwriteFile(targetUrl, file, {
          contentType: file.type || guessContentType(file.name),
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

  const getResourceAndAcl = async (url) => {
    const resource = url.endsWith("/")
      ? await getSolidDatasetWithAcl(url, { fetch: noCacheFetch })
      : await getFileWithAcl(url, { fetch: noCacheFetch });
    let resourceAcl;
    if (!hasResourceAcl(resource)) {
      if (!hasAccessibleAcl(resource)) {
        throw new Error("No access to ACL.");
      }
      resourceAcl = createAclFromFallbackAcl(resource);
    } else {
      resourceAcl = getResourceAcl(resource);
    }
    return { resource, resourceAcl };
  };

  const loadShareAgents = (acl) => {
    const agentAccess = getAgentResourceAccessAll(acl);
    const agents = Object.entries(agentAccess)
      .filter(([agentWebId]) => agentWebId !== webId)
      .map(([agentWebId, access]) => ({
        webId: agentWebId,
        access,
      }));
    setShareAgents(agents);
  };

  const openShareModal = async (url) => {
    try {
      const { resourceAcl } = await getResourceAndAcl(url);
      loadShareAgents(resourceAcl);
      setShareTargetUrl(url);
      setShareModalOpen(true);
    } catch {
      alert("Failed to load ACL.");
    }
  };

  const handleShareItem = async (webId, access) => {
    const url = shareTargetUrl;
    if (!url) return;
    try {
      const { resource, resourceAcl } = await getResourceAndAcl(url);
      const updatedAcl = setAgentResourceAccess(resourceAcl, webId, access);
      await saveAclFor(resource, updatedAcl, { fetch: noCacheFetch });
      loadShareAgents(updatedAcl);
    } catch {
      alert("Sharing failed.");
    }
  };

  const handleRemoveShare = async (webId) => {
    const url = shareTargetUrl;
    if (!url) return;
    try {
      const { resource, resourceAcl } = await getResourceAndAcl(url);
      const updatedAcl = setAgentResourceAccess(resourceAcl, webId, {});
      await saveAclFor(resource, updatedAcl, { fetch: noCacheFetch });
      loadShareAgents(updatedAcl);
    } catch {
      alert("Failed to remove access.");
    }
  };

  return (
    <>
      <TopHeader />
      <FilesView
        currentUrl={currentUrl}
        items={items}
        loading={loading}
        createFolder={openCreateFolderModal}
        uploadFile={uploadFile}
        navigateTo={navigateTo}
        renameItem={openRenameModal}
        deleteItem={deleteItem}
        downloadFile={downloadFile}
        shareItem={openShareModal}
        crumbs={computeCrumbs()}
      />
      <CreateFolderModal
        show={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
        onCreate={handleCreateFolder}
      />
      <ShareFileModal
        show={shareModalOpen}
        onClose={() => {
          setShareModalOpen(false);
          setShareTargetUrl("");
          setShareAgents([]);
        }}
        onShare={handleShareItem}
        onRemove={handleRemoveShare}
        existing={shareAgents}
      />
      <RenameItemModal
        show={renameModalOpen}
        onClose={() => {
          setRenameModalOpen(false);
          setRenameTargetUrl("");
          setRenameCurrentName("");
        }}
        onRename={handleRenameSubmit}
        currentName={renameCurrentName}
      />
    </>
  );
}
