import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { initAnalytics } from "./analytics";
import LanguageProvider from "./i18n/LanguageProvider";
import App from "./App.jsx";

// Before render, so a ?src= tag is captured before routing rewrites the URL.
initAnalytics();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </LanguageProvider>
  </React.StrictMode>
);
