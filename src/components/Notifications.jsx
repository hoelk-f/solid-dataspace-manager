import React, { useEffect, useState } from "react";
import session from "../solidSession";
import {
  getSolidDataset,
  getContainedResourceUrlAll,
  getThing,
  getThingAll,
  getUrl,
  getUrlAll,
  getStringNoLocale,
  deleteFile,
  saveSolidDatasetAt,
  setStringNoLocale,
  setUrl,
  setThing,
  removeAll,
  getFileWithAcl,
  getSolidDatasetWithAcl,
  getResourceAcl,
  hasResourceAcl,
  hasAccessibleAcl,
  createAclFromFallbackAcl,
  setAgentResourceAccess,
  saveAclFor,
} from "@inrupt/solid-client";
import { LDP, RDF } from "@inrupt/vocab-common-rdf";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInbox, faRotateRight, faCheck, faXmark } from "@fortawesome/free-solid-svg-icons";
import "./Notifications.css";

const SDM_NS = "https://w3id.org/solid-dataspace-manager#";
const SDM = {
  AccessRequest: `${SDM_NS}AccessRequest`,
  AccessDecision: `${SDM_NS}AccessDecision`,
  status: `${SDM_NS}status`,
  decision: `${SDM_NS}decision`,
  requesterWebId: `${SDM_NS}requesterWebId`,
  requesterName: `${SDM_NS}requesterName`,
  requesterEmail: `${SDM_NS}requesterEmail`,
  datasetIdentifier: `${SDM_NS}datasetIdentifier`,
  datasetTitle: `${SDM_NS}datasetTitle`,
  datasetAccessUrl: `${SDM_NS}datasetAccessUrl`,
  datasetSemanticModelUrl: `${SDM_NS}datasetSemanticModelUrl`,
  catalogUrl: `${SDM_NS}catalogUrl`,
  message: `${SDM_NS}message`,
  decisionComment: `${SDM_NS}decisionComment`,
  expiresAt: `${SDM_NS}expiresAt`,
  decidedAt: `${SDM_NS}decidedAt`,
  decidedBy: `${SDM_NS}decidedBy`,
};

const DCT_CREATED = "http://purl.org/dc/terms/created";
const DCT_TITLE = "http://purl.org/dc/terms/title";

const escapeLiteral = (value = "") =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, "\\n");

