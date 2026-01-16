import React, { useEffect, useMemo, useState, useRef } from "react";
import session from "../solidSession";
import {
  getSolidDataset,
  getContainedResourceUrlAll,
  getThing,
  getThingAll,
  getUrl,
  getUrlAll,
  getStringNoLocale,
} from "@inrupt/solid-client";
import { LDP, RDF } from "@inrupt/vocab-common-rdf";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartLine,
  faLink,
  faRightLeft,
  faDatabase,
  faDownload,
} from "@fortawesome/free-solid-svg-icons";
import "./TransactionHistory.css";

const SDM_NS = "https://w3id.org/solid-dataspace-manager#";
const SDM = {
  AccessRequest: `${SDM_NS}AccessRequest`,
  AccessDecision: `${SDM_NS}AccessDecision`,
  status: `${SDM_NS}status`,
  decision: `${SDM_NS}decision`,
  decidedAt: `${SDM_NS}decidedAt`,
  requesterWebId: `${SDM_NS}requesterWebId`,
  datasetIdentifier: `${SDM_NS}datasetIdentifier`,
  datasetTitle: `${SDM_NS}datasetTitle`,
  datasetAccessUrl: `${SDM_NS}datasetAccessUrl`,
  datasetSemanticModelUrl: `${SDM_NS}datasetSemanticModelUrl`,
  catalogUrl: `${SDM_NS}catalogUrl`,
  decisionComment: `${SDM_NS}decisionComment`,
  expiresAt: `${SDM_NS}expiresAt`,
  message: `${SDM_NS}message`,
};

const DCT_CREATED = "http://purl.org/dc/terms/created";
const DCT_TITLE = "http://purl.org/dc/terms/title";

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

