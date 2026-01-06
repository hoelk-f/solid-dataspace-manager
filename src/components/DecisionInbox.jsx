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
} from "@inrupt/solid-client";
import { LDP, RDF } from "@inrupt/vocab-common-rdf";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faRotateRight } from "@fortawesome/free-solid-svg-icons";
import "./Notifications.css";

const SDM_NS = "https://w3id.org/solid-dataspace-manager#";
const SDM = {
  AccessDecision: `${SDM_NS}AccessDecision`,
  decision: `${SDM_NS}decision`,
  requesterWebId: `${SDM_NS}requesterWebId`,
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

const DecisionInbox = ({ webId }) => {
  const [inboxUrl, setInboxUrl] = useState("");
  const [decisions, setDecisions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

    return {
      id: url,
      decision: getStringNoLocale(thing, SDM.decision) || "",
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
    };
  };

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
      filtered.sort((a, b) => {
        const aTime = Date.parse(a.createdAt) || 0;
        const bTime = Date.parse(b.createdAt) || 0;
        return bTime - aTime;
      });

      setDecisions(filtered);
    } catch (err) {
      console.error("Failed to load decisions:", err);
      setError("Failed to load access decisions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!webId) return;
    loadDecisions();
  }, [webId]);

  return (
    <div className="notifications">
      <div className="notifications-header">
        <div className="crumb">
          <FontAwesomeIcon icon={faBell} className="crumb-icon" />
          <span>Access Decisions</span>
        </div>
        <button className="pill-btn" onClick={loadDecisions} disabled={loading}>
          <FontAwesomeIcon icon={faRotateRight} />
          <span>Refresh</span>
        </button>
      </div>

      {error && <div className="notifications-error">{error}</div>}
      {inboxUrl && (
        <div className="notifications-inbox">
          Inbox: <a href={inboxUrl}>{inboxUrl}</a>
        </div>
      )}

      {loading ? (
        <div className="notifications-empty">Loading decisions...</div>
      ) : decisions.length === 0 ? (
        <div className="notifications-empty">No access decisions found.</div>
      ) : (
        <div className="notifications-list">
          {decisions.map((item) => (
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
                <span className={`status-pill status-${item.decision || "pending"}`}>
                  {item.decision || "unknown"}
                </span>
              </div>

              <div className="notification-meta">
                <div><strong>Decided:</strong> {formatDateTime(item.createdAt)}</div>
                <div className="notification-webid">
                  <strong>Requester:</strong> {item.requesterWebId || "N/A"}
                </div>
                <div><strong>Expires:</strong> {formatDateTime(item.expiresAt)}</div>
              </div>

              {item.decisionComment && (
                <div className="notification-message">
                  <strong>Comment:</strong> {item.decisionComment}
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DecisionInbox;
