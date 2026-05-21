import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.scss";
import { RoomApp } from "./RoomApp.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RoomApp />
  </StrictMode>,
);
