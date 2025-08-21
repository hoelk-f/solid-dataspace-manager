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
  faFile
} from "@fortawesome/free-solid-svg-icons";
import { logout } from "@inrupt/solid-client-authn-browser";

function Sidebar() {
  const { pathname } = useLocation();
  const isActive = (to) => pathname === to;

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = "/";
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sb-brand">
        <div className="sb-logo">
          <img src="/Icon_GesundesTal.png" alt="TMDT Logo" />
        </div>
        <div className="sb-logo">
          <img src="/Icon_DigitalerZwilling.png" alt="Digital Twin Logo" />
        </div>
      </div>

      <nav className="sb-nav">
        <Link to="/" className={"sb-link" + (isActive("/") ? " active" : "")}>
          <FontAwesomeIcon icon={faTableColumns} />
          <span>Data Manager</span>
        </Link>
        <Link
          to="/profile"
          className={"sb-link" + (isActive("/profile") ? " active" : "")}
        >
          <FontAwesomeIcon icon={faUser} />
          <span>Profile Manager</span>
        </Link>

        <div className="sb-section">General</div>
        <Link to="/info" className={"sb-link" + (isActive("/info") ? " active" : "")}>
          <FontAwesomeIcon icon={faInfo} />
          <span>Information</span>
        </Link>
        
        <div className="sb-section">Consume and Provide</div>
        <Link to="/web/catalog" className="sb-link">
          <FontAwesomeIcon icon={faBookOpen} />
          <span>Semantic Data Catalog</span>
        </Link>
        <Link to="/web/plasma" className="sb-link">
          <FontAwesomeIcon icon={faHexagonNodes} />
          <span>PLASMA</span>
        </Link>
        <Link to="/web/nodered" className="sb-link">
          <FontAwesomeIcon icon={faDatabase} />
          <span>Node-RED</span>
        </Link>

        <div className="sb-section">Applications</div>
        <Link to="/web/heat" className="sb-link">
          <FontAwesomeIcon icon={faFile} />
          <span>Urban Heat Monitoring</span>
        </Link>
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
