import React from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import Profile from "./Profile";

export default function ProfilePage({ webId }) {
  const navigate = useNavigate();
  return (
    <>
      <div className="toolbar">
        <div className="crumb">
          <FontAwesomeIcon icon={faUser} className="crumb-icon" />
          <span>Profile Manager</span>
        </div>
      </div>
      <div className="profile-panel">
        <Profile webId={webId} onClose={() => navigate("/")} />
      </div>
    </>
  );
}

