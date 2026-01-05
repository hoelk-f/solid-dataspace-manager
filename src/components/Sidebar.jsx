// Sidebar.jsx
import React from "react";
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
  faInbox
} from "@fortawesome/free-solid-svg-icons";
import session from "../solidSession";
import "./Sidebar.css";

function Sidebar() {
  const { pathname } = useLocation();
  const isActive = (to) => pathname === to;

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
          <FontAwesomeIcon icon={faInbox} />
          <span>Access Requests</span>
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
