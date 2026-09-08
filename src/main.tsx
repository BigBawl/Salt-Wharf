import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Saltwharf } from "@/components/game/Saltwharf";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Saltwharf />
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const base = import.meta.env.BASE_URL || "./";
    void navigator.serviceWorker.register(`${base}sw.js`);
  });
}
