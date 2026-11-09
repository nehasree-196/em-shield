//this is the entrypoint of the react application, this loads the main app and displays it in the browser

import React from "react";
import ReactDOM from "react-dom/client";                            //this is used to display the react elements on the browser

import App from "./App";
// @ts-ignore CSS imports are handled by the bundler.
import "./styles/global.css";                                       //this imports the global css for this application
// @ts-ignore the workspace context is written in JavaScript
import { WorkspaceProvider } from "./context/WorkspaceContext";     //shared state (materials list, active designs) used by pages 3-5

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WorkspaceProvider>
      <App />
    </WorkspaceProvider>
  </React.StrictMode>
);
