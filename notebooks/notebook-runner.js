const DEFAULT_NOTEBOOKS = [
  {
    file: "msig-sdk-notebooks.onb.html",
    title: "Workflow guide",
    summary: "Find the notebook that matches the SDK task.",
    workflowGroup: "orientation",
    workflowGroupLabel: "Orientation",
  },
  {
    file: "msig-sdk-end-to-end-workflow.onb.html",
    title: "End-to-end workflow",
    summary: "Inspect the complete fit-review-export arc on demo spectra.",
    workflowGroup: "orientation",
    workflowGroupLabel: "Orientation",
  },
  {
    file: "msig-sdk-public-cohort-exploration.onb.html",
    title: "Public cohort explorer",
    summary: "Inspect public mSigPortal spectra and TCGA/GDC MAF-derived examples in one SDK shape.",
    workflowGroup: "orientation",
    workflowGroupLabel: "Orientation",
  },
  {
    file: "msig-sdk-resource-portability.onb.html",
    title: "Resource portability",
    summary: "Learn the SBS96 format bridge around shared matrix conventions, exports, parser normalization, and round-trip checks.",
    workflowGroup: "input",
    workflowGroupLabel: "Load Data",
  },
  {
    file: "msig-sdk-maf-fit-report.onb.html",
    title: "MAF to COSMIC profiles",
    summary: "Convert MAF rows into SBS96, SBS1536, DBS78, and ID83 matrices with profile-specific binning and audit checks.",
    workflowGroup: "input",
    workflowGroupLabel: "Load Data",
  },
  {
    file: "msig-sdk-qc-walkthrough.onb.html",
    title: "Cohort QC triage",
    summary: "Review known-signature QC triage with sample burden, reconstruction, residuals, warnings, and next-step cues.",
    workflowGroup: "core",
    workflowGroupLabel: "Analyze Data",
  },
  {
    file: "msig-sdk-nmf-extraction.onb.html",
    title: "Discovery extraction (NMF)",
    summary: "Screen demo spectra with browser-scale NMF, rank checks, and external handoff files.",
    workflowGroup: "core",
    workflowGroupLabel: "Analyze Data",
  },
  {
    file: "msig-sdk-panel-evidence-tiers.onb.html",
    title: "Panel/WES evidence review",
    summary: "Review panel/WES support tiers with assay coverage and mutation-count evidence.",
    workflowGroup: "core",
    workflowGroupLabel: "Analyze Data",
  },
  {
    file: "msig-sdk-cohort-panel-workflow.onb.html",
    title: "Cohort and panel workflow",
    summary: "Learn how cohort metadata, group interpretation, and restricted-assay limits connect in one example.",
    workflowGroup: "core",
    workflowGroupLabel: "Analyze Data",
  },
  {
    file: "msig-sdk-uncertainty-thresholds.onb.html",
    title: "Uncertainty and cutoffs",
    summary: "Inspect fitted-signature uncertainty with bootstrap intervals and cutoff sweeps.",
    workflowGroup: "reliability",
    workflowGroupLabel: "Review And Report",
  },
  {
    file: "msig-sdk-multi-engine-comparison.onb.html",
    title: "Multi-tool comparison",
    summary: "Compare fitting-engine outputs on identical demo spectra with compact concordance views.",
    workflowGroup: "reliability",
    workflowGroupLabel: "Review And Report",
  },
  {
    file: "msig-sdk-export-report.onb.html",
    title: "Report packet builder",
    summary: "Build a demo report archive with selected sections, provenance, audit checks, and downloads.",
    workflowGroup: "reliability",
    workflowGroupLabel: "Review And Report",
  },
];

const NOTEBOOK_ALIASES = new Map([
  ["msig-sdk-bring-your-own-spectra.onb.html", "msig-sdk-end-to-end-workflow.onb.html"],
]);

const state = {
  activeNotebook: null,
  notebooks: DEFAULT_NOTEBOOKS,
  cells: [],
  moduleCells: [],
  activeModuleIndex: -1,
  isRunning: false,
  showCode: false,
};

const menu = document.getElementById("notebook-menu");
const root = document.getElementById("notebook-root");
const title = document.getElementById("notebook-title");
const status = document.getElementById("runner-status");
const runButton = document.getElementById("run-button");
const resetButton = document.getElementById("reset-button");
const toggleCodeButton = document.getElementById("toggle-code-button");
const sourceLink = document.getElementById("source-link");

function normalizeNotebookEntry(entry) {
  return {
    file: entry.file,
    title: entry.title || entry.file,
    summary: entry.summary || "Runnable mSigSDK workflow.",
    image: entry.image || null,
    workflowGroup: entry.workflowGroup || "reliability",
    workflowGroupLabel: entry.workflowGroupLabel || "Review And Report",
  };
}

