import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { initAnalytics } from "./analytics";
import App from "./App.jsx";
import { takeOAuthReturn } from "./utils/oauthReturn";

// First of all: a Google sign-in return carries the access token in the URL.
// It is moved to storage and wiped from the address bar before analytics or
// any page code can read it.
takeOAuthReturn();

// Before render, so a ?src= tag is captured before routing rewrites the URL.
initAnalytics();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