const noCacheFetch = (input, init = {}) =>
  session.fetch(input, {
    ...init,
    cache: "no-store",
    headers: { ...(init.headers || {}), "Cache-Control": "no-cache" },
  });

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const Notifications = ({ webId }) => {
  const [inboxUrl, setInboxUrl] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [decisionNotes, setDecisionNotes] = useState({});
  const [decisionExpiry, setDecisionExpiry] = useState({});
  const [processingId, setProcessingId] = useState("");
  const [hideRevoked, setHideRevoked] = useState(true);
  const [page, setPage] = useState(1);
  const [clearingRevoked, setClearingRevoked] = useState(false);
  const pageSize = 5;

  const resolveInboxUrl = async () => {
    const profileDataset = await getSolidDataset(webId, { fetch: noCacheFetch });
    const profile = getThing(profileDataset, webId);
    return profile ? getUrl(profile, LDP.inbox) : null;
  };

  const resolveInboxForWebId = async (targetWebId) => {
    if (!targetWebId) return null;
    const profileDataset = await getSolidDataset(targetWebId, { fetch: noCacheFetch });
    const profile = getThing(profileDataset, targetWebId);
    return profile ? getUrl(profile, LDP.inbox) : null;
  };

  const buildDecisionTurtle = ({ item, decision, note, expiresAt, decidedAt }) => {
    const lines = [
      "@prefix sdm: <" + SDM_NS + ">.",
      "@prefix dct: <http://purl.org/dc/terms/>.",
      "@prefix as: <https://www.w3.org/ns/activitystreams#>.",
      "@prefix xsd: <http://www.w3.org/2001/XMLSchema#>.",
      "",
      "<> a sdm:AccessDecision, as:Offer;",
      `  dct:created "${decidedAt}"^^xsd:dateTime;`,
      `  sdm:decision "${escapeLiteral(decision)}";`,
      `  sdm:requesterWebId <${item.requesterWebId}>;`,
      `  sdm:datasetIdentifier "${escapeLiteral(item.datasetIdentifier || "")}";`,
      `  sdm:datasetTitle "${escapeLiteral(item.datasetTitle || "")}";`,
      `  dct:title "${escapeLiteral(item.datasetTitle || "")}";`,
    ];

    if (item.datasetAccessUrl) {
      lines.push(`  sdm:datasetAccessUrl <${item.datasetAccessUrl}>;`);
    }
    if (item.datasetSemanticModelUrl) {
      lines.push(`  sdm:datasetSemanticModelUrl <${item.datasetSemanticModelUrl}>;`);
    }
    if (item.catalogUrl) {
      lines.push(`  sdm:catalogUrl <${item.catalogUrl}>;`);
    }
    if (note) {
      lines.push(`  sdm:decisionComment "${escapeLiteral(note)}";`);
    }
    if (expiresAt) {
      lines.push(`  sdm:expiresAt "${escapeLiteral(expiresAt)}";`);
    }

    lines.push("  .");
    return lines.join("\n");
  };

  const notifyRequester = async ({ item, decision, note, expiresAt, decidedAt }) => {
    try {
      const inboxUrl = await resolveInboxForWebId(item.requesterWebId);
      if (!inboxUrl) {
        console.warn("[AccessDecision] requester inbox missing", item.requesterWebId);
        return;
      }

      const turtle = buildDecisionTurtle({ item, decision, note, expiresAt, decidedAt });
      const res = await session.fetch(inboxUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/turtle",
          "Slug": `access-decision-${item.datasetIdentifier || "dataset"}-${Date.now()}`,
        },
        body: turtle,
      });
      if (!res.ok) {
        console.warn("[AccessDecision] inbox rejected", res.status);
      }
    } catch (err) {
      console.warn("[AccessDecision] notify failed", err);
    }
  };

  const loadNotificationThing = async (url) => {
    const dataset = await getSolidDataset(url, { fetch: noCacheFetch });
    const thing = getThing(dataset, url) || getThingAll(dataset)[0];
    return { dataset, thing };
  };

  const parseNotification = (url, thing) => {
    if (!thing) return null;
    const types = getUrlAll(thing, RDF.type);
    if (!types.includes(SDM.AccessRequest)) return null;

    return {
      id: url,
      status: getStringNoLocale(thing, SDM.status) || "pending",
      requesterWebId: getUrl(thing, SDM.requesterWebId) || "",
      requesterName: getStringNoLocale(thing, SDM.requesterName) || "",
      requesterEmail: getStringNoLocale(thing, SDM.requesterEmail) || "",
      datasetIdentifier: getStringNoLocale(thing, SDM.datasetIdentifier) || "",
      datasetTitle:
        getStringNoLocale(thing, SDM.datasetTitle) ||
        getStringNoLocale(thing, DCT_TITLE) ||
        "",
      datasetAccessUrl: getUrl(thing, SDM.datasetAccessUrl) || "",
      datasetSemanticModelUrl: getUrl(thing, SDM.datasetSemanticModelUrl) || "",
      catalogUrl: getUrl(thing, SDM.catalogUrl) || "",
      message: getStringNoLocale(thing, SDM.message) || "",
      decisionComment: getStringNoLocale(thing, SDM.decisionComment) || "",
      expiresAt: getStringNoLocale(thing, SDM.expiresAt) || "",
      decidedAt: getStringNoLocale(thing, SDM.decidedAt) || "",
      decidedBy: getUrl(thing, SDM.decidedBy) || "",
      createdAt: getStringNoLocale(thing, DCT_CREATED) || "",
    };
  };

  const updateNotification = async (url, updates) => {
    const { dataset, thing } = await loadNotificationThing(url);
    if (!thing) return;

    let updated = thing;
    if (updates.status) {
      updated = setStringNoLocale(updated, SDM.status, updates.status);
    }
    if ("decisionComment" in updates) {
      updated = removeAll(updated, SDM.decisionComment);
      if (updates.decisionComment) {
        updated = setStringNoLocale(updated, SDM.decisionComment, updates.decisionComment);
      }
    }
    if ("expiresAt" in updates) {
      updated = removeAll(updated, SDM.expiresAt);
      if (updates.expiresAt) {
        updated = setStringNoLocale(updated, SDM.expiresAt, updates.expiresAt);
      }
    }
    if ("decidedAt" in updates) {
      updated = removeAll(updated, SDM.decidedAt);
      if (updates.decidedAt) {
        updated = setStringNoLocale(updated, SDM.decidedAt, updates.decidedAt);
      }
    }
    if ("decidedBy" in updates) {
      updated = removeAll(updated, SDM.decidedBy);
      if (updates.decidedBy) {
        updated = setUrl(updated, SDM.decidedBy, updates.decidedBy);
      }
    }

    const updatedDataset = setThing(dataset, updated);
    await saveSolidDatasetAt(url, updatedDataset, { fetch: noCacheFetch });
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

  const setAccessForResource = async (url, agentWebId, access) => {
    if (!url) return;
    const { resource, resourceAcl } = await getResourceAndAcl(url);
    const updatedAcl = setAgentResourceAccess(resourceAcl, agentWebId, access);
    await saveAclFor(resource, updatedAcl, { fetch: noCacheFetch });
  };

  const expireIfNeeded = async (item) => {
    if (item.status !== "approved" || !item.expiresAt) return item;
    const expiryDate = new Date(item.expiresAt);
    if (Number.isNaN(expiryDate.getTime())) return item;
    if (expiryDate > new Date()) return item;

    try {
      await setAccessForResource(item.datasetAccessUrl, item.requesterWebId, {});
      await setAccessForResource(item.datasetSemanticModelUrl, item.requesterWebId, {});
      const now = new Date().toISOString();
      await updateNotification(item.id, {
        status: "expired",
        decidedAt: now,
        decidedBy: webId,
        decisionComment: item.decisionComment || "Access expired.",
      });
      return { ...item, status: "expired", decidedAt: now, decidedBy: webId };
    } catch (err) {
      console.error("Failed to expire access:", err);
      return item;
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    setError("");
    try {
      const inbox = await resolveInboxUrl();
      if (!inbox) {
        setInboxUrl("");
        setNotifications([]);
        setError("No Solid inbox found for this profile.");
        return;
      }
      setInboxUrl(inbox);

      const inboxDataset = await getSolidDataset(inbox, { fetch: noCacheFetch });
      const resourceUrls = getContainedResourceUrlAll(inboxDataset);
      const rawItems = await Promise.all(
        resourceUrls.map(async (url) => {
          try {
            const { thing } = await loadNotificationThing(url);
            return parseNotification(url, thing);
          } catch (err) {
            console.warn("Failed to parse notification:", url, err);
            return null;
          }
        })
      );

      const filtered = rawItems.filter(Boolean);
      const processed = [];
      for (const item of filtered) {
        // Keep notifications up to date with expiry decisions.
        const nextItem = await expireIfNeeded(item);
        processed.push(nextItem);
      }

      processed.sort((a, b) => {
        const aTime = Date.parse(a.createdAt) || 0;
        const bTime = Date.parse(b.createdAt) || 0;
        return bTime - aTime;
      });

      setNotifications(processed);
    } catch (err) {
      console.error("Failed to load inbox:", err);
      setError("Failed to load notifications from the Solid inbox.");
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (item, decision) => {
    setProcessingId(item.id);
    try {
      const note = decisionNotes[item.id] || "";
      const expiryInput = decisionExpiry[item.id] || "";
      const expiryIso = expiryInput ? new Date(expiryInput).toISOString() : "";
      const now = new Date().toISOString();

      console.warn("[AccessRequest] decision", {
        decision,
        requesterWebId: item.requesterWebId,
        datasetAccessUrl: item.datasetAccessUrl,
        datasetSemanticModelUrl: item.datasetSemanticModelUrl,
        expiresAt: expiryIso || null,
        inboxItem: item.id,
      });

      if (decision === "approved") {
        const fullAccess = { read: true, append: true, write: true, control: true };
        await setAccessForResource(item.datasetAccessUrl, item.requesterWebId, fullAccess);
        await setAccessForResource(item.datasetSemanticModelUrl, item.requesterWebId, fullAccess);
      } else if (decision === "revoked") {
        await setAccessForResource(item.datasetAccessUrl, item.requesterWebId, {});
        await setAccessForResource(item.datasetSemanticModelUrl, item.requesterWebId, {});
      }

      await updateNotification(item.id, {
        status: decision,
        decisionComment: note,
        expiresAt: expiryIso,
        decidedAt: now,
        decidedBy: webId,
      });

      await notifyRequester({
        item,
        decision,
        note,
        expiresAt: expiryIso,
        decidedAt: now,
      });

      console.warn("[AccessRequest] decision saved", {
        decision,
        inboxItem: item.id,
      });

      await loadNotifications();
    } catch (err) {
      console.error("Failed to update decision:", err);
      setError("Failed to update access decision.");
    } finally {
      setProcessingId("");
    }
  };

  const clearRevoked = async () => {
    if (!notifications.length) return;
    const revokedItems = notifications.filter((item) => item.status === "revoked");
    if (!revokedItems.length) return;
    if (!window.confirm(`Delete ${revokedItems.length} revoked request(s)?`)) return;

    setClearingRevoked(true);
    try {
      await Promise.all(
        revokedItems.map((item) => deleteFile(item.id, { fetch: noCacheFetch }))
      );
      await loadNotifications();
    } catch (err) {
      console.error("Failed to clear revoked requests:", err);
      setError("Failed to clear revoked requests.");
    } finally {
      setClearingRevoked(false);
    }
  };

  useEffect(() => {
    if (!webId) return;
    loadNotifications();
  }, [webId]);

  const filteredNotifications = notifications.filter((item) =>
    hideRevoked ? item.status !== "revoked" : true
  );
  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedNotifications = filteredNotifications.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  return (
    <div className="notifications">
      <div className="notifications-header">
        <div className="crumb">
          <FontAwesomeIcon icon={faInbox} className="crumb-icon" />
          <span>Access Requests</span>
        </div>
        <button className="pill-btn" onClick={loadNotifications} disabled={loading}>
          <FontAwesomeIcon icon={faRotateRight} />
          <span>Refresh</span>
        </button>
      </div>
      <div className="notifications-filters">
        <label className="notifications-toggle">
          <input
            type="checkbox"
            checked={hideRevoked}
            onChange={(e) => {
              setHideRevoked(e.target.checked);
              setPage(1);
            }}
          />
          Hide revoked
        </label>
        <div className="notifications-count">
          Showing {filteredNotifications.length} request(s)
        </div>
        <button
          className="pill-btn"
          onClick={clearRevoked}
          disabled={clearingRevoked || !notifications.some((item) => item.status === "revoked")}
        >
          {clearingRevoked ? "Clearing..." : "Clear revoked"}
        </button>
      </div>

      {error && <div className="notifications-error">{error}</div>}
      {inboxUrl && (
        <div className="notifications-inbox">
          Inbox: <a href={inboxUrl}>{inboxUrl}</a>
        </div>
      )}

      {loading ? (
        <div className="notifications-empty">Loading notifications...</div>
      ) : filteredNotifications.length === 0 ? (
        <div className="notifications-empty">No access requests found.</div>
      ) : (
        <div className="notifications-list">
          {pagedNotifications.map((item) => (
            <div className="notification-card" key={item.id}>
              <div className="notification-head">
                <div>
                  <div className="notification-title">
                    {item.datasetTitle || "Untitled dataset"}
                  </div>
                  <div className="notification-subtitle">
                    ID: {item.datasetIdentifier || "N/A"}
                  </div>
                </div>
                <span className={`status-pill status-${item.status}`}>
                  {item.status}
                </span>
              </div>

              <div className="notification-meta">
                <div><strong>Requested:</strong> {formatDateTime(item.createdAt)}</div>
                <div><strong>Requester:</strong> {item.requesterName || "N/A"}</div>
                <div><strong>Email:</strong> {item.requesterEmail || "N/A"}</div>
                <div className="notification-webid">
                  <strong>WebID:</strong> {item.requesterWebId || "N/A"}
                </div>
              </div>

              {item.message && (
                <div className="notification-message">
                  <strong>Message:</strong> {item.message}
                </div>
              )}

              <div className="notification-links">
                {item.datasetAccessUrl && (
                  <a href={item.datasetAccessUrl} target="_blank" rel="noopener noreferrer">
                    Dataset
                  </a>
                )}
                {item.datasetSemanticModelUrl && (
                  <a href={item.datasetSemanticModelUrl} target="_blank" rel="noopener noreferrer">
                    Semantic Model
                  </a>
                )}
                {item.catalogUrl && (
                  <a href={item.catalogUrl} target="_blank" rel="noopener noreferrer">
                    Catalog
                  </a>
                )}
              </div>

              {item.status !== "pending" && (
                <div className="notification-decision">
                  <div><strong>Decision:</strong> {item.status}</div>
                  <div><strong>Decided At:</strong> {formatDateTime(item.decidedAt)}</div>
                  <div><strong>Expires:</strong> {formatDateTime(item.expiresAt)}</div>
                  {item.decisionComment && (
                    <div><strong>Comment:</strong> {item.decisionComment}</div>
                  )}
                </div>
              )}

              {item.status === "pending" && (
                <div className="notification-actions">
                  <div className="notification-inputs">
                    <label>
                      Comment
                      <textarea
                        value={decisionNotes[item.id] || ""}
                        onChange={(e) =>
                          setDecisionNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder="Optional comment..."
                      />
                    </label>
                    <label>
                      Expiry (optional)
                      <input
                        type="datetime-local"
                        value={decisionExpiry[item.id] || ""}
                        onChange={(e) =>
                          setDecisionExpiry((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                      />
                    </label>
                    <div className="notification-note">
                      Approve grants read access only.
                    </div>
                  </div>
                  <div className="notification-buttons">
                    <button
                      className="btn-approve"
                      onClick={() => handleDecision(item, "approved")}
                      disabled={processingId === item.id}
                    >
                      <FontAwesomeIcon icon={faCheck} /> Approve
                    </button>
                    <button
                      className="btn-deny"
                      onClick={() => handleDecision(item, "denied")}
                      disabled={processingId === item.id}
                    >
                      <FontAwesomeIcon icon={faXmark} /> Deny
                    </button>
                  </div>
                </div>
              )}
              {item.status === "approved" && (
                <div className="notification-buttons">
                  <button
                    className="btn-deny"
                    onClick={() => handleDecision(item, "revoked")}
                    disabled={processingId === item.id}
                  >
                    <FontAwesomeIcon icon={faXmark} /> Revoke
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!loading && filteredNotifications.length > pageSize && (
        <div className="notifications-pagination">
          <button
            className="pill-btn"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span className="notifications-page">
            Page {safePage} of {totalPages}
          </span>
          <button
            className="pill-btn"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default Notifications;
