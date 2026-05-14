const PRESENTATION_STYLE_ID = "msigsdk-presentation-styles";

function canUseDom() {
  return typeof document !== "undefined" && typeof document.createElement === "function";
}

function ensurePresentationStyles() {
  if (!canUseDom() || document.getElementById(PRESENTATION_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = PRESENTATION_STYLE_ID;
  style.textContent = `
    .msigsdk-output-metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
      margin: 0;
    }
    .msigsdk-output-metric {
      border: 1px solid #d8ded8;
      border-radius: 8px;
      background: #f4f6f2;
      padding: 12px;
    }
    .msigsdk-output-metric span,
    .msigsdk-output-metric small {
      display: block;
      color: #5f6d67;
      font: 12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .msigsdk-output-metric strong {
      display: block;
      margin-top: 4px;
      color: #17201d;
      font: 700 18px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .msigsdk-output-metric small {
      margin-top: 5px;
    }
    .msigsdk-output-table-wrap {
      overflow-x: auto;
    }
    .msigsdk-output-table {
      width: 100%;
      border-collapse: collapse;
      color: #17201d;
      font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .msigsdk-output-table th,
    .msigsdk-output-table td {
      border-bottom: 1px solid #d8ded8;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    .msigsdk-output-table th {
      background: #f4f6f2;
      color: #17201d;
      font-weight: 800;
    }
    .msigsdk-output-caption {
      margin: 9px 0 0;
      color: #5f6d67;
      font: 12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .msigsdk-output-note {
      margin: 0;
      border-left: 4px solid #147d7f;
      background: #edf7f7;
      color: #5f6d67;
      padding: 10px 12px;
      font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .msigsdk-output-note.warning {
      border-left-color: #b85c38;
      background: #fff3ec;
    }
    .msigsdk-output-details {
      border: 1px solid #d8ded8;
      border-radius: 8px;
      background: #f8faf7;
      padding: 10px;
    }
    .msigsdk-output-details summary {
      cursor: pointer;
      color: #147d7f;
      font: 800 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .msigsdk-output-inspector {
      overflow-x: auto;
      max-height: 380px;
      margin: 10px 0 0;
      border-radius: 8px;
      background: #101614;
      color: #e8f1ed;
      padding: 13px;
      font: 12px/1.5 "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      white-space: pre-wrap;
    }
  `;
  document.head.append(style);
}

function requireDom(functionName) {
  if (!canUseDom()) {
    throw new Error(`mSigSDK.presentation.${functionName} requires a browser DOM.`);
  }
  ensurePresentationStyles();
}

function formatNumber(value, digits = 3) {
  if (!Number.isFinite(value)) return "n/a";
  if (Math.abs(value) >= 100) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return value.toLocaleString(undefined, { maximumSignificantDigits: digits });
}

function formatCell(value) {
  if (Number.isFinite(value)) return formatNumber(value);
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return compactSummary(value);
  return String(value);
}

function stringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (_key, item) => {
      if (typeof item === "function") return `[Function ${item.name || "anonymous"}]`;
      if (canUseDom() && item instanceof Node) return `[${item.nodeName}]`;
      if (typeof item === "object" && item !== null) {
        if (seen.has(item)) return "[Circular]";
        seen.add(item);
      }
      return item;
    },
    2
  );
}

function compactSummary(value) {
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    const shown = entries.slice(0, 8).map(([key, item]) => {
      if (Array.isArray(item)) return `${key}: Array(${item.length})`;
      if (item && typeof item === "object") return `${key}: Object(${Object.keys(item).length})`;
      return `${key}: ${String(item)}`;
    });
    const suffix =
      entries.length > shown.length ? `\n... ${entries.length - shown.length} more keys` : "";
    return shown.join("\n") + suffix;
  }
  return String(value);
}

function metrics(items) {
  requireDom("metrics");
  const grid = document.createElement("div");
  grid.className = "msigsdk-output-metrics";

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "msigsdk-output-metric";

    const label = document.createElement("span");
    label.textContent = item.label;
    const value = document.createElement("strong");
    value.textContent = item.value === null || item.value === undefined ? "n/a" : String(item.value);
    card.append(label, value);

    if (item.note) {
      const noteElement = document.createElement("small");
      noteElement.textContent = item.note;
      card.append(noteElement);
    }

    grid.append(card);
  });

  return grid;
}