async function loadNotebookManifest() {
  try {
    const response = await fetch("./notebooks.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Notebook manifest returned ${response.status}`);
    }
    const manifest = await response.json();
    const notebooks = Array.isArray(manifest?.notebooks)
      ? manifest.notebooks
          .filter((entry) => entry?.file?.endsWith(".onb.html"))
          .map(normalizeNotebookEntry)
      : [];
    return notebooks.length ? notebooks : DEFAULT_NOTEBOOKS;
  } catch (error) {
    console.warn("Falling back to built-in notebook list.", error);
    return DEFAULT_NOTEBOOKS;
  }
}

function getRequestedNotebook() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("notebook") || state.notebooks[0].file;
  const resolved = NOTEBOOK_ALIASES.get(requested) || requested;
  const entry =
    state.notebooks.find((item) => item.file === resolved) ||
    state.notebooks[0]
  if (resolved !== requested) {
    params.set("notebook", entry.file);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params.toString()}${window.location.hash}`
    );
  }
  return entry;
}

function renderMenu(activeFile) {
  const groups = [];
  const groupMap = new Map();

  state.notebooks.forEach((entry) => {
    const key = entry.workflowGroup || "advanced";
    if (!groupMap.has(key)) {
      const group = {
        key,
        label: entry.workflowGroupLabel || key,
        entries: [],
      };
      groupMap.set(key, group);
      groups.push(group);
    }
    groupMap.get(key).entries.push(entry);
  });

  menu.replaceChildren(
    ...groups.map((group) => {
      const section = document.createElement("section");
      section.className = "notebook-menu-group";
      const heading = document.createElement("h2");
      heading.textContent = group.label;
      section.append(heading);
      group.entries.forEach((entry) => {
      const link = document.createElement("a");
      link.href = `?notebook=${encodeURIComponent(entry.file)}`;
      link.className = entry.file === activeFile ? "active" : "";
      link.innerHTML = `${escapeHtml(entry.title)}<br><small>${escapeHtml(
        entry.summary
      )}</small>`;
        section.append(link);
      });
      return section;
    })
  );
}

function setStatus(message, mode = "") {
  status.textContent = message;
  status.className = `runner-status ${mode}`.trim();
}

function refreshEditor(editorState) {
  if (editorState?.type !== "codemirror") return;
  const editor = editorState.editor;
  if (!editor?.refresh) return;
  window.requestAnimationFrame(() => {
    editor.refresh();
    window.setTimeout(() => editor.refresh(), 50);
  });
}

function setCodeCellExpanded(cell, expanded) {
  if (!cell) return;
  cell.element?.classList.toggle("code-expanded", expanded);
  cell.element?.classList.toggle("code-collapsed", !expanded);
  if (cell.editorHost) {
    cell.editorHost.hidden = !expanded;
  }
  if (cell.runCellButton) {
    cell.runCellButton.hidden = !expanded;
  }
  if (cell.resetCellButton) {
    cell.resetCellButton.hidden = !expanded;
  }
  if (cell.toggleSourceButton) {
    cell.toggleSourceButton.textContent = expanded ? "Hide code" : "Show code";
    cell.toggleSourceButton.setAttribute("aria-expanded", String(expanded));
  }
  if (expanded) {
    refreshEditor(cell.editor);
  }
}

function setAllCodeExpanded(expanded) {
  state.showCode = expanded;
  state.moduleCells.forEach((cell) => setCodeCellExpanded(cell, expanded));
  syncGlobalCodeToggle();
}

function syncGlobalCodeToggle() {
  if (!toggleCodeButton) return;
  const hasCode = state.moduleCells.length > 0;
  toggleCodeButton.hidden = !hasCode;
  toggleCodeButton.textContent = state.showCode ? "Hide all code" : "Show all code";
  toggleCodeButton.setAttribute("aria-expanded", String(state.showCode));
}

async function loadNotebook(entry) {
  state.activeNotebook = entry;
  state.cells = [];
  state.moduleCells = [];
  state.activeModuleIndex = -1;
  state.showCode = false;
  title.textContent = entry.title;
  sourceLink.href = `https://github.com/episphere/msig/blob/main/notebooks/${entry.file}`;
  renderMenu(entry.file);
  setStatus(`Loading ${entry.file}...`);

  const response = await fetch(`./${entry.file}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not fetch notebook: ${response.status}`);
  }

  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  const notebookTitle = doc.querySelector("notebook > title")?.textContent?.trim();
  if (notebookTitle) {
    title.textContent = notebookTitle;
  }

  const scripts = [...doc.querySelectorAll("notebook > script")];
  root.replaceChildren();

  scripts.forEach((script) => {
    const type = script.getAttribute("type") || "module";
    const source = normalizeCellSource(script.textContent || "");
    if (type === "text/markdown") {
      const cell = document.createElement("article");
      cell.className = "cell markdown";
      cell.innerHTML = renderMarkdown(source);
      root.append(cell);
      state.cells.push({ type, source, element: cell });
      return;
    }

    if (type === "module") {
      const moduleIndex = state.moduleCells.length;
      const cell = document.createElement("article");
      cell.className = "cell code code-collapsed";

      const header = document.createElement("div");
      header.className = "code-cell-header";
      const label = document.createElement("span");
      label.textContent = `Technical details ${moduleIndex + 1}`;
      const hint = document.createElement("span");
      hint.className = "code-cell-hint";
      hint.textContent = "Code is hidden by default. Open it only if you want to inspect or edit this step.";
      const dirtyBadge = document.createElement("span");
      dirtyBadge.className = "dirty-badge";
      dirtyBadge.textContent = "Edited, not run";
      dirtyBadge.hidden = true;
      const labelWrap = document.createElement("div");
      labelWrap.className = "code-cell-label";
      labelWrap.append(label, hint, dirtyBadge);
      const actions = document.createElement("div");
      actions.className = "code-cell-actions";
      const toggleSourceButton = document.createElement("button");
      toggleSourceButton.type = "button";
      toggleSourceButton.className = "code-source-toggle";
      toggleSourceButton.textContent = "Show code";
      toggleSourceButton.setAttribute("aria-expanded", "false");
      const runCellButton = document.createElement("button");
      runCellButton.type = "button";
      runCellButton.textContent = "Run edits";
      runCellButton.hidden = true;
      const resetCellButton = document.createElement("button");
      resetCellButton.type = "button";
      resetCellButton.textContent = "Reset cell";
      resetCellButton.hidden = true;
      actions.append(toggleSourceButton, runCellButton, resetCellButton);
      header.append(labelWrap, actions);

      const editorHost = document.createElement("div");
      editorHost.className = "code-editor-host";
      editorHost.hidden = true;
      editorHost.setAttribute("aria-label", `Technical code for cell ${moduleIndex + 1}`);

      const output = document.createElement("div");
      output.className = "cell-output";

      cell.append(header, editorHost, output);
      root.append(cell);

      const cellState = {
        type,
        source,
        element: cell,
        editor: null,
        editorHost,
        output,
        dirtyBadge,
        toggleSourceButton,
        runCellButton,
        resetCellButton,
      };
      const editor = createCodeEditor(
        editorHost,
        source,
        () => markDirty(cellState),
        runNotebook
      );
      cellState.editor = editor;
      setCodeCellExpanded(cellState, state.showCode);
      toggleSourceButton.addEventListener("click", () => {
        const expanded = toggleSourceButton.getAttribute("aria-expanded") === "true";
        setCodeCellExpanded(cellState, !expanded);
        state.showCode = state.moduleCells.every((entry) => entry.editorHost && !entry.editorHost.hidden);
        syncGlobalCodeToggle();
      });
      runCellButton.addEventListener("click", runNotebook);
      resetCellButton.addEventListener("click", () => {
        setEditorSource(editor, source);
        markDirty(cellState);
      });
      state.cells.push(cellState);
      state.moduleCells.push(cellState);
    }
  });

  syncGlobalCodeToggle();
    setStatus("Workflow loaded. Running cells...");
  await runNotebook();
}

