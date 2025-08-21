import React, { useState } from "react";
import "./Modal.css";

const ShareModal = ({ show, onClose, onShare }) => {
  const [webId, setWebId] = useState("");
  const [access, setAccess] = useState({
    read: true,
    append: false,
    write: false,
    control: false,
  });

  const toggle = (e) => {
    const { name, checked } = e.target;
    setAccess((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = () => {
    const id = webId.trim();
    if (!id) return;
    onShare(id, access);
    setWebId("");
    setAccess({ read: true, append: false, write: false, control: false });
    onClose();
  };

  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <span className="modal-title">Share Item</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="share-webid" className="modal-label">
              WebID
            </label>
            <input
              id="share-webid"
              type="text"
              className="modal-input"
              placeholder="https://user.example/profile#me"
              value={webId}
              onChange={(e) => setWebId(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginTop: "1rem" }}>
            <span className="modal-label">Permissions</span>
            <div className="modal-checkboxes">
              <label>
                <input
                  type="checkbox"
                  name="read"
                  checked={access.read}
                  onChange={toggle}
                />
                Read
              </label>
              <label>
                <input
                  type="checkbox"
                  name="append"
                  checked={access.append}
                  onChange={toggle}
                />
                Append
              </label>
              <label>
                <input
                  type="checkbox"
                  name="write"
                  checked={access.write}
                  onChange={toggle}
                />
                Write
              </label>
              <label>
                <input
                  type="checkbox"
                  name="control"
                  checked={access.control}
                  onChange={toggle}
                />
                Control
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!webId.trim()}
          >
            Share
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
