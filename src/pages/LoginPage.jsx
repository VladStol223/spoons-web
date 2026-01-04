import React from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className="pageWrap">
      <h1>Login</h1>
      <p>UI-only placeholder.</p>
      <button className="primaryBtn" type="button" onClick={() => navigate("/spoons")}>Continue</button>
    </div>
  );
}