function normalizeCellSource(source) {
  const normalized = source.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  return lines.map((line) => line.replace(/^ {4}/, "")).join("\n");
}

async function runNotebook() {
  if (state.isRunning) return;

  clearOutputs();
  state.activeModuleIndex = -1;

  if (!state.moduleCells.length) {
    setStatus("This workflow contains narrative cells only.", "ready");
    return;
  }

  setStatus("Running notebook cells...");
  state.isRunning = true;
  runButton.disabled = true;

  const displayFns = state.moduleCells.map((cell) => createDisplay(cell.output));
  const source = state.moduleCells
    .map((cell, index) => {
      return [
        `__helpers.setActive(${index});`,
        `display = __displayFns[${index}];`,
        getEditorSource(cell.editor),
      ].join("\n");
    })
    .join("\n\n");

  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const helpers = {
    setActive(index) {
      state.activeModuleIndex = index;
    },
    html,
    md,
    metrics,
    table,
    details,
    note,
    downloadJson,
    downloadMany,
    downloadText,
    objectFieldRows,
    publicationFigureRows,
    rowsToCsv,
    spectraMatrixToTsv,
    warningRows,
    formatNumber,
    view(value) {
      return value;
    },
  };

  try {
    const runner = new AsyncFunction(
      "__displayFns",
      "__helpers",
      [
        "const html = __helpers.html;",
        "const md = __helpers.md;",
        "const view = __helpers.view;",
        "const downloadJson = __helpers.downloadJson;",
        "const downloadMany = __helpers.downloadMany;",
        "const downloadText = __helpers.downloadText;",
        "const objectFieldRows = __helpers.objectFieldRows;",
        "const publicationFigureRows = __helpers.publicationFigureRows;",
        "const rowsToCsv = __helpers.rowsToCsv;",
        "const spectraMatrixToTsv = __helpers.spectraMatrixToTsv;",
        "const warningRows = __helpers.warningRows;",
        "let display = __displayFns[0];",
        source,
      ].join("\n")
    );
    await runner(displayFns, helpers);
    setStatus("Workflow finished successfully.", "ready");
    markAllClean();
  } catch (error) {
    const target = state.moduleCells[state.activeModuleIndex]?.output;
    if (target) {
      renderError(target, error);
    }
    setStatus(error?.message || "Notebook failed.", "error");
    console.error(error);
  } finally {
    state.isRunning = false;
    runButton.disabled = false;
  }
}

