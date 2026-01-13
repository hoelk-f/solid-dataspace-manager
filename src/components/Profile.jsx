import React, { useEffect, useState, memo } from "react";
import {
  getSolidDataset,
  getSolidDatasetWithAcl,
  getThing,
  getThingAll,
  setThing,
  saveSolidDatasetAt,
  createThing,
  getStringNoLocale,
  getUrl,
  getUrlAll,
  setUrl,
  addUrl,
  setStringNoLocale,
  removeAll,
  overwriteFile,
  createContainerAt,
  getResourceAcl,
  hasResourceAcl,
  hasAccessibleAcl,
  createAclFromFallbackAcl,
  setPublicResourceAccess,
  saveAclFor,
  getContainedResourceUrlAll,
  deleteFile,
  deleteContainer,
} from "@inrupt/solid-client";
import session from "../solidSession";
import { VCARD, FOAF, LDP } from "@inrupt/vocab-common-rdf";
import "./Profile.css";
import AlertModal from "./AlertModal";
import ConfirmModal from "./ConfirmModal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserCircle, faPen, faPlus, faTrash,
  faEnvelope, faInbox, faBookOpen
} from "@fortawesome/free-solid-svg-icons";
import { ensureCatalogStructure, resolveCatalogUrl, resetCatalog } from "../solidCatalog";

const VCARD_TYPE = "http://www.w3.org/2006/vcard/ns#type";

function guessContentType(filename, fallback = "application/octet-stream") {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "svg": return "image/svg+xml";
    default: return fallback;
  }
}

function getPodRoot(webId) {
  const url = new URL(webId);
  const segments = url.pathname.split("/").filter(Boolean);
  const profileIndex = segments.indexOf("profile");
  const baseSegments = profileIndex > -1 ? segments.slice(0, profileIndex) : segments;
  const basePath = baseSegments.length ? `/${baseSegments.join("/")}/` : "/";
  return `${url.origin}${basePath}`;
}

function SectionCard({ title, icon, editing, onEdit, children }) {
  return (
    <div className={`pf-card ${editing ? "pf-card--editing" : ""}`}>
      <div className="pf-card__head">
        <div className="pf-card__title">
          <FontAwesomeIcon icon={icon} className="pf-card__titleIcon" />
          <span>{title}</span>
        </div>
        <button type="button" className="pf-iconBtn" onClick={onEdit} title={editing ? "Done" : "Edit"}>
          <FontAwesomeIcon icon={faPen} />
        </button>
      </div>
      <div className="pf-card__body">{children}</div>
    </div>
  );
}

function RO({ label, value }) {
  return (
    <div className="pf-ro">
      <div className="pf-label">{label}</div>
      <div className="pf-value">{value || <span className="pf-muted">—</span>}</div>
    </div>
  );
}

const ListEditor = memo(function ListEditor({ values, setValues, readOnly, profileDocUrl }) {
  return (
    <div className="pf-list">
      {values.map((val) => (
        <div key={val.id} className="pf-listRow">
          {readOnly ? (
            <div className="pf-chip">{val.value}</div>
          ) : (
            <>
              <input
                className="pf-input"
                type="email"
                placeholder="name@example.org"
                value={val.value}
                onChange={(e) => {
                  const next = values.map((item) =>
                    item.id === val.id ? { ...item, value: e.target.value } : item
                  );
                  setValues(next);
                }}
              />
              <button
                type="button"
                className="pf-iconBtn danger"
                onClick={() => setValues(values.filter((item) => item.id !== val.id))}
                title="Remove entry"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </>
          )}
        </div>
      ))}
      {!readOnly && (
        <button
          type="button"
          className="pf-btn ghost"
          onClick={() =>
            setValues([
              ...values,
              { id: `${profileDocUrl}#email-${Date.now()}`, value: "", type: "Work" }
            ])
          }
        >
          <FontAwesomeIcon icon={faPlus} /> add
        </button>
      )}
    </div>
  );
});

