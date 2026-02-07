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
  getDatetime,
  deleteFile,
} from "@inrupt/solid-client";
import { LDP, RDF } from "@inrupt/vocab-common-rdf";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faRotateRight, faTrash } from "@fortawesome/free-solid-svg-icons";
import ConfirmModal from "./ConfirmModal";
import "./Notifications.css";

const SDM_NS = "https://w3id.org/solid-dataspace-manager#";
const SDM = {
  AccessDecision: `${SDM_NS}AccessDecision`,
  decision: `${SDM_NS}decision`,
  decidedAt: `${SDM_NS}decidedAt`,
  requesterWebId: `${SDM_NS}requesterWebId`,
  requesterName: `${SDM_NS}requesterName`,
  requesterEmail: `${SDM_NS}requesterEmail`,
  datasetIdentifier: `${SDM_NS}datasetIdentifier`,
  datasetTitle: `${SDM_NS}datasetTitle`,
  datasetAccessUrl: `${SDM_NS}datasetAccessUrl`,
  datasetSemanticModelUrl: `${SDM_NS}datasetSemanticModelUrl`,
  catalogUrl: `${SDM_NS}catalogUrl`,
  decisionComment: `${SDM_NS}decisionComment`,
  expiresAt: `${SDM_NS}expiresAt`,
};

const DCT_CREATED = "http://purl.org/dc/terms/created";
const DCT_TITLE = "http://purl.org/dc/terms/title";
const LAST_SEEN_DECISIONS_KEY = "sdm-last-seen-decisions";

const noCacheFetch = (input, init = {}) =>
  session.fetch(input, {
    ...init,
    cache: "no-store",
    headers: { ...(init.headers || {}), "Cache-Control": "no-cache" },
  });

const formatDateTime = (value) => {
  if (!value) return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getPodRoot = (webId) => {
  if (!webId) return "";
  try {
    const url = new URL(webId);
    const profileIndex = url.pathname.indexOf("/profile/");
    const basePath =
      profileIndex >= 0 ? url.pathname.slice(0, profileIndex + 1) : url.pathname;
    return `${url.origin}${basePath}`;
  } catch {
    return webId;
  }
};

const getOwnerRoot = (item) => {
  const url = item.datasetAccessUrl || item.datasetSemanticModelUrl || item.catalogUrl || "";
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const trimmed = parsed.pathname.split("/").filter(Boolean);
    const rootPath = trimmed.length ? `/${trimmed[0]}/` : "/";
    return `${parsed.origin}${rootPath}`;
  } catch {
    return "";
  }
};

const getProviderRoot = (item, webId) => {
  const selfRoot = getPodRoot(webId);
  const ownerRoot = getOwnerRoot(item);
  if (ownerRoot && ownerRoot !== selfRoot) return ownerRoot;
  return ownerRoot || "unknown pod";
};