function clearOutputs() {
  state.moduleCells.forEach((cell) => {
    cell.output.replaceChildren();
  });
}

function createDisplay(output) {
  return (value) => {
    appendValue(output, value);
    return value;
  };
}

function appendValue(output, value) {
  if (value instanceof Error) {
    renderError(output, value);
    return;
  }

  if (value instanceof Node) {
    output.append(value);
    return;
  }

  if (value == null) {
    output.append(document.createTextNode(String(value)));
    return;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const pre = document.createElement("pre");
    pre.className = "inspector";
    pre.textContent = String(value);
    output.append(pre);
    return;
  }

  output.append(renderCompactObject(value));
}

function renderError(output, error) {
  const pre = document.createElement("pre");
  pre.className = "output-error";
  pre.textContent = error?.stack || error?.message || String(error);
  output.append(pre);
}

function stringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    (key, item) => {
      if (typeof item === "function") return `[Function ${item.name || "anonymous"}]`;
      if (item instanceof Node) return `[${item.nodeName}]`;
      if (typeof item === "object" && item !== null) {
        if (seen.has(item)) return "[Circular]";
        seen.add(item);
      }
      return item;
    },
    2
  );
}

function html(strings, ...values) {
  const template = document.createElement("template");
  template.innerHTML = String.raw({ raw: strings }, ...values);
  return template.content.cloneNode(true);
}

function md(strings, ...values) {
  const fragment = document.createDocumentFragment();
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderMarkdown(String.raw({ raw: strings }, ...values));
  fragment.append(...wrapper.childNodes);
  return fragment;
}

function metrics(items) {
  const grid = document.createElement("div");
  grid.className = "output-metrics";

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "output-metric";

    const label = document.createElement("span");
    label.textContent = item.label;
    const value = document.createElement("strong");
    value.textContent = item.value == null ? "n/a" : String(item.value);
    card.append(label, value);

    if (item.note) {
      const noteText = document.createElement("small");
      noteText.textContent = item.note;
      card.append(noteText);
    }

    grid.append(card);
  });

  return grid;
}

function pluralizeRows(count) {
  return `${count} row${count === 1 ? "" : "s"}`;
}

function columnKeysForDescription(data, columns) {
  if (Array.isArray(columns) && columns.length) {
    return columns
      .map((column) => (typeof column === "string" ? column : column?.key))
      .filter(Boolean);
  }
  return Object.keys(data?.[0] || {});
}

