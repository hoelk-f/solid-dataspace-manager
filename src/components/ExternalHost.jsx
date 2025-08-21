import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { externalLinks } from "../externalLinks";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faUpRightFromSquare } from "@fortawesome/free-solid-svg-icons";

export default function ExternalHost() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const activeLink = externalLinks.find((link) => link.slug === slug);
  const [loaded, setLoaded] = useState(false);

  const isParentHttps =
    typeof window !== "undefined" && window.location.protocol === "https:";
  const targetIsHttp = useMemo(() => {
    try {
      return new URL(activeLink?.url || "").protocol === "http:";
    } catch {
      return false;
    }
  }, [activeLink]);

  if (!activeLink) {
    return (
      <div className="container">
        <div className="toolbar">
          <div className="crumb"><span>Not found</span></div>
          <div className="primary-actions">
            <button className="pill-btn" onClick={() => navigate(-1)}>
              <FontAwesomeIcon icon={faArrowLeft} /><span>Back</span>
            </button>
          </div>
        </div>
        <p>Unknown external link.</p>
      </div>
    );
  }

  const cannotEmbed = isParentHttps && targetIsHttp;

  return (
    <div className="container">
      <div className="toolbar">
        <div className="crumb"><span></span></div>
        <div className="primary-actions">
          <a
            className="pill-btn"
            href={activeLink.url}
            target="_blank"
            rel="noreferrer"
          >
            <FontAwesomeIcon icon={faUpRightFromSquare} /><span>Open</span>
          </a>
        </div>
      </div>

      {cannotEmbed ? (
        <div className="notice">
          <p>This site uses HTTP and cannot be embedded inside an HTTPS app. Open it in a new tab, or serve it via HTTPS or an HTTPS reverse proxy.</p>
        </div>
      ) : (
        <>
          {!loaded && <p>Loading…</p>}
          <div style={{ width: "100%", height: "calc(1000px)" }}>
            <iframe
              src={activeLink.url}
              title={activeLink.title}
              onLoad={() => setLoaded(true)}
              style={{ width: "100%", height: "100%", border: 0 }}
              referrerPolicy="no-referrer-when-downgrade"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads allow-top-navigation-by-user-activation allow-popups-to-escape-sandbox"
            />
          </div>
        </>
      )}
    </div>
  );
}
