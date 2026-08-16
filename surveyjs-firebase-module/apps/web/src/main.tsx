import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "survey-core/survey-core.min.css";
import { App } from "@/app/App";
import { AuthProvider } from "@/auth/AuthProvider";
import { OrgProvider } from "@/auth/OrgProvider";
import "@/styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <OrgProvider>
          <App />
        </OrgProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