function inferTableDescription(data, columns) {
  const rowCount = Array.isArray(data) ? data.length : 0;
  const keys = columnKeysForDescription(data, columns);
  const keySet = new Set(keys);
  const has = (...required) => required.every((key) => keySet.has(key));
  const hasAny = (...candidates) => candidates.some((key) => keySet.has(key));

  if (has("sample", "signature", "exposure")) {
    return {
      title: "Signature contribution estimates",
      caption:
        "Shows fitted signature contribution estimates by sample and signature. Read these with the quality checks and warnings.",
    };
  }
  if (has("sample", "mutations") || has("sample", "totalMutations")) {
    return {
      title: "Mutation-count summary",
      caption:
        "Shows mutation counts and low-count review cues for each sample.",
    };
  }
  if (has("sample", "cosineSimilarity", "rmse")) {
    return {
      title: "Reconstruction quality values",
      caption:
        "Shows how closely fitted signatures reconstruct each sample. Higher cosine and lower RMSE are reassuring, but not conclusive alone.",
    };
  }
  if (has("sample", "reportingMode") || has("sample", "reviewFlagCodes")) {
    return {
      title: "Fit-quality evidence",
      caption:
        "Shows the reporting mode and review cues that qualify each sample's fitted signature estimates.",
    };
  }
  if (hasAny("cue", "SDK code", "recommended action", "reviewFlagCodes") || has("code", "message")) {
    return {
      title: "Review cues and suggested checks",
      caption:
        "Shows why the workflow raised cautionary review cues.",
    };
  }
  if (has("number", "action") || has("action")) {
    return {
      title: "Suggested review steps",
      caption:
        "Shows follow-up checks to consider before reporting results.",
    };
  }
  if (hasAny("tool", "tool or package", "files", "supporting details")) {
    return {
      title: "Tool export summary",
      caption:
        "Shows which external-tool files or package outputs are prepared.",
    };
  }
  if (has("file") || has("filename")) {
    return {
      title: "Files produced by this step",
      caption:
        "Shows files available for rerun, review, or sharing.",
    };
  }
  if (has("section") && hasAny("contents", "summary")) {
    return {
      title: "Report sections",
      caption:
        "Shows the major report fields preserved in the workflow output.",
    };
  }
  if (has("field", "value")) {
    return {
      title: "Key settings and values",
      caption:
        "Shows the selected settings or run details used by this step.",
    };
  }
  if (hasAny("output", "check", "column", "table") && hasAny("meaning", "value")) {
    return {
      title: "How to read this output",
      caption:
        "Defines the fields shown in this step.",
    };
  }
  return {
    title: "Result table",
    caption: `Shows ${pluralizeRows(rowCount)} of structured output from this workflow step.`,
  };
}

