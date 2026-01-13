import React from "react";
import "./Info.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTableColumns,
  faBookOpen,
  faHexagonNodes,
  faDatabase,
  faTemperatureHigh,
  faCircleInfo,
  faBell,
  faInbox,
  faUserGear
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
      <p className="info-intro">
        Solid Dataspace Manager is a prototype dataspace built on Solid, the decentralised data platform
        initiated by web inventor Tim Berners-Lee. Solid lets individuals store information in personal
        online data stores called Pods that they control. Using open standards for authentication and
        data interchange, Pods allow people to decide where their data lives, who can access it, and to
        move between applications without losing control.
      </p>

      <div className="info-section">
        <h2>
          <FontAwesomeIcon icon={faTableColumns} /> Data Manager
        </h2>
        <p>
          The Data Manager lets you browse and control the files in your Solid Pod. You can upload,
          download, share, and revoke access to resources directly from your pod storage.
        </p>
      </div>

      <div className="info-section">
        <h2>
          <FontAwesomeIcon icon={faUserGear} /> Profile Manager
        </h2>
        <p>
          The Profile Manager helps you maintain your WebID profile with your name, organization,
          role, email, and profile photo. It also provides tools to configure your Solid inbox and
          to initialize the Solid catalog structure that stores your metadata in your pod.
        </p>
      </div>

      <div className="info-section">
        <h2>
          <FontAwesomeIcon icon={faBell} /> Access Requests
        </h2>
        <p>
          Incoming access requests from the Semantic Data Catalog arrive as notifications. You can
          review requester details, approve or deny access, set optional expirations, and leave a
          comment for the requester.
        </p>
      </div>

      <div className="info-section">
        <h2>
          <FontAwesomeIcon icon={faInbox} /> Access Decisions
        </h2>
        <p>
          When someone grants or revokes access to your requests, the decision is delivered to your
          inbox and shown here. This keeps the status of your requests in one place.
        </p>
      </div>

      <div className="info-section">
        <h2>
          <FontAwesomeIcon icon={faBookOpen} /> Semantic Data Catalog
        </h2>
        <p>
          The catalog is the entry point to the dataspace. It allows providers to publish datasets and
          consumers to discover and reuse data sources hosted in Pods. Catalog metadata lives inside
          each owner&apos;s pod under a <code>catalog/</code> container and is discovered through a public
          type index plus a registry of dataspace members.
        </p>
      </div>

      <div className="info-section">
        <h2>
          <FontAwesomeIcon icon={faHexagonNodes} /> PLASMA
        </h2>
        <p>
          PLASMA is a semantic modelling tool for enriching datasets with machine-readable context. The
          resulting descriptions are uploaded to the Semantic Data Catalog so others can understand and
          integrate the data.
        </p>
      </div>

      <div className="info-section">
        <h2>
          <FontAwesomeIcon icon={faDatabase} /> Node-RED
        </h2>
        <p>
          Node-RED provides real-time data integration. Flows collect data streams and store them in
          Solid Pods, keeping live information available within the dataspace.
        </p>
        <p>
          Use the credentials <code>solid-dataspace</code> and  <code> QsLumGq^BSJr^eB2xM%4</code> to sign in to the Node-RED dashboard.
        </p>
      </div>

      <div className="info-section">
        <h2>
          <FontAwesomeIcon icon={faTemperatureHigh} /> Urban Heat Monitoring
        </h2>
        <p>
          The Smart City Urban Heat Monitoring application consumes catalogued datasets to visualise
          temperature conditions, demonstrating how published data can power useful services.
        </p>
      </div>

      <div className="info-section">
        <h2>
          <FontAwesomeIcon icon={faCircleInfo} /> How it all connects
        </h2>
        <p>
          Data flows into Solid Pods via tools like Node-RED or manual uploads through the Data Manager.
          PLASMA adds semantic annotations before datasets are published in the Semantic Data Catalog.
          The catalog UI aggregates metadata from all registered pod catalogs. Access requests are
          handled in the Manager, while decisions are delivered back to requesters through inbox
          notifications. Together these components form the Solid Dataspace.
        </p>
      </div>
    </div>
  );
}

export default Info;
