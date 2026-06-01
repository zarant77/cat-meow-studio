import type { ExportReadiness } from "../export/soundReadiness.js";
import { createElement, createTextElement } from "./dom.js";

export function renderReadiness(readiness: ExportReadiness): HTMLElement {
  const panel = createElement("section", "readiness-panel");
  const title = createElement("div", "readiness-title");
  const status = createTextElement("strong", getStatusLabel(readiness.status), `readiness-status is-${readiness.status}`);
  title.append(createTextElement("h2", "Export readiness"), status);

  const meta = createElement("div", "readiness-meta");
  meta.append(
    createTextElement("span", `${readiness.totalDurationMs} ms`),
    createTextElement("span", `${readiness.sampleCount} samples`),
  );

  panel.append(title, meta);

  const messages = readiness.errors.length > 0 ? readiness.errors : readiness.warnings;

  if (messages.length > 0) {
    panel.append(createTextElement("p", messages.join(", "), "readiness-message"));
  }

  return panel;
}

function getStatusLabel(status: ExportReadiness["status"]): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "warning":
      return "Warning";
    case "error":
      return "Error";
  }
}