function table(rows, columns = null, options = {}) {
  const pageSize = Math.max(
    1,
    Math.floor(Number.isFinite(options.pageSize) ? options.pageSize : Number.isFinite(options.maxRows) ? options.maxRows : 12)
  );
  const data = Array.isArray(rows) ? rows : [];
  const wrapper = document.createElement("div");
  wrapper.className = "output-table-wrap";
  const inferredDescription = inferTableDescription(data, columns);
  const tableTitle = options.title === false ? "" : options.title || inferredDescription.title;
  const tableCaption = options.caption === false ? "" : options.caption || inferredDescription.caption;

  if (tableTitle) {
    const title = document.createElement("h4");
    title.className = "output-table-title";
    title.textContent = tableTitle;
    wrapper.append(title);
  }

  if (!data.length) {
    if (tableCaption) {
      const caption = document.createElement("p");
      caption.className = "output-caption";
      caption.textContent = tableCaption;
      wrapper.append(caption);
    }
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
  tableElement.className = "output-table";
  tableElement.dataset.runnerManagedTable = "true";
  tableElement.dataset.pageSize = String(pageSize);
  if (tableCaption) {
    const caption = tableElement.createCaption();
    caption.textContent = tableCaption;
  }
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
  let pageIndex = 0;
  const pageCount = Math.max(1, Math.ceil(data.length / pageSize));
  let pageStatus = null;
  let previousButton = null;
  let nextButton = null;

  function renderPage() {
    const start = pageIndex * pageSize;
    const end = Math.min(start + pageSize, data.length);
    tbody.replaceChildren();
    data.slice(start, end).forEach((row) => {
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
    if (pageStatus) pageStatus.textContent = `Rows ${start + 1}-${end} of ${data.length}`;
    if (previousButton) previousButton.disabled = pageIndex === 0;
    if (nextButton) nextButton.disabled = pageIndex >= pageCount - 1;
  }

  tableElement.append(tbody);
  const scroll = document.createElement("div");
  scroll.className = "output-table-scroll";
  scroll.append(tableElement);
  wrapper.append(scroll);

  if (pageCount > 1) {
    const pagination = document.createElement("div");
    pagination.className = "output-table-pagination";
    pageStatus = document.createElement("span");
    const controls = document.createElement("span");
    controls.className = "output-table-pagination-controls";
    previousButton = document.createElement("button");
    previousButton.type = "button";
    previousButton.textContent = "Previous";
    nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.textContent = "Next";
    previousButton.addEventListener("click", () => {
      if (pageIndex > 0) {
        pageIndex -= 1;
        renderPage();
      }
    });
    nextButton.addEventListener("click", () => {
      if (pageIndex < pageCount - 1) {
        pageIndex += 1;
        renderPage();
      }
    });
    controls.append(previousButton, nextButton);
    pagination.append(pageStatus, controls);
    wrapper.append(pagination);
  }

  renderPage();

  return wrapper;
}

function enhanceStaticTablePagination(scope = root) {
  const tables = Array.from(scope.querySelectorAll("table"));
  tables.forEach((tableElement) => {
    if (
      tableElement.dataset.runnerManagedTable === "true" ||
      tableElement.dataset.msigsdkManagedTable === "true" ||
      tableElement.dataset.notebookTableEnhanced === "true"
    ) {
      return;
    }
    const tbody = tableElement.tBodies?.[0];
    const rows = Array.from(tbody?.rows || []);
    const pageSize = Math.max(1, Math.floor(Number(tableElement.dataset.pageSize) || 12));
    if (rows.length <= pageSize) return;

    tableElement.dataset.notebookTableEnhanced = "true";
    const container =
      tableElement.closest(
        ".output-table-scroll, .msigsdk-output-table-scroll, .markdown-table-wrap, .packet-table-wrap, .maf-row-table-wrap, .cohort-panel-table-wrap"
      ) || tableElement.parentElement;
    if (container) {
      container.classList.add("notebook-table-scroll");
    }

    let pageIndex = 0;
    const pageCount = Math.ceil(rows.length / pageSize);
    const pagination = document.createElement("div");
    pagination.className = "notebook-table-pagination";
    const status = document.createElement("span");
    const controls = document.createElement("span");
    controls.className = "notebook-table-pagination-controls";
    const previousButton = document.createElement("button");
    previousButton.type = "button";
    previousButton.textContent = "Previous";
    const nextButton = document.createElement("button");
    nextButton.type = "button";
    nextButton.textContent = "Next";

    function renderPage() {
      const start = pageIndex * pageSize;
      const end = Math.min(start + pageSize, rows.length);
      rows.forEach((row, index) => {
        row.hidden = index < start || index >= end;
      });
      status.textContent = `Rows ${start + 1}-${end} of ${rows.length}`;
      previousButton.disabled = pageIndex === 0;
      nextButton.disabled = pageIndex >= pageCount - 1;
    }

    previousButton.addEventListener("click", () => {
      if (pageIndex > 0) {
        pageIndex -= 1;
        renderPage();
      }
    });
    nextButton.addEventListener("click", () => {
      if (pageIndex < pageCount - 1) {
        pageIndex += 1;
        renderPage();
      }
    });

    controls.append(previousButton, nextButton);
    pagination.append(status, controls);
    (container || tableElement).after(pagination);
    renderPage();
  });
}

function startTablePaginationObserver() {
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      enhanceStaticTablePagination(root);
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(root, { childList: true, subtree: true });
  schedule();
}

function details(label, value, options = {}) {
  const detailsElement = document.createElement("details");
  detailsElement.className = "output-details";
  detailsElement.open = Boolean(options.open);
  const summary = document.createElement("summary");
  summary.textContent = label;
  const pre = document.createElement("pre");
  pre.className = "inspector";
  pre.textContent = typeof value === "string" ? value : stringify(value);
  detailsElement.append(summary, pre);
  return detailsElement;
}

function downloadText(filename, text, label = `Download ${filename}`) {
  const link = document.createElement("a");
  link.className = "download-link";
  link.href = URL.createObjectURL(new Blob([String(text)], { type: "text/plain;charset=utf-8" }));
  link.download = filename;
  link.textContent = label;
  return link;
}

function downloadJson(filename, value, label = `Download ${filename}`) {
  const text = stringify(value);
  const link = downloadText(filename, text, label);
  link.href = URL.createObjectURL(
    new Blob([text], { type: "application/json;charset=utf-8" })
  );
  return link;
}

function downloadMany(files) {
  const wrapper = document.createElement("div");
  wrapper.className = "download-list";
  files.forEach((file) => {
    const link =
      file.type === "json"
        ? downloadJson(file.filename, file.value, file.label)
        : downloadText(file.filename, file.text ?? file.value ?? "", file.label);
    wrapper.append(link);
  });
  return wrapper;
}

function rowsToCsv(rows, columns = null) {
  const data = Array.isArray(rows) ? rows : [];
  if (!data.length) return "";
  const normalizedColumns = columns || Object.keys(data[0]);
  const keys = normalizedColumns.map((column) =>
    typeof column === "string" ? column : column.key
  );
  const labels = normalizedColumns.map((column) =>
    typeof column === "string" ? column : column.label || column.key
  );
  const escape = (value) => {
    const text = value == null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    labels.map(escape).join(","),
    ...data.map((row) => keys.map((key) => escape(row?.[key])).join(",")),
  ].join("\n");
}

function spectraMatrixToTsv(matrix, contexts = null) {
  const samples = Object.keys(matrix || {});
  const contextList =
    contexts ||
    [...new Set(samples.flatMap((sample) => Object.keys(matrix[sample] || {})))];
  return [
    ["MutationType", ...samples].join("\t"),
    ...contextList.map((context) =>
      [context, ...samples.map((sample) => matrix[sample]?.[context] ?? 0)].join("\t")
    ),
  ].join("\n");
}

function warningRows(warnings = []) {
  return (Array.isArray(warnings) ? warnings : []).map((warning) => ({
    code: warning.code || warning.warningCode || warning.status || "warning",
    message: warning.message || warning.detail || String(warning),
    resolution: warning.resolution || warning.recommendedAction || "",
  }));
}

function objectFieldRows(object, fields = null) {
  const keys = fields || Object.keys(object || {});
  return keys.map((field) => {
    const value = field.split(".").reduce((current, key) => current?.[key], object);
    return {
      field,
      value: formatCell(value),
    };
  });
}

function publicationFigureRows(figures = []) {
  return (Array.isArray(figures) ? figures : []).map((figure) => ({
    id: figure.id,
    title: figure.title,
    renderer: figure.recommendedRenderer,
    dataFields: (figure.dataFields || []).join(", "),
  }));
}

function note(text, mode = "info") {
  const element = document.createElement("p");
  element.className = `output-note ${mode}`;
  element.textContent = text;
  return element;
}

function formatNumber(value, digits = 3) {
  if (!Number.isFinite(value)) return "n/a";
  if (Math.abs(value) >= 100) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return value.toLocaleString(undefined, { maximumSignificantDigits: digits });
}

function formatCell(value) {
  if (Number.isFinite(value)) return formatNumber(value);
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return compactSummary(value);
  return String(value);
}

function renderCompactObject(value) {
  const wrapper = document.createElement("div");
  wrapper.className = "compact-object";
  const pre = document.createElement("pre");
  pre.className = "inspector compact";
  pre.textContent = compactSummary(value);
  wrapper.append(pre);
  wrapper.append(details("Show full object", value));
  return wrapper;
}

function compactSummary(value) {
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    const shown = entries.slice(0, 8).map(([key, item]) => {
      if (Array.isArray(item)) return `${key}: Array(${item.length})`;
      if (item && typeof item === "object") return `${key}: Object(${Object.keys(item).length})`;
      return `${key}: ${String(item)}`;
    });
    const suffix = entries.length > shown.length ? `\n... ${entries.length - shown.length} more keys` : "";
    return shown.join("\n") + suffix;
  }
  return String(value);
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const parts = [];
  let paragraph = [];
  let list = null;
  let fence = null;
  let fenceLines = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    parts.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!list?.items?.length) return;
    const tag = list.type === "ol" ? "ol" : "ul";
    parts.push(
      `<${tag}>${list.items
        .map((item) => `<li>${inlineMarkdown(item)}</li>`)
        .join("")}</${tag}>`
    );
    list = null;
  };

  const appendListItem = (type, item) => {
    flushParagraph();
    if (list && list.type !== type) {
      flushList();
    }
    if (!list) {
      list = { type, items: [] };
    }
    list.items.push(item);
  };

  const splitTableRow = (line) => {
    const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    return trimmed.split("|").map((cell) => cell.trim());
  };

  const isTableSeparator = (line) => {
    if (!line?.includes("|")) return false;
    const cells = splitTableRow(line);
    return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
  };

  const isTableStart = (index) =>
    lines[index]?.includes("|") && isTableSeparator(lines[index + 1] || "");

  const renderTable = (startIndex) => {
    const headers = splitTableRow(lines[startIndex]);
    const bodyRows = [];
    let index = startIndex + 2;

    while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
      const cells = splitTableRow(lines[index]);
      bodyRows.push(cells);
      index += 1;
    }

    const headerHtml = headers
      .map((header) => `<th>${inlineMarkdown(header)}</th>`)
      .join("");
    const bodyHtml = bodyRows
      .map((row) => {
        const cells = headers.map((_, cellIndex) => row[cellIndex] || "");
        return `<tr>${cells
          .map((cell) => `<td>${inlineMarkdown(cell)}</td>`)
          .join("")}</tr>`;
      })
      .join("");

    return {
      html: `<div class="markdown-table-wrap"><table class="markdown-table"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`,
      nextIndex: index,
    };
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^```(\w+)?\s*$/);
    if (fenceMatch && fence === null) {
      flushParagraph();
      flushList();
      fence = fenceMatch[1] || "";
      fenceLines = [];
      continue;
    }

    if (line.trim() === "```" && fence !== null) {
      parts.push(
        `<pre><code${fence ? ` class="language-${escapeHtml(fence)}"` : ""}>${escapeHtml(
          fenceLines.join("\n")
        )}</code></pre>`
      );
      fence = null;
      fenceLines = [];
      continue;
    }

    if (fence !== null) {
      fenceLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    if (isTableStart(index)) {
      flushParagraph();
      flushList();
      const table = renderTable(index);
      parts.push(table.html);
      index = table.nextIndex - 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      parts.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      appendListItem("ul", bullet[1]);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      appendListItem("ol", ordered[1]);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  return parts.join("\n");
}

function inlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
      const href = normalizeMarkdownLink(url.replace(/&amp;/g, "&"));
      return `<a href="${escapeAttribute(href)}">${label}</a>`;
    });
}

