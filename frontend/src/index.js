import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";

import App from "./App";
import "./styles/global.css";

const clerkPublishableKey =
  process.env.REACT_APP_CLERK_PUBLISHABLE_KEY?.trim();

if (!clerkPublishableKey) {
  throw new Error(
    "Missing REACT_APP_CLERK_PUBLISHABLE_KEY in frontend environment configuration."
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error(
    'React root element was not found. Ensure public/index.html contains <div id="root"></div>.'
  );
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);