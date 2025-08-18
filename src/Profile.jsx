import React, { useEffect, useState } from "react";
import {
  getSolidDataset, getThing, getThingAll, setThing, saveSolidDatasetAt,
  buildThing, createThing, getStringNoLocale, getUrl, getUrlAll,
  setUrl, addUrl, setStringNoLocale, removeAll, overwriteFile
} from "@inrupt/solid-client";
import { fetch, getDefaultSession } from "@inrupt/solid-client-authn-browser";
import { VCARD, FOAF } from "@inrupt/vocab-common-rdf";
import "./Profile.css";

/* Font Awesome */
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUserCircle, faPen, faXmark, faPlus, faTrash,
  faEnvelope, faPhone, faHouse, faBuilding, faCakeCandles, faGlobe
} from "@fortawesome/free-solid-svg-icons";

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

/* Reusable Section-Card mit Edit/Save/Cancel oben rechts */
function SectionCard({ title, icon, editing, onEdit, children }) {
  return (
    <div className={`pf-card ${editing ? "pf-card--editing" : ""}`}>
      <div className="pf-card__head">
        <div className="pf-card__title">
          <FontAwesomeIcon icon={icon} className="pf-card__titleIcon" />
          <span>{title}</span>
        </div>
        <button type="button" className="pf-iconBtn" onClick={onEdit} title={editing ? "Fertig" : "Bearbeiten"}>
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

export default function Profile({ webId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Basis-Felder
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [note, setNote] = useState("");
  const [role, setRole] = useState("");
  const [org, setOrg] = useState("");
  const [bday, setBday] = useState("");
  const [homepage, setHomepage] = useState("");
  const [photoIri, setPhotoIri] = useState("");

  // Listen
  const [emails, setEmails] = useState([]);
  const [phones, setPhones] = useState([]);

  // Adresse
  const [address, setAddress] = useState({
    street: "", locality: "", postalCode: "", region: "", countryName: ""
  });

  // Technik
  const [dataset, setDataset] = useState(null);
  const [profileThing, setProfileThing] = useState(null);
  const [photoSrc, setPhotoSrc] = useState("");

  // Edit-States pro Card
  const [editBasics, setEditBasics] = useState(false);
  const [editContact, setEditContact] = useState(false);
  const [editAddress, setEditAddress] = useState(false);
  const [editNotes, setEditNotes] = useState(false);

  const profileDocUrl = webId ? webId.split("#")[0] : "";

  /* Laden */
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
        setNickname(getStringNoLocale(me, FOAF.nick) || getStringNoLocale(me, VCARD.nickname) || "");
        setNote(getStringNoLocale(me, VCARD.note) || "");
        setRole(getStringNoLocale(me, VCARD.role) || "");
        setOrg(getStringNoLocale(me, VCARD.organization_name) || "");
        setHomepage(getUrl(me, FOAF.homepage) || getUrl(me, VCARD.url) || "");
        setBday(getStringNoLocale(me, VCARD.bday) || "");

        const emailUris = getUrlAll(me, VCARD.hasEmail) || [];
        setEmails(emailUris.map((u) => (u.startsWith("mailto:") ? u.slice(7) : u)));

        const telUris = getUrlAll(me, VCARD.hasTelephone) || [];
        setPhones(telUris.map((u) => (u.startsWith("tel:") ? u.slice(4) : u)));

        const ph = getUrl(me, VCARD.hasPhoto) || getUrl(me, FOAF.img) || "";
        setPhotoIri(ph);

        let addr = { street: "", locality: "", postalCode: "", region: "", countryName: "" };
        const addrThingUrl = getUrl(me, VCARD.hasAddress);
        if (addrThingUrl) {
          const addrThing = getThing(ds, addrThingUrl);
          if (addrThing) {
            addr.street = getStringNoLocale(addrThing, VCARD.street_address) || "";
            addr.locality = getStringNoLocale(addrThing, VCARD.locality) || "";
            addr.postalCode = getStringNoLocale(addrThing, VCARD.postal_code) || "";
            addr.region = getStringNoLocale(addrThing, VCARD.region) || "";
            addr.countryName = getStringNoLocale(addrThing, VCARD.country_name) || "";
          }
        }
        setAddress(addr);
      } catch (e) {
        console.error("Profil laden fehlgeschlagen:", e);
        alert("Profil konnte nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    })();
  }, [webId, profileDocUrl]);

  /* Avatar laden */
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
      } catch (e) {
        setPhotoSrc("");
      }
    })();
    return () => { revoked = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [photoIri]);

  /* Avatar Upload */
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
    } catch (err) {
      alert("Avatar-Upload fehlgeschlagen.");
    }
  };

  /* Speichern (alle Cards gemeinsam) */
  const onSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      let me = profileThing || createThing({ url: webId });

      me = removeAll(me, VCARD.fn);
      me = setStringNoLocale(me, VCARD.fn, name || "");

      me = removeAll(me, FOAF.nick);
      me = removeAll(me, VCARD.nickname);
      if (nickname) {
        me = setStringNoLocale(me, FOAF.nick, nickname);
        me = setStringNoLocale(me, VCARD.nickname, nickname);
      }

      me = removeAll(me, VCARD.note); if (note) me = setStringNoLocale(me, VCARD.note, note);
      me = removeAll(me, VCARD.role); if (role) me = setStringNoLocale(me, VCARD.role, role);
      me = removeAll(me, VCARD.organization_name); if (org) me = setStringNoLocale(me, VCARD.organization_name, org);
      me = removeAll(me, VCARD.bday); if (bday) me = setStringNoLocale(me, VCARD.bday, bday);

      me = removeAll(me, FOAF.homepage); me = removeAll(me, VCARD.url);
      if (homepage) me = setUrl(me, FOAF.homepage, homepage);

      me = removeAll(me, VCARD.hasPhoto);
      if (photoIri) me = setUrl(me, VCARD.hasPhoto, photoIri);

      me = removeAll(me, VCARD.hasEmail);
      emails.map((m) => m.trim()).filter(Boolean).forEach((mail) => {
        me = addUrl(me, VCARD.hasEmail, `mailto:${mail}`);
      });

      me = removeAll(me, VCARD.hasTelephone);
      phones.map((p) => p.trim()).filter(Boolean).forEach((tel) => {
        me = addUrl(me, VCARD.hasTelephone, `tel:${tel}`);
      });

      // Adresse
      const addrUrl = `${profileDocUrl}#addr`;
      let addrThing = createThing({ url: addrUrl });
      ["street_address","locality","postal_code","region","country_name"].forEach(() => {}); // nur zur Übersicht
      addrThing = removeAll(addrThing, VCARD.street_address);
      addrThing = removeAll(addrThing, VCARD.locality);
      addrThing = removeAll(addrThing, VCARD.postal_code);
      addrThing = removeAll(addrThing, VCARD.region);
      addrThing = removeAll(addrThing, VCARD.country_name);

      if (address.street)     addrThing = setStringNoLocale(addrThing, VCARD.street_address, address.street);
      if (address.locality)   addrThing = setStringNoLocale(addrThing, VCARD.locality, address.locality);
      if (address.postalCode) addrThing = setStringNoLocale(addrThing, VCARD.postal_code, address.postalCode);
      if (address.region)     addrThing = setStringNoLocale(addrThing, VCARD.region, address.region);
      if (address.countryName)addrThing = setStringNoLocale(addrThing, VCARD.country_name, address.countryName);

      let ds = dataset;
      ds = setThing(ds, addrThing);

      me = removeAll(me, VCARD.hasAddress);
      if (address.street || address.locality || address.postalCode || address.region || address.countryName) {
        me = setUrl(me, VCARD.hasAddress, addrUrl);
      }

      ds = setThing(ds, me);
      await saveSolidDatasetAt(profileDocUrl, ds, { fetch });

      setDataset(ds);
      setProfileThing(me);
      setEditBasics(false); setEditContact(false); setEditAddress(false); setEditNotes(false);
      alert("Profil gespeichert.");
    } catch (err) {
      console.error("Speichern fehlgeschlagen:", err);
      alert("Profil speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Profil wird geladen…</p>;
  const loggedIn = getDefaultSession().info.isLoggedIn;

  const ListEditor = ({ labelIcon, label, values, setValues, type, placeholder, readOnly }) => (
    <div className="pf-list">
      {values.map((val, i) => (
        <div key={i} className="pf-listRow">
          {readOnly ? (
            <div className="pf-chip">{val}</div>
          ) : (
            <>
              <input
                className="pf-input"
                type={type}
                value={val}
                placeholder={placeholder}
                onChange={(e) => {
                  const copy = [...values];
                  copy[i] = e.target.value;
                  setValues(copy);
                }}
              />
              <button
                type="button"
                className="pf-iconBtn danger"
                onClick={() => setValues(values.filter((_, idx) => idx !== i))}
                title="Eintrag entfernen"
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
          onClick={() => setValues([...values, ""])}
        >
          <FontAwesomeIcon icon={faPlus} /> hinzufügen
        </button>
      )}
    </div>
  );

  return (
    <form className="pf-wrap" onSubmit={onSave}>
      {/* HEAD / CLOSE */}
      <div className="pf-head">
        <h2>Dein Profil</h2>
        {onClose && (
          <button type="button" className="pf-iconBtn" onClick={onClose} title="Schließen">
            <FontAwesomeIcon icon={faXmark} />
          </button>
        )}
      </div>

      {/* BASICS */}
      <SectionCard
        title="Basis"
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
                Avatar wählen
                <input type="file" accept="image/*" hidden onChange={onPickAvatar} />
              </label>
            )}
          </div>

          <div className="pf-grid">
            {!editBasics ? (
              <>
                <RO label="Name" value={name} />
                <RO label="Nickname" value={nickname} />
                <RO label="Rolle" value={role} />
                <RO label="Organisation" value={org} />
                <RO label="Geburtstag" value={bday} />
                <RO label="Homepage" value={homepage} />
                <RO label="Notiz" value={note} />
              </>
            ) : (
              <>
                <div>
                  <div className="pf-label">Name</div>
                  <input className="pf-input" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <div className="pf-label">Nickname</div>
                  <input className="pf-input" value={nickname} onChange={(e) => setNickname(e.target.value)} />
                </div>
                <div>
                  <div className="pf-label">Rolle</div>
                  <input className="pf-input" value={role} onChange={(e) => setRole(e.target.value)} />
                </div>
                <div>
                  <div className="pf-label">Organisation</div>
                  <input className="pf-input" value={org} onChange={(e) => setOrg(e.target.value)} />
                </div>
                <div>
                  <div className="pf-label">Geburtstag</div>
                  <input className="pf-input" type="date" value={bday} onChange={(e) => setBday(e.target.value)} />
                </div>
                <div>
                  <div className="pf-label">Homepage</div>
                  <input className="pf-input" type="url" value={homepage} onChange={(e) => setHomepage(e.target.value)} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div className="pf-label">Notiz</div>
                  <textarea className="pf-textarea" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
              </>
            )}
          </div>
        </div>
      </SectionCard>

      {/* KONTAKT */}
      <SectionCard
        title="Kontakt"
        icon={faEnvelope}
        editing={editContact}
        onEdit={() => setEditContact((v) => !v)}
      >
        {!editContact ? (
          <div className="pf-cols">
            <div>
              <div className="pf-subtitle"><FontAwesomeIcon icon={faEnvelope}/> E-Mail</div>
              {emails.length ? emails.map((m,i)=> <div key={i} className="pf-chip">{m}</div>) : <div className="pf-muted">—</div>}
            </div>
            <div>
              <div className="pf-subtitle"><FontAwesomeIcon icon={faPhone}/> Telefon</div>
              {phones.length ? phones.map((p,i)=> <div key={i} className="pf-chip">{p}</div>) : <div className="pf-muted">—</div>}
            </div>
          </div>
        ) : (
          <div className="pf-cols">
            <div>
              <div className="pf-subtitle"><FontAwesomeIcon icon={faEnvelope}/> E-Mail</div>
              <ListEditor
                values={emails}
                setValues={setEmails}
                type="email"
                placeholder="name@example.org"
              />
            </div>
            <div>
              <div className="pf-subtitle"><FontAwesomeIcon icon={faPhone}/> Telefon</div>
              <ListEditor
                values={phones}
                setValues={setPhones}
                type="tel"
                placeholder="+49 123 456789"
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* ADRESSE */}
      <SectionCard
        title="Adresse"
        icon={faHouse}
        editing={editAddress}
        onEdit={() => setEditAddress((v) => !v)}
      >
        {!editAddress ? (
          <div className="pf-grid">
            <RO label="Straße" value={address.street} />
            <RO label="Ort" value={address.locality} />
            <RO label="PLZ" value={address.postalCode} />
            <RO label="Region" value={address.region} />
            <RO label="Land" value={address.countryName} />
          </div>
        ) : (
          <div className="pf-grid">
            <div><div className="pf-label">Straße</div>
              <input className="pf-input" value={address.street}
                     onChange={(e)=>setAddress({...address, street:e.target.value})}/></div>
            <div><div className="pf-label">Ort</div>
              <input className="pf-input" value={address.locality}
                     onChange={(e)=>setAddress({...address, locality:e.target.value})}/></div>
            <div><div className="pf-label">PLZ</div>
              <input className="pf-input" value={address.postalCode}
                     onChange={(e)=>setAddress({...address, postalCode:e.target.value})}/></div>
            <div><div className="pf-label">Region</div>
              <input className="pf-input" value={address.region}
                     onChange={(e)=>setAddress({...address, region:e.target.value})}/></div>
            <div><div className="pf-label">Land</div>
              <input className="pf-input" value={address.countryName}
                     onChange={(e)=>setAddress({...address, countryName:e.target.value})}/></div>
          </div>
        )}
      </SectionCard>

      {/* NOTIZEN – eigene Card (optional) */}
      <SectionCard
        title="Notizen"
        icon={faBuilding}
        editing={editNotes}
        onEdit={() => setEditNotes((v) => !v)}
      >
        {!editNotes ? (
          <div className="pf-roBlock">{note || <span className="pf-muted">—</span>}</div>
        ) : (
          <textarea className="pf-textarea" value={note} onChange={(e)=>setNote(e.target.value)} />
        )}
      </SectionCard>

      <div className="pf-actions">
        <button type="submit" className="pf-btn primary" disabled={saving}>
          {saving ? "Speichern…" : "Speichern"}
        </button>
      </div>
    </form>
  );
}