export default function Profile({ webId }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [org, setOrg] = useState("");
  const [role, setRole] = useState("");
  const [photoIri, setPhotoIri] = useState("");
  const [emails, setEmails] = useState([]);
  const [dataset, setDataset] = useState(null);
  const [profileThing, setProfileThing] = useState(null);
  const [photoSrc, setPhotoSrc] = useState("");
  const [editBasics, setEditBasics] = useState(false);
  const [editContact, setEditContact] = useState(false);
  const [inboxUrl, setInboxUrl] = useState("");
  const [inboxConfiguring, setInboxConfiguring] = useState(false);
  const [inboxResetting, setInboxResetting] = useState(false);
  const [showInboxResetConfirm, setShowInboxResetConfirm] = useState(false);
  const [catalogUrl, setCatalogUrl] = useState("");
  const [catalogConfiguring, setCatalogConfiguring] = useState(false);
  const [catalogResetting, setCatalogResetting] = useState(false);
  const [showCatalogResetConfirm, setShowCatalogResetConfirm] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const showAlert = (msg) => {
    setAlertMessage(msg);
    setAlertOpen(true);
  };

  const profileDocUrl = webId ? webId.split("#")[0] : "";

  useEffect(() => {
    if (!webId) return;
    (async () => {
      try {
        setLoading(true);
        const ds = await getSolidDataset(profileDocUrl, { fetch: session.fetch });
        setDataset(ds);
        let me = getThing(ds, webId) || getThingAll(ds).find((t) => t.url === webId);
        if (!me) me = createThing({ url: webId });
        setProfileThing(me);

        const nm =
          getStringNoLocale(me, VCARD.fn) ||
          getStringNoLocale(me, FOAF.name) ||
          `${getStringNoLocale(me, VCARD.given_name) || ""} ${getStringNoLocale(me, VCARD.family_name) || ""}`.trim();
        setName(nm || "");
        setOrg(getStringNoLocale(me, VCARD.organization_name) || "");
        setRole(getStringNoLocale(me, VCARD.role) || "");

        const emailUris = getUrlAll(me, VCARD.hasEmail) || [];
        const collected = [];
        emailUris.forEach((uri) => {
          if (uri.startsWith("mailto:")) {
            collected.push({
              id: `${profileDocUrl}#email-${Date.now()}-${collected.length}`,
              value: uri.replace(/^mailto:/, ""),
              type: "Work",
            });
          } else {
            const thing = getThing(ds, uri);
            if (thing) {
              collected.push({
                id: uri,
                value: (getUrl(thing, VCARD.value) || "").replace(/^mailto:/, ""),
                type: getStringNoLocale(thing, VCARD_TYPE) || "Work",
              });
            }
          }
        });

        const directEmails = (getUrlAll(me, VCARD.email) || []).map((uri, idx) => ({
          id: `${profileDocUrl}#email-${Date.now()}-${collected.length + idx}`,
          value: uri.replace(/^mailto:/, ""),
          type: "Work",
        }));

        setEmails([...collected, ...directEmails]);

        const ph = getUrl(me, VCARD.hasPhoto) || getUrl(me, FOAF.img) || "";
        setPhotoIri(ph);
        setInboxUrl(getUrl(me, LDP.inbox) || "");
        const resolvedCatalog = await resolveCatalogUrl(webId, session.fetch);
        setCatalogUrl(resolvedCatalog || "");
      } catch (e) {
        console.error("Loading profile failed:", e);
        showAlert("Profile could not be loaded.");
      } finally {
        setLoading(false);
      }
    })();
  }, [webId, profileDocUrl]);

  useEffect(() => {
    let revoked = false;
    let objectUrl = "";
    (async () => {
      try {
        if (!photoIri) { setPhotoSrc(""); return; }
        const res = await session.fetch(photoIri);
        if (!res.ok) throw new Error(`Avatar ${res.status}`);
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!revoked) setPhotoSrc(objectUrl);
      } catch {
        setPhotoSrc("");
      }
    })();
    return () => { revoked = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photoIri]);

  const uploadAvatar = async (file) => {
    const podRoot = getPodRoot(webId);

    const ensureContainer = async (containerUrl) => {
      try {
        await getSolidDataset(containerUrl, { fetch: session.fetch });
      } catch (e) {
        if (e?.statusCode === 404 || e?.response?.status === 404) {
          await createContainerAt(containerUrl, { fetch: session.fetch });
        } else {
          throw e;
        }
      }
    };

    const profileUrl = `${podRoot}profile/`;
    await ensureContainer(profileUrl);

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const targetUrl = `${profileUrl}avatar-${Date.now()}.${ext}`;
    await overwriteFile(targetUrl, file, {
      contentType: file.type || guessContentType(file.name, "image/*"),
      fetch: session.fetch,
    });
    return targetUrl;
  };

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadAvatar(file);
      setPhotoIri(url);
    } catch {
      showAlert("Avatar upload failed.");
    }
  };

  const onSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      let me = profileThing || createThing({ url: webId });
      me = removeAll(me, VCARD.fn);
      me = setStringNoLocale(me, VCARD.fn, name || "");
      me = removeAll(me, VCARD.organization_name); if (org) me = setStringNoLocale(me, VCARD.organization_name, org);
      me = removeAll(me, VCARD.role); if (role) me = setStringNoLocale(me, VCARD.role, role);
      me = removeAll(me, VCARD.hasPhoto);
      if (photoIri) me = setUrl(me, VCARD.hasPhoto, photoIri);

      let ds = dataset;
      me = removeAll(me, VCARD.hasEmail);
      me = removeAll(me, VCARD.email);

      for (const email of emails) {
        const nodeUrl = email.id.startsWith("http") ? email.id : `${profileDocUrl}#${email.id.replace(/^#|^mailto:/, "")}`;
        let emailNode = createThing({ url: nodeUrl });
        emailNode = removeAll(emailNode, VCARD.value);
        emailNode = setUrl(emailNode, VCARD.value, `mailto:${email.value}`);
        emailNode = setStringNoLocale(emailNode, VCARD_TYPE, email.type || "Work");
        ds = setThing(ds, emailNode);
        me = addUrl(me, VCARD.hasEmail, nodeUrl);
      }

      ds = setThing(ds, me);
      await saveSolidDatasetAt(profileDocUrl, ds, { fetch: session.fetch });

      setDataset(ds);
      setProfileThing(me);
      setEditBasics(false);
      setEditContact(false);
      showAlert("Profile saved.");
    } catch (err) {
      console.error("Saving failed:", err);
      showAlert("Profile save failed.");
    } finally {
      setSaving(false);
    }
  };

  const getResourceAndAcl = async (url) => {
    const resource = await getSolidDatasetWithAcl(url, { fetch: session.fetch });
    let resourceAcl;
    if (!hasResourceAcl(resource)) {
      if (!hasAccessibleAcl(resource)) {
        throw new Error("No access to ACL.");
      }
      resourceAcl = createAclFromFallbackAcl(resource);
    } else {
      resourceAcl = getResourceAcl(resource);
    }
    return { resource, resourceAcl };
  };

  const configureInbox = async () => {
    if (!webId || !profileDocUrl) return;
    try {
      setInboxConfiguring(true);
      const targetInboxUrl = `${getPodRoot(webId)}inbox/`;
      try {
        await getSolidDataset(targetInboxUrl, { fetch: session.fetch });
      } catch (e) {
        if (e?.statusCode === 404 || e?.response?.status === 404) {
          await createContainerAt(targetInboxUrl, { fetch: session.fetch });
        } else {
          throw e;
        }
      }

      const { resource, resourceAcl } = await getResourceAndAcl(targetInboxUrl);
      const updatedAcl = setPublicResourceAccess(resourceAcl, {
        read: false,
        append: true,
        write: false,
        control: false,
      });
      await saveAclFor(resource, updatedAcl, { fetch: session.fetch });

      let ds = dataset;
      if (!ds) {
        ds = await getSolidDataset(profileDocUrl, { fetch: session.fetch });
      }
      let me = profileThing || createThing({ url: webId });
      me = removeAll(me, LDP.inbox);
      me = setUrl(me, LDP.inbox, targetInboxUrl);
      ds = setThing(ds, me);
      await saveSolidDatasetAt(profileDocUrl, ds, { fetch: session.fetch });

      setDataset(ds);
      setProfileThing(me);
      setInboxUrl(targetInboxUrl);
      showAlert("Solid inbox configured.");
    } catch (err) {
      console.error("Inbox setup failed:", err);
      showAlert("Inbox setup failed.");
    } finally {
      setInboxConfiguring(false);
    }
  };

  const deleteInboxContents = async (url) => {
    try {
      const dataset = await getSolidDataset(url, { fetch: session.fetch });
      const resources = getContainedResourceUrlAll(dataset);
      for (const resourceUrl of resources) {
        if (resourceUrl.endsWith("/")) {
          await deleteInboxContents(resourceUrl);
          await deleteContainer(resourceUrl, { fetch: session.fetch });
        } else {
          await deleteFile(resourceUrl, { fetch: session.fetch });
        }
      }
    } catch {
      // Ignore missing inbox content.
    }
  };

  const resetInbox = async () => {
    if (!webId) return;
    try {
      setInboxResetting(true);
      if (inboxUrl) {
        await deleteInboxContents(inboxUrl);
        await deleteContainer(inboxUrl, { fetch: session.fetch });
      }
      await configureInbox();
      showAlert("Inbox reset completed.");
    } catch (err) {
      console.error("Inbox reset failed:", err);
      showAlert(err?.message || "Inbox reset failed.");
    } finally {
      setInboxResetting(false);
      setShowInboxResetConfirm(false);
    }
  };

  const configureCatalog = async () => {
    if (!webId) return;
    try {
      setCatalogConfiguring(true);
      const title = name ? `${name}'s Catalog` : "Solid Dataspace Catalog";
      const { catalogUrl: configuredUrl } = await ensureCatalogStructure(webId, session.fetch, {
        title,
      });
      setCatalogUrl(configuredUrl || "");
      showAlert("Catalog initialized.");
    } catch (err) {
      console.error("Catalog setup failed:", err);
      showAlert(err?.message || "Catalog setup failed.");
    } finally {
      setCatalogConfiguring(false);
    }
  };

  const handleCatalogReset = async () => {
    if (!webId) return;
    try {
      setCatalogResetting(true);
      const title = name ? `${name}'s Catalog` : "Solid Dataspace Catalog";
      const { catalogUrl: configuredUrl } = await resetCatalog(webId, session.fetch, {
        title,
      });
      setCatalogUrl(configuredUrl || "");
      showAlert("Catalog reset completed.");
    } catch (err) {
      console.error("Catalog reset failed:", err);
      showAlert(err?.message || "Catalog reset failed.");
    } finally {
      setCatalogResetting(false);
      setShowCatalogResetConfirm(false);
    }
  };

  if (loading) return (
    <>
      <p>Loading profile…</p>
      <AlertModal
        show={alertOpen}
        message={alertMessage}
        onClose={() => setAlertOpen(false)}
      />
    </>
  );

  return (
    <>
      <form className="pf-wrap" onSubmit={onSave}>
      <div className="pf-head">
        <h2>Your Profile</h2>
      </div>

      <SectionCard
        title="Basics"
        icon={faUserCircle}
        editing={editBasics}
        onEdit={() => setEditBasics((v) => !v)}
      >
        <div className="pf-basics">
          <div className="pf-avatar">
            {photoSrc ? (
              <img src={photoSrc} alt="Avatar" />
            ) : (
              <div className="pf-avatar__ph">
                <FontAwesomeIcon icon={faUserCircle} />
              </div>
            )}
            {!editBasics ? (
              <div className="pf-muted sm">Avatar</div>
            ) : (
              <label className="pf-btn">
                Choose avatar
                <input type="file" accept="image/*" hidden onChange={onPickAvatar} />
              </label>
            )}
          </div>

          {!editBasics ? (
            <div>
              <RO label="Name" value={name} />
              <RO label="Organization" value={org} />
              <RO label="Role" value={role} />
            </div>
          ) : (
            <div>
              <div className="pf-label">Name</div>
              <input className="pf-input" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="pf-label">Organization</div>
              <input className="pf-input" value={org} onChange={(e) => setOrg(e.target.value)} />
              <div className="pf-label">Role</div>
              <input className="pf-input" value={role} onChange={(e) => setRole(e.target.value)} />
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="Contact"
        icon={faEnvelope}
        editing={editContact}
        onEdit={() => setEditContact((v) => !v)}
      >
        {!editContact ? (
          <div>
            <div className="pf-subtitle"><FontAwesomeIcon icon={faEnvelope}/> Email</div>
            {emails.length ? emails.map((m) => <div key={m.id} className="pf-chip">{m.value}</div>) : <div className="pf-muted">—</div>}
          </div>
        ) : (
          <div>
            <div className="pf-subtitle"><FontAwesomeIcon icon={faEnvelope}/> Email</div>
            <ListEditor
              values={emails}
              setValues={setEmails}
              readOnly={false}
              profileDocUrl={profileDocUrl}
            />
          </div>
        )}
      </SectionCard>

      <div className="pf-card">
        <div className="pf-card__head">
          <div className="pf-card__title">
            <FontAwesomeIcon icon={faInbox} className="pf-card__titleIcon" />
            <span>Solid Inbox</span>
          </div>
        </div>
        <div className="pf-card__body">
          <div className="pf-ro">
            <div className="pf-label">Inbox URL</div>
            <div className="pf-value">
              {inboxUrl ? (
                <a href={inboxUrl} target="_blank" rel="noopener noreferrer">
                  {inboxUrl}
                </a>
              ) : (
                <span className="pf-muted">Not configured</span>
              )}
            </div>
          </div>
          <div className="pf-muted" style={{ marginTop: 8 }}>
            Access requests and decisions are delivered to this inbox.
          </div>
          <div className="pf-actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="pf-btn primary"
              onClick={configureInbox}
              disabled={inboxConfiguring}
            >
              {inboxConfiguring
                ? "Configuring..."
                : inboxUrl
                  ? "Reconfigure Inbox"
                  : "Configure Inbox"}
            </button>
            <button
              type="button"
              className="pf-btn ghost"
              onClick={() => setShowInboxResetConfirm(true)}
              disabled={inboxResetting}
            >
              {inboxResetting ? "Resetting..." : "Reset Inbox"}
            </button>
          </div>
        </div>
      </div>

      <div className="pf-card">
        <div className="pf-card__head">
          <div className="pf-card__title">
            <FontAwesomeIcon icon={faBookOpen} className="pf-card__titleIcon" />
            <span>Semantic Data Catalog</span>
          </div>
        </div>
        <div className="pf-card__body">
          <div className="pf-ro">
            <div className="pf-label">Catalog URL</div>
            <div className="pf-value">
              {catalogUrl ? (
                <a href={catalogUrl} target="_blank" rel="noopener noreferrer">
                  {catalogUrl}
                </a>
              ) : (
                <span className="pf-muted">Not configured</span>
              )}
            </div>
          </div>
          <div className="pf-muted" style={{ marginTop: 8 }}>
            The catalog metadata is stored in your pod under <code>catalog/</code>.
          </div>
          <div className="pf-actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="pf-btn primary"
              onClick={configureCatalog}
              disabled={catalogConfiguring}
            >
              {catalogConfiguring
                ? "Configuring..."
                : catalogUrl
                  ? "Reconfigure Catalog"
                  : "Configure Catalog"}
            </button>
            <button
              type="button"
              className="pf-btn ghost"
              onClick={() => setShowCatalogResetConfirm(true)}
              disabled={catalogResetting}
            >
              {catalogResetting ? "Resetting..." : "Reset Catalog"}
            </button>
          </div>
        </div>
      </div>

      <div className="pf-actions">
        <button type="submit" className="pf-btn primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      </form>
      <AlertModal
        show={alertOpen}
        message={alertMessage}
        onClose={() => setAlertOpen(false)}
      />
      <ConfirmModal
        show={showInboxResetConfirm}
        title="Reset inbox?"
        message="This will delete all inbox notifications and recreate a fresh inbox container."
        confirmLabel="Reset Inbox"
        cancelLabel="Cancel"
        onClose={() => setShowInboxResetConfirm(false)}
        onConfirm={resetInbox}
      />
      <ConfirmModal
        show={showCatalogResetConfirm}
        title="Reset catalog?"
        message="This will delete all catalog metadata in your pod and recreate a fresh catalog structure."
        confirmLabel="Reset Catalog"
        cancelLabel="Cancel"
        onClose={() => setShowCatalogResetConfirm(false)}
        onConfirm={handleCatalogReset}
      />
    </>
  );
}