function normalizeMarkdownLink(url) {
  try {
    const parsed = new URL(url, window.location.href);
    const notebook = parsed.searchParams.get("notebook");
    if (notebook?.endsWith(".onb.html")) {
      return `?notebook=${encodeURIComponent(notebook)}`;
    }

    if (
      parsed.origin === window.location.origin &&
      parsed.pathname.endsWith(".onb.html")
    ) {
      return `?notebook=${encodeURIComponent(parsed.pathname.split("/").pop())}`;
    }
  } catch (_error) {
    // Keep unusual markdown links as written.
  }

  if (url.endsWith(".onb.html")) {
    return `?notebook=${encodeURIComponent(url.replace(/^\.\//, ""))}`;
  }
  return url;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value) {
  return String(value).replace(/"/g, "&quot;");
}

runButton.addEventListener("click", runNotebook);
toggleCodeButton?.addEventListener("click", () => {
  setAllCodeExpanded(!state.showCode);
});
resetButton.addEventListener("click", async () => {
  state.moduleCells.forEach((cell) => {
    setEditorSource(cell.editor, cell.source);
    markDirty(cell);
  });
  setStatus("Original code restored. Click Run workflow to apply the reset.");
});

async function initNotebookRunner() {
  startTablePaginationObserver();
  state.notebooks = await loadNotebookManifest();
  await loadNotebook(getRequestedNotebook());
}

initNotebookRunner().catch((error) => {
  setStatus(error?.message || "Could not load notebook.", "error");
  console.error(error);
});

function createCodeEditor(parent, source, onChange, onRun) {
  if (!window.CodeMirror) {
    const textarea = document.createElement("textarea");
    textarea.className = "code-editor fallback";
    textarea.spellcheck = false;
    textarea.value = source;
    textarea.addEventListener("input", onChange);
    textarea.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        onRun();
      }
    });
    parent.append(textarea);
    return { type: "textarea", textarea };
  }

  const editor = window.CodeMirror(parent, {
    value: source,
    mode: "javascript",
    theme: "material-darker",
    lineNumbers: true,
    lineWrapping: true,
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: false,
    smartIndent: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    styleActiveLine: true,
    viewportMargin: Infinity,
    extraKeys: {
      Tab(cm) {
        if (cm.somethingSelected()) {
          cm.indentSelection("add");
        } else {
          cm.replaceSelection("  ", "end");
        }
      },
      "Shift-Tab"(cm) {
        cm.indentSelection("subtract");
      },
      "Ctrl-Enter"() {
        onRun();
      },
      "Cmd-Enter"() {
        onRun();
      },
    },
  });
  editor.on("change", onChange);

  return { type: "codemirror", editor };
}

function getEditorSource(editorState) {
  if (editorState.type === "codemirror") {
    return editorState.editor.getValue();
  }
  return editorState.textarea.value;
}

function setEditorSource(editorState, source) {
  if (editorState.type === "codemirror") {
    editorState.editor.setValue(source);
    editorState.editor.refresh();
    return;
  }
  editorState.textarea.value = source;
}

function markDirty(cell) {
  cell.isDirty = true;
  if (cell.dirtyBadge) {
    cell.dirtyBadge.hidden = false;
  }
  if (!state.isRunning) {
    setStatus(
      "You have edited code that has not run yet. Click Run edits, Run workflow, or press Ctrl/Cmd+Enter."
    );
  }
}

function markAllClean() {
  state.moduleCells.forEach((cell) => {
    cell.isDirty = false;
    if (cell.dirtyBadge) {
      cell.dirtyBadge.hidden = true;
    }
  });
}