const buildDecisionKey = (item) => {
  const parts = [
    item.requesterWebId || "",
    item.datasetIdentifier || "",
    item.datasetAccessUrl || "",
    item.datasetSemanticModelUrl || "",
  ];
  return parts.join("|");
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

const getDecisionTime = (item) =>
  Date.parse(item.decidedAt || item.createdAt) || item.urlTime || 0;

const isExpired = (item) => {
  if (!item.expiresAt) return false;
  const time = Date.parse(item.expiresAt);
  if (Number.isNaN(time)) return false;
  return time < Date.now();
};

const TransactionHistory = ({ webId }) => {
  const [inboxUrl, setInboxUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [decisions, setDecisions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [vizScale, setVizScale] = useState(1);
  const [vizOffset, setVizOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [draggingPod, setDraggingPod] = useState(null);
  const [podAngles, setPodAngles] = useState([]);
  const dragStart = useRef({ x: 0, y: 0 });
  const ringRef = useRef(null);

  const resolveInboxUrl = async () => {
    const profileDataset = await getSolidDataset(webId, { fetch: noCacheFetch });
    const profile = getThing(profileDataset, webId);
    return profile ? getUrl(profile, LDP.inbox) : null;
  };

  const loadInboxItem = async (url) => {
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
      type: "decision",
      decision: getStringNoLocale(thing, SDM.decision) || "",
      decidedAt: getStringNoLocale(thing, SDM.decidedAt) || "",
      requesterWebId: getUrl(thing, SDM.requesterWebId) || "",
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
      createdAt: getStringNoLocale(thing, DCT_CREATED) || "",
      urlTime,
    };
  };

  const parseRequest = (url, thing) => {
    if (!thing) return null;
    const types = getUrlAll(thing, RDF.type);
    if (!types.includes(SDM.AccessRequest)) return null;

    return {
      id: url,
      type: "request",
      status: getStringNoLocale(thing, SDM.status) || "pending",
      requesterWebId: getUrl(thing, SDM.requesterWebId) || "",
      datasetIdentifier: getStringNoLocale(thing, SDM.datasetIdentifier) || "",
      datasetTitle:
        getStringNoLocale(thing, SDM.datasetTitle) ||
        getStringNoLocale(thing, DCT_TITLE) ||
        "",
      datasetAccessUrl: getUrl(thing, SDM.datasetAccessUrl) || "",
      datasetSemanticModelUrl: getUrl(thing, SDM.datasetSemanticModelUrl) || "",
      catalogUrl: getUrl(thing, SDM.catalogUrl) || "",
      decidedAt: getStringNoLocale(thing, SDM.decidedAt) || "",
      expiresAt: getStringNoLocale(thing, SDM.expiresAt) || "",
      message: getStringNoLocale(thing, SDM.message) || "",
      createdAt: getStringNoLocale(thing, DCT_CREATED) || "",
    };
  };

  const loadTransactions = async () => {
    setLoading(true);
    setError("");
    try {
      const inbox = await resolveInboxUrl();
      if (!inbox) {
        setInboxUrl("");
        setDecisions([]);
        setRequests([]);
        setError("No Solid inbox found for this profile.");
        return;
      }
      setInboxUrl(inbox);

      const inboxDataset = await getSolidDataset(inbox, { fetch: noCacheFetch });
      const resourceUrls = getContainedResourceUrlAll(inboxDataset);
      const rawItems = await Promise.all(
        resourceUrls.map(async (url) => {
          try {
            const { thing } = await loadInboxItem(url);
            return { url, thing };
          } catch (err) {
            console.warn("Failed to parse inbox item:", url, err);
            return null;
          }
        })
      );

      const parsedDecisions = [];
      const parsedRequests = [];
      rawItems.filter(Boolean).forEach(({ url, thing }) => {
        const decision = parseDecision(url, thing);
        if (decision) {
          parsedDecisions.push(decision);
          return;
        }
        const request = parseRequest(url, thing);
        if (request) parsedRequests.push(request);
      });

      parsedDecisions.sort((a, b) => getDecisionTime(b) - getDecisionTime(a));
      parsedRequests.sort((a, b) => getDecisionTime(b) - getDecisionTime(a));

      setDecisions(parsedDecisions);
      setRequests(parsedRequests);
    } catch (err) {
      console.error("Failed to load transactions:", err);
      setError("Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!webId) return;
    loadTransactions();
  }, [webId]);

  const activeConnections = useMemo(() => {
    const combined = [...decisions, ...requests];
    const latestByKey = new Map();

    combined.forEach((item) => {
      const key = buildDecisionKey(item);
      if (!latestByKey.has(key)) {
        latestByKey.set(key, item);
        return;
      }
      const existing = latestByKey.get(key);
      if (getDecisionTime(item) >= getDecisionTime(existing)) {
        latestByKey.set(key, item);
      }
    });

    const activeItems = Array.from(latestByKey.values()).filter((item) => {
      const decision = item.decision || item.status || "";
      return decision === "approved" && !isExpired(item);
    });

    return activeItems.map((item) => ({
      ...item,
      direction: (() => {
        const selfRoot = getPodRoot(webId);
        const ownerRoot = getOwnerRoot(item);
        if (ownerRoot && selfRoot && ownerRoot === selfRoot) return "incoming";
        if (ownerRoot && selfRoot && ownerRoot !== selfRoot) return "outgoing";
        if (item.requesterWebId && item.requesterWebId === webId) return "incoming";
        return "outgoing";
      })(),
    }));
  }, [decisions, requests, webId]);

  const stats = useMemo(() => {
    const incoming = activeConnections.filter((item) => item.direction === "incoming");
    const outgoing = activeConnections.filter((item) => item.direction === "outgoing");
    const datasets = new Set(activeConnections.map((item) => item.datasetIdentifier || item.datasetAccessUrl));
    const partners = new Set(activeConnections.map((item) => item.requesterWebId).filter(Boolean));
    return {
      total: activeConnections.length,
      incoming: incoming.length,
      outgoing: outgoing.length,
      datasets: datasets.size,
      partners: partners.size,
      downloads: null,
    };
  }, [activeConnections]);

  const connectionPairs = useMemo(() => {
    const pairs = [];
    const selfRoot = getPodRoot(webId) || "your pod";
    activeConnections.forEach((item) => {
      const requesterRoot = getPodRoot(item.requesterWebId);
      const ownerRoot = getOwnerRoot(item);
      const partnerRoot =
        item.direction === "incoming" ? requesterRoot || ownerRoot : ownerRoot || requesterRoot;
      pairs.push({
        id: item.id,
        selfRoot,
        partnerRoot: partnerRoot || "unknown pod",
        direction: item.direction,
      });
    });
    return pairs.slice(0, 4);
  }, [activeConnections, webId]);

  useEffect(() => {
    if (!connectionPairs.length) {
      setPodAngles([]);
      return;
    }
    setPodAngles((prev) => {
      if (prev.length === connectionPairs.length) return prev;
      return connectionPairs.map((_, index) => (360 / connectionPairs.length) * index);
    });
  }, [connectionPairs]);

  return (
    <div className="transactions-page">
      <div className="transactions-header toolbar--title">
        <div className="crumb">
          <FontAwesomeIcon icon={faChartLine} className="crumb-icon" />
          <span>Transaction History</span>
        </div>
        <button className="pill-btn" onClick={loadTransactions} disabled={loading}>
          Refresh
        </button>
      </div>

      <div className="transactions-block">
        <div className="transactions-stats">
          <div className="stat-card">
            <div className="stat-label">
              <FontAwesomeIcon icon={faLink} /> Active connections
            </div>
            <div className="stat-value">{stats.total}</div>
            <div className="stat-sub">Current valid access links</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">
              <FontAwesomeIcon icon={faRightLeft} /> Incoming vs outgoing
            </div>
            <div className="stat-value">
              {stats.incoming} / {stats.outgoing}
            </div>
            <div className="stat-sub">Incoming (to you) / Outgoing (from you)</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">
              <FontAwesomeIcon icon={faDatabase} /> Active datasets
            </div>
            <div className="stat-value">{stats.datasets}</div>
            <div className="stat-sub">Datasets with active access</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">
              <FontAwesomeIcon icon={faDownload} /> Catalog downloads
            </div>
            <div className="stat-value">{stats.downloads ?? "—"}</div>
            <div className="stat-sub">Tracking not enabled</div>
          </div>
        </div>

        <div className="transactions-graph-card">
          <div className="transactions-graph-header">
            <span>Active Dataspace Connections</span>
            <span className="graph-meta">{activeConnections.length} link(s)</span>
          </div>
          <div className="dataspace-visual">
            <div
              className="dataspace-visual-inner"
              style={{ transform: `translate(${vizOffset.x}px, ${vizOffset.y}px) scale(${vizScale})` }}
              onMouseDown={(event) => {
                setDragging(true);
                dragStart.current = {
                  x: event.clientX - vizOffset.x,
                  y: event.clientY - vizOffset.y,
                };
              }}
              onMouseMove={(event) => {
                if (draggingPod !== null && ringRef.current) {
                  const rect = ringRef.current.getBoundingClientRect();
                  const cx = rect.left + rect.width / 2;
                  const cy = rect.top + rect.height / 2;
                  const angle = (Math.atan2(event.clientY - cy, event.clientX - cx) * 180) / Math.PI;
                  setPodAngles((prev) => {
                    const next = [...prev];
                    next[draggingPod] = angle;
                    return next;
                  });
                  return;
                }
                if (!dragging) return;
                setVizOffset({
                  x: event.clientX - dragStart.current.x,
                  y: event.clientY - dragStart.current.y,
                });
              }}
              onMouseUp={() => {
                setDragging(false);
                setDraggingPod(null);
              }}
              onMouseLeave={() => {
                setDragging(false);
                setDraggingPod(null);
              }}
              onWheel={(event) => {
                event.preventDefault();
                const delta = event.deltaY > 0 ? -0.05 : 0.05;
                setVizScale((s) => Math.min(2, Math.max(0.6, s + delta)));
              }}
            >
            <div className="dataspace-ring" ref={ringRef}>
              <div className="dataspace-center">SOLID DATASPACE</div>
              {connectionPairs.length === 0 && (
                <div className="dataspace-empty">No active connections</div>
              )}
              {connectionPairs.map((pair, index) => (
                <div
                  key={pair.id}
                  className={`dataspace-connection ${pair.direction === "incoming" ? "conn-incoming" : "conn-outgoing"}`}
                  style={{
                    "--conn-angle": `${podAngles[index] ?? 0}deg`,
                  }}
                >
                  <span className="connection-line" />
                  <div className="pod-card pod-card--a">
                    <div className="pod-title">{pair.selfRoot}</div>
                    <div className="pod-subtitle">Your pod</div>
                  </div>
                  <div className="pod-card pod-card--b">
                    <div className="pod-title">{pair.partnerRoot}</div>
                    <div className="pod-subtitle">
                      {pair.direction === "incoming" ? "Incoming" : "Outgoing"}
                    </div>
                  </div>
                  <div
                    className="pod-drag-handle pod-drag--a"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDraggingPod(index);
                    }}
                  />
                  <div
                    className="pod-drag-handle pod-drag--b"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDraggingPod(index);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

        <div className="transactions-table-card">
          <div className="transactions-table-header">
            <span>Active Connections</span>
            <span className="graph-meta">{activeConnections.length} total</span>
          </div>
          {loading ? (
            <div className="transactions-empty">Loading connections...</div>
          ) : activeConnections.length === 0 ? (
            <div className="transactions-empty">No active connections found.</div>
          ) : (
            <div className="transactions-table">
              <div className="transactions-row transactions-row--head">
                <span>Direction</span>
                <span>Requester</span>
                <span>Dataset</span>
                <span>Last Update</span>
                <span>Expires</span>
              </div>
              {activeConnections.map((item) => (
                <div className="transactions-row" key={item.id}>
                  <span className={`dir-pill dir-${item.direction}`}>
                    {item.direction}
                  </span>
                  <span className="mono">{item.requesterWebId || "N/A"}</span>
                  <span>{item.datasetTitle || item.datasetIdentifier || "Untitled"}</span>
                  <span>{formatDateTime(item.decidedAt || item.createdAt)}</span>
                  <span>{formatDateTime(item.expiresAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <div className="transactions-error">{error}</div>}
    </div>
  );
};

export default TransactionHistory;