function table(rows, columns = null, options = {}) {
  requireDom("table");
  const maxRows = Number.isFinite(options.maxRows) ? options.maxRows : 12;
  const data = Array.isArray(rows) ? rows : [];
  const wrapper = document.createElement("div");
  wrapper.className = "msigsdk-output-table-wrap";

  if (!data.length) {
    wrapper.append(note("No rows to display."));
    return wrapper;
  }

  const normalizedColumns =
    columns ||
    Object.keys(data[0]).map((key) => ({
      key,
      label: key,
    }));
  const tableElement = document.createElement("table");
  tableElement.className = "msigsdk-output-table";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  normalizedColumns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = typeof column === "string" ? column : column.label || column.key;
    headerRow.append(th);
  });
  thead.append(headerRow);
  tableElement.append(thead);

  const tbody = document.createElement("tbody");
  data.slice(0, maxRows).forEach((row) => {
    const tr = document.createElement("tr");
    normalizedColumns.forEach((column) => {
      const key = typeof column === "string" ? column : column.key;
      const formatter = typeof column === "object" ? column.format : null;
      const td = document.createElement("td");
      const value = row?.[key];
      td.textContent = formatter ? formatter(value, row) : formatCell(value);
      tr.append(td);
    });
    tbody.append(tr);
  });
  tableElement.append(tbody);
  wrapper.append(tableElement);

  if (data.length > maxRows) {
    const caption = document.createElement("p");
    caption.className = "msigsdk-output-caption";
    caption.textContent = `Showing ${maxRows} of ${data.length} rows.`;
    wrapper.append(caption);
  }

  return wrapper;
}

function note(text, tone = "info") {
  requireDom("note");
  const element = document.createElement("p");
  element.className = `msigsdk-output-note ${tone}`.trim();
  element.textContent = text;
  return element;
}

function details(label, value, { open = false } = {}) {
  requireDom("details");
  const detailsElement = document.createElement("details");
  detailsElement.className = "msigsdk-output-details";
  detailsElement.open = Boolean(open);
  const summary = document.createElement("summary");
  summary.textContent = label;
  const pre = document.createElement("pre");
  pre.className = "msigsdk-output-inspector";
  pre.textContent = typeof value === "string" ? value : stringify(value);
  detailsElement.append(summary, pre);
  return detailsElement;
}

function burdenSampleRows(burden, sampleNames = null) {
  const rows = burden?.samples || [];
  const allowed = Array.isArray(sampleNames) ? new Set(sampleNames) : null;
  return rows
    .filter((row) => !allowed || allowed.has(row.sample))
    .map((row) => ({
      sample: row.sample,
      mutations: row.totalMutations,
      nonZeroContexts: row.nonZeroContexts,
      lowBurden: row.flags?.lowBurden ? "Yes" : "No",
    }));
}

function reconstructionRows(reconstruction) {
  return (reconstruction?.samples || []).map((row) => ({
    sample: row.sample,
    normalizationMode: row.normalizationMode,
    cosineSimilarity: row.cosineSimilarity,
    rmse: row.rmse,
    totalObserved: row.totalObserved,
  }));
}

function exposureRows(exposures, { minExposure = 0, topN = 10 } = {}) {
  return Object.entries(exposures || {})
    .flatMap(([sample, row]) =>
      Object.entries(row || {})
        .filter(([, exposure]) => Number.isFinite(exposure) && exposure > minExposure)
        .map(([signature, exposure]) => ({ sample, signature, exposure }))
    )
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, topN);
}

function bootstrapRows(bootstrap, { topN = 8 } = {}) {
  return (bootstrap?.signatures || [])
    .map((row) => ({
      signature: row.signatureName || row.signature,
      mean: row.mean,
      lower95: row.lower,
      upper95: row.upper,
      selectionFrequency: row.selectionFrequency,
    }))
    .sort((a, b) => (b.mean || 0) - (a.mean || 0))
    .slice(0, topN);
}

function thresholdRows(thresholdSensitivity) {
  return (thresholdSensitivity?.runs || []).map((run) => ({
    threshold: run.threshold,
    averageCosineSimilarity: run.averageCosineSimilarity,
    averageRmse: run.averageRmse,
    averageActiveSignatures: run.averageActiveSignatures,
  }));
}

function nmfMatchRows(matches, { maxRows = 12 } = {}) {
  return (Array.isArray(matches) ? matches : [])
    .flatMap((matchGroup) =>
      (matchGroup.matches || []).map((match) => ({
        extractedSignature: matchGroup.signatureName,
        referenceSignature: match.referenceName,
        cosineSimilarity: match.cosineSimilarity,
      }))
    )
    .slice(0, maxRows);
}

function reportFieldRows(report) {
  return Object.entries(report || {}).map(([field, value]) => ({
    field,
    summary: typeof value === "string" ? value : Object.keys(value || {}).join(", "),
  }));
}

export {
  bootstrapRows,
  burdenSampleRows,
  compactSummary,
  details,
  exposureRows,
  formatCell,
  formatNumber,
  metrics,
  nmfMatchRows,
  note,
  reconstructionRows,
  reportFieldRows,
  table,
  thresholdRows,
};
