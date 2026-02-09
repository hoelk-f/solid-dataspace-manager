import React from "react";
import "./Info.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleInfo,
  faFolderOpen,
  faUserGear,
  faInbox,
  faBell,
  faBookOpen,
  faHexagonNodes,
  faDatabase,
  faTemperatureHigh,
  faNetworkWired,
  faShieldHalved,
  faLightbulb,
  faCompass
} from "@fortawesome/free-solid-svg-icons";

function Info() {
  return (
    <div className="info-page">
      <div className="toolbar toolbar--title">
        <div className="crumb">
          <FontAwesomeIcon icon={faCircleInfo} className="crumb-icon" />
          <span>Information</span>
        </div>
        <div />
      </div>

      <section className="info-hero">
        <div>
          <div className="info-kicker">
            <FontAwesomeIcon icon={faCompass} />
            <span>Plain language</span>
          </div>
          <h1>What is the Solid Dataspace?</h1>
          <p>
            Solid Dataspace brings several tools together so data can be stored in a personal Pod,
            described with metadata, discovered in a catalog, and shared in a controlled way.
            You stay in charge of where your data lives and who can access it.
          </p>
        </div>
        <div className="info-hero-card">
          <div className="info-hero-title">
            <FontAwesomeIcon icon={faShieldHalved} />
            <span>Your data, your rules</span>
          </div>
        </div>
      </section>

      <section className="info-grid">
        <div className="info-card">
          <div className="info-card-title">
            <FontAwesomeIcon icon={faFolderOpen} />
            <span>Solid Data Manager</span>
          </div>
          <p>
            Your file manager for the Pod. Upload files, organize folders, and control who can
            access them.
          </p>
          <span className="info-chip">Files and folders</span>
        </div>

        <div className="info-card">
          <div className="info-card-title">
            <FontAwesomeIcon icon={faUserGear} />
            <span>Profile Manager</span>
          </div>
          <p>
            Maintain your WebID profile and set up the inbox, catalog, and registry. This is the
            foundation for everything else.
          </p>
          <span className="info-chip">Profile setup</span>
        </div>

        <div className="info-card">
          <div className="info-card-title">
            <FontAwesomeIcon icon={faBell} />
            <span>Access Requests</span>
          </div>
          <p>
            Requests arrive here when someone wants to use your data. You decide to approve, deny,
            or set an expiry date.
          </p>
          <span className="info-chip">Requests</span>
        </div>

        <div className="info-card">
          <div className="info-card-title">
            <FontAwesomeIcon icon={faInbox} />
            <span>Access Decisions</span>
          </div>
          <p>
            Decisions on your own requests show up here, so you can quickly see if access was granted.
          </p>
          <span className="info-chip">Responses</span>
        </div>

        <div className="info-card">
          <div className="info-card-title">
            <FontAwesomeIcon icon={faBookOpen} />
            <span>Semantic Data Catalog</span>
          </div>
          <p>
            The discovery and publishing portal. Providers publish datasets, and others can find them
            and request access.
          </p>
          <span className="info-chip">Find and publish</span>
        </div>

        <div className="info-card">
          <div className="info-card-title">
            <FontAwesomeIcon icon={faHexagonNodes} />
            <span>PLASMA</span>
          </div>
          <p>
            A semantic modeling tool that adds meaning to datasets so they are easier to understand
            and reuse.
          </p>
          <span className="info-chip">Semantics</span>
        </div>

        <div className="info-card">
          <div className="info-card-title">
            <FontAwesomeIcon icon={faDatabase} />
            <span>Node-RED</span>
          </div>
          <p>
            For live data and automation. Data streams can be collected, processed, and stored directly
            in Pods.
          </p>
          <span className="info-chip">Data streams</span>
        </div>

        <div className="info-card">
          <div className="info-card-title">
            <FontAwesomeIcon icon={faTemperatureHigh} />
            <span>Urban Heat Monitoring</span>
          </div>
          <p>
            An example application that uses catalog data to visualize urban heat conditions.
          </p>
          <span className="info-chip">Example app</span>
        </div>
      </section>

      <section className="info-flow">
        <div className="info-flow-head">
          <FontAwesomeIcon icon={faNetworkWired} />
          <div>
            <h2>How a data flow works</h2>
            <p>From dataset to usage in five simple steps.</p>
          </div>
        </div>
        <ol className="info-steps">
          <li>
            <strong>Store data:</strong> Files live in your Pod (via the Data Manager or Node-RED).
          </li>
          <li>
            <strong>Describe:</strong> PLASMA adds meaning with metadata and semantics.
          </li>
          <li>
            <strong>Publish:</strong> The Semantic Data Catalog makes datasets discoverable.
          </li>
          <li>
            <strong>Request:</strong> Others request access through the catalog.
          </li>
          <li>
            <strong>Decide:</strong> You grant or deny access. Everything stays traceable.
          </li>
        </ol>
      </section>

      <section className="info-faq">
        <div className="info-faq-head">
          <FontAwesomeIcon icon={faLightbulb} />
          <div>
            <h2>Key terms</h2>
            <p>Quick definitions to get started.</p>
          </div>
        </div>
        <div className="info-faq-grid">
          <div className="info-faq-card">
            <h3>Pod</h3>
            <p>Your personal data store online, similar to a cloud drive, but under your control.</p>
          </div>
          <div className="info-faq-card">
            <h3>WebID</h3>
            <p>Your digital identity that connects you to your Pod and permissions.</p>
          </div>
          <div className="info-faq-card">
            <h3>Inbox</h3>
            <p>The entry point for notifications such as access requests and decisions.</p>
          </div>
          <div className="info-faq-card">
            <h3>Catalog</h3>
            <p>A directory that describes what datasets exist and how to find them.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Info;
