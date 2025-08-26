import React, { useEffect, useState, memo } from "react";
import {
  getSolidDataset, getThing, getThingAll, setThing, saveSolidDatasetAt,
  createThing, getStringNoLocale, getUrl, getUrlAll,
  setUrl, addUrl, setStringNoLocale, removeAll, overwriteFile
} from "@inrupt/solid-client";
import { fetch } from "@inrupt/solid-client-authn-browser";
import { VCARD, FOAF } from "@inrupt/vocab-common-rdf";
import "./Profile.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserCircle, faPen, faPlus, faTrash,
  faEnvelope
} from "@fortawesome/free-solid-svg-icons";

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

  const profileDocUrl = webId ? new URL("/profile/card", webId).href : "";

  useEffect(() => {
    if (!webId) return;
    (async () => {
      try {
        setLoading(true);
        const ds = await getSolidDataset(profileDocUrl, { fetch });
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
      } catch (e) {
        console.error("Loading profile failed:", e);
        alert("Profile could not be loaded.");
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
        const res = await fetch(photoIri);
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
    const origin = new URL(webId).origin;
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const targetUrl = `${origin}/public/profile/avatar-${Date.now()}.${ext}`;
    await overwriteFile(targetUrl, file, {
      contentType: file.type || guessContentType(file.name, "image/*"),
      fetch,
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
      alert("Avatar upload failed.");
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
      await saveSolidDatasetAt(profileDocUrl, ds, { fetch });

      setDataset(ds);
      setProfileThing(me);
      setEditBasics(false);
      setEditContact(false);
      alert("Profile saved.");
    } catch (err) {
      console.error("Saving failed:", err);
      alert("Profile save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading profile…</p>;

  return (
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

      <div className="pf-actions">
        <button type="submit" className="pf-btn primary" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
