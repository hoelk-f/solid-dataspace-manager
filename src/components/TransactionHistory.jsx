import React, { useEffect, useMemo, useState } from "react";
import session from "../solidSession";
import ForceGraph2D from "react-force-graph-2d";
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
    const latestByKey = new Map();
    decisions.forEach((item) => {
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

    const activeDecisions = Array.from(latestByKey.values()).filter(
      (item) => item.decision === "approved" && !isExpired(item)
    );

    const latestRequests = new Map();
    requests.forEach((item) => {
      const key = buildDecisionKey(item);
      if (!latestRequests.has(key)) {
        latestRequests.set(key, item);
        return;
      }
      const existing = latestRequests.get(key);
      if (getDecisionTime(item) >= getDecisionTime(existing)) {
        latestRequests.set(key, item);
      }
    });

    const activeRequests = Array.from(latestRequests.values()).filter(
      (item) => item.status === "approved" && !isExpired(item)
    );

    const incoming = activeRequests.map((item) => ({
      ...item,
      direction: "incoming",
    }));
    const outgoing = activeDecisions.map((item) => ({
      ...item,
      direction: "outgoing",
    }));

    return [...incoming, ...outgoing];
  }, [decisions, requests]);

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

  const graphData = useMemo(() => {
    const nodes = [];
    const links = [];
    const nodeById = new Map();

    const ensureNode = (id, type, label) => {
      if (nodeById.has(id)) return nodeById.get(id);
      const node = { id, type, label };
      nodeById.set(id, node);
      nodes.push(node);
      return node;
    };

    const selfId = webId || "self";
    ensureNode(selfId, "self", "You");

    activeConnections.forEach((conn) => {
      const datasetId = conn.datasetIdentifier || conn.datasetAccessUrl || conn.id;
      const datasetLabel = conn.datasetTitle || datasetId;
      ensureNode(datasetId, "dataset", datasetLabel);
      ensureNode(conn.requesterWebId || "unknown", "partner", conn.requesterWebId || "Unknown");

      if (conn.direction === "incoming") {
        links.push({
          source: conn.requesterWebId || "unknown",
          target: datasetId,
          type: "access",
        });
        links.push({
          source: datasetId,
          target: selfId,
          type: "ownership",
        });
      } else {
        links.push({
          source: selfId,
          target: datasetId,
          type: "access",
        });
      }
    });

    return { nodes, links };
  }, [activeConnections, webId]);

  return (
    <div className="transactions-page">
      <div className="transactions-header">
        <div className="crumb">
          <FontAwesomeIcon icon={faChartLine} className="crumb-icon" />
          <span>Transaction History</span>
        </div>
        <button className="pill-btn" onClick={loadTransactions} disabled={loading}>
          Refresh
        </button>
      </div>

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
        <div className="transactions-graph">
          <ForceGraph2D
            graphData={graphData}
            nodeRelSize={6}
            linkDirectionalParticles={2}
            linkDirectionalParticleWidth={2}
            linkColor={(link) =>
              link.type === "ownership" ? "rgba(56, 189, 248, 0.7)" : "rgba(168, 85, 247, 0.7)"
            }
            nodeColor={(node) => {
              if (node.type === "self") return "#38bdf8";
              if (node.type === "dataset") return "#fbbf24";
              return "#a855f7";
            }}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const label = node.label || node.id;
              const fontSize = 12 / globalScale;
              ctx.font = `${fontSize}px \"SF Pro Text\", sans-serif`;
              ctx.fillStyle = node.type === "dataset" ? "#111827" : "#0f172a";
              ctx.beginPath();
              ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
              ctx.fillStyle =
                node.type === "self"
                  ? "#38bdf8"
                  : node.type === "dataset"
                  ? "#f59e0b"
                  : "#a855f7";
              ctx.fill();
              ctx.fillStyle = "#0f172a";
              ctx.fillText(label, node.x + 8, node.y + 3);
            }}
            nodePointerAreaPaint={(node, color, ctx) => {
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x, node.y, 8, 0, 2 * Math.PI, false);
              ctx.fill();
            }}
          />
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

      {error && <div className="transactions-error">{error}</div>}
      {inboxUrl && (
        <div className="transactions-inbox">
          Inbox: <a href={inboxUrl}>{inboxUrl}</a>
        </div>
      )}
    </div>
  );
};

export default TransactionHistory;