const DecisionInbox = ({ webId }) => {
  const [inboxUrl, setInboxUrl] = useState("");
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hideClosed, setHideClosed] = useState(true);
  const [page, setPage] = useState(1);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmAction, setConfirmAction] = useState("");
  const [confirmTargetId, setConfirmTargetId] = useState("");
  const pageSize = 5;

  const resolveInboxUrl = async () => {
    const profileDataset = await getSolidDataset(webId, { fetch: noCacheFetch });
    const profile = getThing(profileDataset, webId);
    return profile ? getUrl(profile, LDP.inbox) : null;
  };

  const loadDecisionThing = async (url) => {
    const dataset = await getSolidDataset(url, { fetch: noCacheFetch });
    const thing = getThing(dataset, url) || getThingAll(dataset)[0];
    return { dataset, thing };
  };

  const parseDecision = (url, thing) => {
    if (!thing) return null;
    const types = getUrlAll(thing, RDF.type);
    if (!types.includes(SDM.AccessDecision)) return null;

    const timestampMatch = url.match(/(\d{10,})(?:\/)?$/);
    const urlTime = timestampMatch ? Number(timestampMatch[1]) : 0;

    return {
      id: url,
      decision: getStringNoLocale(thing, SDM.decision) || "",
      decidedAt: getDatetime(thing, SDM.decidedAt) || getStringNoLocale(thing, SDM.decidedAt) || "",
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
      decisionComment: getStringNoLocale(thing, SDM.decisionComment) || "",
      expiresAt: getStringNoLocale(thing, SDM.expiresAt) || "",
      createdAt: getDatetime(thing, DCT_CREATED) || getStringNoLocale(thing, DCT_CREATED) || "",
      urlTime,
    };
  };

  const buildDecisionKey = (item) =>
    item.datasetIdentifier ||
    item.datasetAccessUrl ||
    item.datasetSemanticModelUrl ||
    item.catalogUrl ||
    item.id;

  const getDecisionTime = (item) =>
    Date.parse(item.decidedAt || item.createdAt) || item.urlTime || 0;

  const loadDecisions = async () => {
    setLoading(true);
    setError("");
    try {
      const inbox = await resolveInboxUrl();
      if (!inbox) {
        setInboxUrl("");
        setDecisions([]);
        setError("No Solid inbox found for this profile.");
        return;
      }
      setInboxUrl(inbox);

      const inboxDataset = await getSolidDataset(inbox, { fetch: noCacheFetch });
      const resourceUrls = getContainedResourceUrlAll(inboxDataset);
      const rawItems = await Promise.all(
        resourceUrls.map(async (url) => {
          try {
            const { thing } = await loadDecisionThing(url);
            return parseDecision(url, thing);
          } catch (err) {
            console.warn("Failed to parse decision:", url, err);
            return null;
          }
        })
      );

      const filtered = rawItems.filter(Boolean);
      const latestByKey = new Map();
      filtered.forEach((item) => {
        const key = buildDecisionKey(item);
        const existing = latestByKey.get(key);
        if (!existing || getDecisionTime(item) > getDecisionTime(existing)) {
          latestByKey.set(key, item);
        }
      });
      const latest = Array.from(latestByKey.values());
      latest.sort((a, b) => getDecisionTime(b) - getDecisionTime(a));

      setDecisions(latest);
      localStorage.setItem(LAST_SEEN_DECISIONS_KEY, new Date().toISOString());
    } catch (err) {
      console.error("Failed to load decisions:", err);
      setError("Failed to load access decisions.");
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDecisionConfirm = (item) => {
    if (!item?.id) return;
    setConfirmTitle("Delete Decision");
    setConfirmMessage("Delete this decision?");
    setConfirmAction("deleteOne");
    setConfirmTargetId(item.id);
    setConfirmOpen(true);
  };

  const deleteDecision = async (id) => {
    if (!id) return;
    await deleteFile(id, { fetch: noCacheFetch });
    await loadDecisions();
  };

  const handleConfirm = async () => {
    if (confirmAction === "deleteOne") {
      await deleteDecision(confirmTargetId);
    }
    setConfirmOpen(false);
    setConfirmAction("");
    setConfirmTargetId("");
  };

  useEffect(() => {
    if (!webId) return;
    loadDecisions();
  }, [webId]);

  const filteredDecisions = decisions.filter((item) =>
    hideClosed ? item.decision !== "revoked" && item.decision !== "denied" : true
  );
  const totalPages = Math.max(1, Math.ceil(filteredDecisions.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedDecisions = filteredDecisions.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  return (
    <div className="notifications">
      <div className="notifications-header toolbar--title">
        <div className="crumb">
          <FontAwesomeIcon icon={faBell} className="crumb-icon" />
          <span>Access Decisions</span>
        </div>
        <button className="pill-btn" onClick={loadDecisions} disabled={loading}>
          <FontAwesomeIcon icon={faRotateRight} />
          <span>Refresh</span>
        </button>
      </div>
      <div className="notifications-filters">
        <label className="notifications-toggle">
          <input
            type="checkbox"
            checked={hideClosed}
            onChange={(e) => {
              setHideClosed(e.target.checked);
              setPage(1);
            }}
          />
          Hide closed
        </label>
        <div className="notifications-count">
          Showing {filteredDecisions.length} decision(s)
        </div>
      </div>

      {error && <div className="notifications-error">{error}</div>}
      {inboxUrl && (
        <div className="notifications-inbox">
          Inbox: <a href={inboxUrl}>{inboxUrl}</a>
        </div>
      )}

      {loading ? (
        <div className="notifications-empty">Loading decisions...</div>
      ) : filteredDecisions.length === 0 ? (
        <div className="notifications-empty">No access decisions found.</div>
      ) : (
        <div className="notifications-list">
          {pagedDecisions.map((item) => (
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
                <div className="notification-actions-inline">
                  <span className={`status-pill status-${item.decision || "pending"}`}>
                    {item.decision === "revoked" || item.decision === "denied"
                      ? "closed"
                      : item.decision || "unknown"}
                  </span>
                  <button
                    className="icon-btn icon-btn--danger"
                    type="button"
                    onClick={() => openDeleteDecisionConfirm(item)}
                    title="Delete decision"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </div>

              <div className="notification-meta">
                <div>
                  <strong>Decided:</strong> {formatDateTime(item.decidedAt || item.createdAt)}
                </div>
                <div><strong>Expires:</strong> {formatDateTime(item.expiresAt)}</div>
                <div><strong>Provider:</strong> {getProviderRoot(item, webId)}</div>
              </div>

              {item.decisionComment && (
                <div className="notification-message">
                  <strong>Comment:</strong> {item.decisionComment}
                </div>
              )}

            </div>
          ))}
        </div>
      )}
      {!loading && filteredDecisions.length > pageSize && (
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
      <ConfirmModal
        show={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel="Delete"
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export default DecisionInbox;
