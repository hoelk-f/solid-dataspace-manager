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
import session from "../solidSession";
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
  faChevronRight,
  faLayerGroup,
  faCopy,
  faEye,
  faFilter,
  faSort
} from "@fortawesome/free-solid-svg-icons";
import "./DataManager.css";
import CreateFolderModal from "./CreateFolderModal";
import ShareFileModal from "./ShareFileModal";
import RenameItemModal from "./RenameItemModal";
import AlertModal from "./AlertModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import ConfirmModal from "./ConfirmModal";

const noCacheFetch = (input, init = {}) =>
  session.fetch(input, {
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

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unit = units.shift();
  while (size >= 1024 && units.length) {
    size /= 1024;
    unit = units.shift();
  }
  return `${size.toFixed(size >= 10 || unit === "B" ? 0 : 1)} ${unit}`;
}

function getExtension(name) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function getItemType(item) {
  if (item.isFolder) return "Folder";
  const ext = getExtension(item.name);
  if (!ext) return "Other";
  if (["json", "csv", "ttl"].includes(ext)) return ext.toUpperCase();
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "Image";
  return ext.toUpperCase();
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
  showTtl,
  onShowTtlChange,
  createFolder,
  uploadFile,
  navigateTo,
  renameItem,
  deleteItem,
  downloadFile,
  shareItem,
  crumbs,
  showHidden,
  onShowHiddenChange,
  selectedItems,
  onToggleSelect,
  onToggleSelectAll,
  onRowPreview,
  onDropOnFolder,
  onDragStartRow,
}) {
  const visibleItems = items;
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
            title="Show hidden files"
            style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}
          >
            <input
              type="checkbox"
              checked={showHidden}
              onChange={(e) => onShowHiddenChange(e.target.checked)}
              aria-label="Show hidden files"
            />
            <span>Show Hidden</span>
          </label>
          <label
            className="pill-checkbox"
            title="Show .TTL files"
            style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}
          >
            <input
              type="checkbox"
              checked={showTtl}
              onChange={(e) => onShowTtlChange(e.target.checked)}
              aria-label="Show .ttl files"
            />
            <span>Show .TTL files</span>
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
                  <th className="th-check">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && selectedItems.size === items.length}
                      onChange={onToggleSelectAll}
                      aria-label="Select all items"
                    />
                  </th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Last Modified</th>
                  <th className="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => {
                  const { url, lastModified, isFolder, name, size } = item;
                  return (
                    <tr
                      key={url}
                      draggable={!isFolder}
                      className={selectedItems.has(url) ? "row-selected" : ""}
                      onDragStart={(event) => onDragStartRow(item, event)}
                      onDragOver={(event) => {
                        if (isFolder) event.preventDefault();
                      }}
                      onDrop={(event) => {
                        if (!isFolder) return;
                        event.preventDefault();
                        onDropOnFolder(url, event);
                      }}
                      onClick={(event) => {
                        if (event.target.closest("button") || event.target.closest("input")) {
                          return;
                        }
                        if (!isFolder) {
                          onRowPreview(item);
                        }
                      }}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedItems.has(url)}
                          onChange={() => onToggleSelect(url)}
                          aria-label={`Select ${name}`}
                        />
                      </td>
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
                      <td>{getItemType(item)}</td>
                      <td>{formatBytes(size)}</td>
                      <td>
                        {lastModified
                          ? new Date(lastModified).toLocaleString("de-DE", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
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
  const [showHidden, setShowHidden] = useState(false);
  const [showTtl, setShowTtl] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [previewItem, setPreviewItem] = useState(null);
  const [previewContent, setPreviewContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [bulkShareOpen, setBulkShareOpen] = useState(false);
  const [bulkShareWebId, setBulkShareWebId] = useState("");
  const [bulkShareEnabled, setBulkShareEnabled] = useState(false);
  const [bulkMoveCopyOpen, setBulkMoveCopyOpen] = useState(false);
  const [bulkMoveCopyTarget, setBulkMoveCopyTarget] = useState("");
  const [bulkCopyMode, setBulkCopyMode] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ totalBytes: 0, fileCount: 0 });
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
    loadItems(rootUrl, showHidden);
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
      loadItems(currentUrl, showHidden);
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

  const loadItems = async (url, includeHidden) => {
    try {
      setLoading(true);
      setPreviewItem(null);
      setPreviewContent("");
      const dataset = await getSolidDataset(url, { fetch: noCacheFetch });
      const containedUrls = getContainedResourceUrlAll(dataset);
      let allUrls = [...containedUrls];

      if (includeHidden) {
        const hiddenSuffixes = [".acl", ".acr", ".meta"];
        const candidateUrls = [url, ...containedUrls];
        for (const baseUrl of candidateUrls) {
          for (const suffix of hiddenSuffixes) {
            const hiddenUrl = `${baseUrl}${suffix}`;
            try {
              const res = await noCacheFetch(hiddenUrl, { method: "HEAD" });
              if (res.ok) {
                allUrls.push(hiddenUrl);
              }
            } catch {
              // Ignore missing hidden resources.
            }
          }
        }
      }

      allUrls = Array.from(new Set(allUrls));
      const itemInfos = await Promise.all(
        allUrls.map(async (itemUrl) => {
          try {
            const res = await noCacheFetch(itemUrl, { method: "HEAD" });
            const isFolder = itemUrl.endsWith("/");
            const name = decodeURIComponent(
              itemUrl.replace(url, "").replace(/\/$/, "")
            );
            const sizeHeader = res.headers.get("Content-Length");
            const size = sizeHeader ? Number(sizeHeader) : null;
            return {
              url: itemUrl,
              lastModified: res.headers.get("Last-Modified"),
              size,
              isFolder,
              name,
            };
          } catch {
            const isFolder = itemUrl.endsWith("/");
            const name = decodeURIComponent(
              itemUrl.replace(url, "").replace(/\/$/, "")
            );
            return { url: itemUrl, lastModified: null, size: null, isFolder, name };
          }
        })
      );
      setItems(itemInfos);
      setSelectedItems(new Set());
      const totalBytes = itemInfos
        .filter((item) => !item.isFolder && Number.isFinite(item.size))
        .reduce((sum, item) => sum + item.size, 0);
      const fileCount = itemInfos.filter((item) => !item.isFolder).length;
      setStorageInfo({ totalBytes, fileCount });
    } catch {} finally {
      setLoading(false);
    }
  };

  const navigateTo = (url) => {
    const nextUrl = url.endsWith("/") ? url : url + "/";
    setCurrentUrl(nextUrl);
    setSelectedItems(new Set());
    setPreviewItem(null);
    loadItems(nextUrl, showHidden);
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

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetUrl, setDeleteTargetUrl] = useState("");
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = (msg) => {
    setAlertMessage(msg);
    setAlertOpen(true);
  };

  const openCreateFolderModal = () => setFolderModalOpen(true);

  const handleCreateFolder = async (name) => {
    if (!name) return;
    const folderUrl = currentUrl + name + "/";
    try {
      await createContainerAt(folderUrl, { fetch: noCacheFetch });
      await loadItems(currentUrl, showHidden);
    } catch {
      showAlert("Failed to create folder.");
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

  const openDeleteModal = (url) => {
    setDeleteTargetUrl(url);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTargetUrl) return;
    try {
      await deleteRecursive(deleteTargetUrl);
      await loadItems(currentUrl, showHidden);
    } catch {
      showAlert("Delete failed.");
    } finally {
      setDeleteModalOpen(false);
      setDeleteTargetUrl("");
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
      await loadItems(currentUrl, showHidden);
    } catch {
      showAlert("Rename failed.");
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
        await loadItems(currentUrl, showHidden);
      } catch {
        showAlert("Upload failed.");
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
      showAlert("Download failed.");
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
      showAlert("Failed to load ACL.");
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
      showAlert("Sharing failed.");
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
      showAlert("Failed to remove access.");
    }
  };

  const loadPreview = async (item) => {
    if (!item || item.isFolder) return;
    setPreviewLoading(true);
    try {
      const res = await noCacheFetch(item.url);
      if (!res.ok) throw new Error("Preview failed.");
      const ext = getExtension(item.name);
      const text = await res.text();
      if (ext === "json") {
        try {
          const parsed = JSON.parse(text);
          setPreviewContent(JSON.stringify(parsed, null, 2));
        } catch {
          setPreviewContent(text.slice(0, 5000));
        }
      } else {
        setPreviewContent(text.slice(0, 5000));
      }
    } catch {
      setPreviewContent("No preview available.");
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (previewItem) {
      loadPreview(previewItem);
    }
  }, [previewItem]);

  const normalizeFolderUrl = (url) => (url.endsWith("/") ? url : `${url}/`);

  const copyRecursive = async (srcUrl, destUrl) => {
    if (srcUrl.endsWith("/")) {
      await createContainerAt(destUrl, { fetch: noCacheFetch });
      const dataset = await getSolidDataset(srcUrl, { fetch: noCacheFetch });
      const contained = getContainedResourceUrlAll(dataset);
      for (const item of contained) {
        const name = decodeURIComponent(item.replace(srcUrl, "").replace(/\/$/, ""));
        const target = `${destUrl}${name}${item.endsWith("/") ? "/" : ""}`;
        await copyRecursive(item, target);
      }
    } else {
      const res = await noCacheFetch(srcUrl);
      const data = await res.blob();
      await overwriteFile(destUrl, data, {
        contentType: res.headers.get("Content-Type") || "application/octet-stream",
        fetch: noCacheFetch,
      });
    }
  };

  const moveOrCopyItems = async (urls, targetFolderUrl, copyMode) => {
    const target = normalizeFolderUrl(targetFolderUrl);
    try {
      for (const url of urls) {
        const trimmed = url.replace(/\/$/, "");
        const name = decodeURIComponent(trimmed.split("/").pop() || "");
        const destUrl = `${target}${name}${url.endsWith("/") ? "/" : ""}`;
        await copyRecursive(url, destUrl);
        if (!copyMode) {
          await deleteRecursive(url);
        }
      }
      await loadItems(currentUrl, showHidden);
    } catch {
      showAlert("Move/Copy failed.");
    }
  };

  const handleBulkShare = async () => {
    if (!bulkShareWebId.trim() || !bulkShareEnabled) return;
    const urls = Array.from(selectedItems);
    try {
      for (const url of urls) {
        const { resource, resourceAcl } = await getResourceAndAcl(url);
        const updatedAcl = setAgentResourceAccess(resourceAcl, bulkShareWebId, {
          read: true,
          append: true,
          write: true,
          control: true,
        });
        await saveAclFor(resource, updatedAcl, { fetch: noCacheFetch });
      }
      setBulkShareOpen(false);
      setBulkShareWebId("");
      setBulkShareEnabled(false);
    } catch {
      showAlert("Bulk share failed.");
    }
  };

  const handleBulkMoveCopy = async () => {
    if (!bulkMoveCopyTarget.trim()) return;
    await moveOrCopyItems(
      Array.from(selectedItems),
      bulkMoveCopyTarget.trim(),
      bulkCopyMode
    );
    setBulkMoveCopyOpen(false);
    setBulkMoveCopyTarget("");
  };

  const closeBulkShare = () => {
    setBulkShareOpen(false);
    setBulkShareWebId("");
    setBulkShareEnabled(false);
  };

  const closeBulkMoveCopy = () => {
    setBulkMoveCopyOpen(false);
    setBulkMoveCopyTarget("");
  };

  const handleBulkDelete = async () => {
    try {
      for (const url of selectedItems) {
        await deleteRecursive(url);
      }
      setSelectedItems(new Set());
      await loadItems(currentUrl, showHidden);
    } catch {
      showAlert("Bulk delete failed.");
    } finally {
      setBulkDeleteConfirm(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const nameLower = item.name.toLowerCase();
    const isHidden =
      nameLower.startsWith(".") ||
      nameLower.endsWith(".acl") ||
      nameLower.endsWith(".acr") ||
      nameLower.endsWith(".meta");
    if (!showHidden && isHidden) return false;
    if (!showTtl && nameLower.endsWith(".ttl")) return false;
    if (searchQuery && !nameLower.includes(searchQuery.toLowerCase())) return false;

    if (typeFilter === "all") return true;
    if (typeFilter === "folders") return item.isFolder;
    if (typeFilter === "files") return !item.isFolder;
    const type = getItemType(item).toLowerCase();
    return type === typeFilter;
  });

  const sortedItems = filteredItems.slice().sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    let result = 0;
    if (sortBy === "name") {
      result = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    } else if (sortBy === "modified") {
      const aTime = a.lastModified ? new Date(a.lastModified).getTime() : 0;
      const bTime = b.lastModified ? new Date(b.lastModified).getTime() : 0;
      result = aTime - bTime;
    } else if (sortBy === "size") {
      const aSize = a.size ?? -1;
      const bSize = b.size ?? -1;
      result = aSize - bSize;
    }
    return sortDir === "asc" ? result : -result;
  });

  const selectedCount = Array.from(selectedItems).length;

  return (
    <>
      <TopHeader />
      <div className="data-manager-layout">
        <div className="data-manager-main">
          <div className="data-toolbar">
            <div className="data-toolbar__left">
              <div className="data-search">
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="data-select">
                <FontAwesomeIcon icon={faFilter} />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="all">All types</option>
                  <option value="folders">Folders</option>
                  <option value="files">Files</option>
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="ttl">TTL</option>
                  <option value="image">Image</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="data-select">
                <FontAwesomeIcon icon={faSort} />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="name">Sort by name</option>
                  <option value="modified">Sort by modified</option>
                  <option value="size">Sort by size</option>
                </select>
                <button
                  className="pill-btn pill-btn--ghost"
                  onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
                  title="Toggle sort direction"
                >
                  {sortDir === "asc" ? "Asc" : "Desc"}
                </button>
              </div>
            </div>
            <div className="data-toolbar__right">
              <div className="storage-card">
                <div className="storage-card__label">Current folder</div>
                <div className="storage-card__value">
                  {storageInfo.fileCount} files • {formatBytes(storageInfo.totalBytes)}
                </div>
                {storageInfo.totalBytes > 100 * 1024 * 1024 && (
                  <div className="storage-card__warning">Large folder size</div>
                )}
              </div>
              <div className="bulk-actions">
                <span className="bulk-count">
                  <FontAwesomeIcon icon={faLayerGroup} /> {selectedCount} selected
                </span>
                <button
                  className="pill-btn"
                  disabled={!selectedCount}
                  onClick={() => setBulkShareOpen(true)}
                >
                  <FontAwesomeIcon icon={faShareNodes} /> Share
                </button>
                <button
                  className="pill-btn"
                  disabled={!selectedCount}
                  onClick={() => {
                    setBulkCopyMode(false);
                    setBulkMoveCopyOpen(true);
                  }}
                >
                  <FontAwesomeIcon icon={faChevronRight} /> Move
                </button>
                <button
                  className="pill-btn"
                  disabled={!selectedCount}
                  onClick={() => {
                    setBulkCopyMode(true);
                    setBulkMoveCopyOpen(true);
                  }}
                >
                  <FontAwesomeIcon icon={faCopy} /> Copy
                </button>
                <button
                  className="pill-btn pill-btn--danger"
                  disabled={!selectedCount}
                  onClick={() => setBulkDeleteConfirm(true)}
                >
                  <FontAwesomeIcon icon={faTrash} /> Delete
                </button>
              </div>
            </div>
          </div>
          <FilesView
            currentUrl={currentUrl}
            items={sortedItems}
            loading={loading}
            showTtl={showTtl}
            onShowTtlChange={setShowTtl}
            createFolder={openCreateFolderModal}
            uploadFile={uploadFile}
            navigateTo={navigateTo}
            renameItem={openRenameModal}
            deleteItem={openDeleteModal}
            downloadFile={downloadFile}
            shareItem={openShareModal}
            crumbs={computeCrumbs()}
            showHidden={showHidden}
            onShowHiddenChange={(next) => {
              setShowHidden(next);
              loadItems(currentUrl, next);
            }}
            selectedItems={selectedItems}
            onToggleSelect={(url) => {
              setSelectedItems((prev) => {
                const next = new Set(prev);
                if (next.has(url)) next.delete(url);
                else next.add(url);
                return next;
              });
            }}
            onToggleSelectAll={() => {
              setSelectedItems((prev) => {
                if (prev.size === sortedItems.length) return new Set();
                return new Set(sortedItems.map((item) => item.url));
              });
            }}
            onRowPreview={(item) => {
              setPreviewItem(item);
              setPreviewOpen(true);
            }}
            onDragStartRow={(item, event) => {
              const urls = selectedItems.has(item.url)
                ? Array.from(selectedItems)
                : [item.url];
              event.dataTransfer.setData("text/plain", urls.join("|"));
              event.dataTransfer.effectAllowed = "copyMove";
            }}
            onDropOnFolder={async (folderUrl, event) => {
              const data = event.dataTransfer.getData("text/plain");
              const urls = data ? data.split("|").filter(Boolean) : [];
              if (!urls.length) return;
              const copyMode = event.ctrlKey || event.altKey;
              await moveOrCopyItems(urls, folderUrl, copyMode);
            }}
      />
        </div>
      </div>
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
      <DeleteConfirmModal
        show={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeleteTargetUrl("");
        }}
        onConfirm={handleDelete}
      />
      <AlertModal
        show={alertOpen}
        message={alertMessage}
        onClose={() => setAlertOpen(false)}
      />
      <ConfirmModal
        show={bulkDeleteConfirm}
        title="Delete selected items?"
        message="This will permanently delete all selected items."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={handleBulkDelete}
      />
      {previewOpen && previewItem && (
        <div className="modal-overlay">
          <div className="modal-box preview-modal">
            <div className="modal-header">
              <span className="modal-title">Preview</span>
              <button
                className="modal-close"
                onClick={() => {
                  setPreviewOpen(false);
                  setPreviewItem(null);
                  setPreviewContent("");
                }}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="preview-meta">
                <div><strong>Name:</strong> {previewItem.name}</div>
                <div><strong>Type:</strong> {getItemType(previewItem)}</div>
                <div><strong>Size:</strong> {formatBytes(previewItem.size)}</div>
              </div>
              {previewLoading ? (
                <div className="preview-loading">Loading preview...</div>
              ) : (
                <pre className="preview-code">{previewContent || "No preview available."}</pre>
              )}
            </div>
          </div>
        </div>
      )}
      {bulkShareOpen && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <span className="modal-title">Bulk Share</span>
              <button className="modal-close" onClick={closeBulkShare}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="modal-label">WebID</label>
                <input
                  className="modal-input"
                  type="text"
                  value={bulkShareWebId}
                  onChange={(e) => setBulkShareWebId(e.target.value)}
                  placeholder="https://user.example/profile#me"
                />
              </div>
              <div className="form-group" style={{ marginTop: "1rem" }}>
                <span className="modal-label">Access</span>
                <div className="modal-checkboxes">
                  <label>
                    <input
                      type="checkbox"
                      checked={bulkShareEnabled}
                      onChange={(e) => setBulkShareEnabled(e.target.checked)}
                    />
                    Access
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeBulkShare}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleBulkShare}
                disabled={!bulkShareWebId.trim() || !bulkShareEnabled}
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}
      {bulkMoveCopyOpen && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <span className="modal-title">
                {bulkCopyMode ? "Copy items" : "Move items"}
              </span>
              <button className="modal-close" onClick={closeBulkMoveCopy}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="modal-label">Target folder URL</label>
                <input
                  className="modal-input"
                  type="text"
                  value={bulkMoveCopyTarget}
                  onChange={(e) => setBulkMoveCopyTarget(e.target.value)}
                  placeholder="https://pod.example/storage/folder/"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeBulkMoveCopy}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleBulkMoveCopy}
                disabled={!bulkMoveCopyTarget.trim()}
              >
                {bulkCopyMode ? "Copy" : "Move"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
