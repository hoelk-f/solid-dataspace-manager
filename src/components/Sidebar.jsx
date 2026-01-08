// Sidebar.jsx
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTableColumns,
  faBookOpen,
  faHexagonNodes,
  faDatabase,
  faUser,
  faRightFromBracket,
  faInfo,
  faFile,
  faServer,
  faInbox,
  faBell
} from "@fortawesome/free-solid-svg-icons";
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
import "./Sidebar.css";

const SDM_NS = "https://w3id.org/solid-dataspace-manager#";
const SDM = {
  AccessRequest: `${SDM_NS}AccessRequest`,
  AccessDecision: `${SDM_NS}AccessDecision`,
};
const DCT_CREATED = "http://purl.org/dc/terms/created";
const LAST_SEEN_REQUESTS_KEY = "sdm-last-seen-requests";
const LAST_SEEN_DECISIONS_KEY = "sdm-last-seen-decisions";

const noCacheFetch = (input, init = {}) =>
  session.fetch(input, {
    ...init,
    cache: "no-store",
    headers: { ...(init.headers || {}), "Cache-Control": "no-cache" },
  });

function Sidebar() {
  const { pathname } = useLocation();
  const isActive = (to) => pathname === to;
  const [unreadRequests, setUnreadRequests] = useState(0);
  const [unreadDecisions, setUnreadDecisions] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer;

    const resolveInboxUrl = async (webId) => {
      const profileDataset = await getSolidDataset(webId, { fetch: noCacheFetch });
      const profile = getThing(profileDataset, webId);
      return profile ? getUrl(profile, LDP.inbox) : null;
    };

    const parseTypes = (thing) => getUrlAll(thing, RDF.type);

    const countUnread = async () => {
      if (!session.info.isLoggedIn || !session.info.webId) return;
      try {
        const inbox = await resolveInboxUrl(session.info.webId);
        if (!inbox) {
          if (!cancelled) {
            setUnreadRequests(0);
            setUnreadDecisions(0);
          }
          return;
        }

        const lastSeenRequests = Date.parse(
          localStorage.getItem(LAST_SEEN_REQUESTS_KEY) || ""
        ) || 0;
        const lastSeenDecisions = Date.parse(
          localStorage.getItem(LAST_SEEN_DECISIONS_KEY) || ""
        ) || 0;

        const inboxDataset = await getSolidDataset(inbox, { fetch: noCacheFetch });
        const resourceUrls = getContainedResourceUrlAll(inboxDataset);

        let requestCount = 0;
        let decisionCount = 0;

        await Promise.all(
          resourceUrls.map(async (url) => {
            try {
              const dataset = await getSolidDataset(url, { fetch: noCacheFetch });
              const thing = getThing(dataset, url) || getThingAll(dataset)[0];
              if (!thing) return;
              const types = parseTypes(thing);
              const createdAt = getStringNoLocale(thing, DCT_CREATED) || "";
              const createdTime = Date.parse(createdAt) || 0;

              if (types.includes(SDM.AccessRequest) && createdTime > lastSeenRequests) {
                requestCount += 1;
              }
              if (types.includes(SDM.AccessDecision) && createdTime > lastSeenDecisions) {
                decisionCount += 1;
              }
            } catch {
              // Ignore malformed inbox items.
            }
          })
        );

        if (!cancelled) {
          setUnreadRequests(requestCount);
          setUnreadDecisions(decisionCount);
        }
      } catch {
        if (!cancelled) {
          setUnreadRequests(0);
          setUnreadDecisions(0);
        }
      }
    };

    const startPolling = () => {
      if (!session.info.isLoggedIn || !session.info.webId) return;
      countUnread();
      timer = setInterval(countUnread, 15000);
    };

    startPolling();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await session.logout();
      window.location.href = "/";
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-logo">
          <img src="/Logo_TMDT.png" alt="TMDT Logo" />
        </div>
      </div>

      <nav className="sb-nav">
        <div className="sb-section">General</div>
        <Link to="/" className={"sb-link" + (isActive("/") ? " active" : "")}>
          <FontAwesomeIcon icon={faTableColumns} />
          <span>Data Manager</span>
        </Link>
        <Link
          to="/notifications"
          className={"sb-link" + (isActive("/notifications") ? " active" : "")}
        >
          <span className="sb-icon">
            <FontAwesomeIcon icon={faInbox} />
            {unreadRequests > 0 && (
              <span className="sb-badge">{unreadRequests > 9 ? "9+" : unreadRequests}</span>
            )}
          </span>
          <span>Access Requests</span>
        </Link>
        <Link
          to="/decisions"
          className={"sb-link" + (isActive("/decisions") ? " active" : "")}
        >
          <span className="sb-icon">
            <FontAwesomeIcon icon={faBell} />
            {unreadDecisions > 0 && (
              <span className="sb-badge">{unreadDecisions > 9 ? "9+" : unreadDecisions}</span>
            )}
          </span>
          <span>Access Decisions</span>
        </Link>
        <Link
          to="/profile"
          className={"sb-link" + (isActive("/profile") ? " active" : "")}
        >
          <FontAwesomeIcon icon={faUser} />
          <span>Profile Manager</span>
        </Link>
        <Link to="/info" className={"sb-link" + (isActive("/info") ? " active" : "")}>
          <FontAwesomeIcon icon={faInfo} />
          <span>Information</span>
        </Link>

        <div className="sb-section">Consume and Provide</div>
        <a
          href="/semantic-data-catalog/"
          className="sb-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FontAwesomeIcon icon={faBookOpen} />
          <span>Semantic Data Catalog</span>
        </a>
        <Link to="/web/plasma" className="sb-link">
          <FontAwesomeIcon icon={faHexagonNodes} />
          <span>PLASMA</span>
        </Link>
        <Link to="/web/node-red" className="sb-link">
          <FontAwesomeIcon icon={faDatabase} />
          <span>Node-RED</span>
        </Link>

        <div className="sb-section">Applications</div>
        <Link to="/web/urban-heat-monitoring" className="sb-link">
          <FontAwesomeIcon icon={faFile} />
          <span>Urban Heat Monitoring</span>
        </Link>

        <div className="sb-section">Miscellaneous</div>
        <a
          href="https://tmdt-solid-community-server.de"
          className="sb-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          <FontAwesomeIcon icon={faServer} />
          <span>Solid Pod Provider</span>
        </a>
      </nav>

      <div className="sb-bottom">
        <button onClick={handleLogout} className="icon-pill danger">
          <FontAwesomeIcon icon={faRightFromBracket} />
          <span>Logout</span>
        </button>
        <div className="sb-foot">© 2025 TMDT</div>
      </div>
    </aside>
  );
}

export default Sidebar;
