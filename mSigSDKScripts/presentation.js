const PRESENTATION_STYLE_ID = "msigsdk-presentation-styles";
const PRESENTATION_TOOLTIP_ID = "msigsdk-presentation-tooltip";

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
      grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));
      gap: 10px;
      margin: 0;
    }
    .msigsdk-output-metric {
      border: 1px solid #d8ded8;
      border-radius: 8px;
      background: #f4f6f2;
      padding: 12px;
      min-width: 0;
    }
    .msigsdk-output-metric span,
    .msigsdk-output-metric small {
      display: block;
      min-width: 0;
      overflow-wrap: anywhere;
      color: #5f6d67;
      font: 12px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .msigsdk-output-metric strong {
      display: block;
      margin-top: 4px;
      min-width: 0;
      max-width: 100%;
      overflow-wrap: anywhere;
      word-break: break-word;
      color: #17201d;
      font: 700 18px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .msigsdk-output-metric small {
      margin-top: 5px;
    }
    .msigsdk-output-table-wrap {
      overflow-x: auto;
    }
    .msigsdk-output-table-title {
      margin: 0 0 4px;
      color: #17201d;
      font: 800 14px/1.3 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .msigsdk-output-table {
      width: 100%;
      border-collapse: collapse;
      color: #17201d;
      font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .msigsdk-output-table caption {
      caption-side: top;
      padding: 0 0 8px;
      color: #5f6d67;
      text-align: left;
      font: 12px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
    .msigsdk-tooltip-term {
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      cursor: help;
      display: inline;
      font: inherit;
      padding: 0;
      text-decoration: underline dotted #147d7f 1px;
      text-underline-offset: 3px;
    }
    .msigsdk-tooltip-term:focus {
      outline: 2px solid #147d7f;
      outline-offset: 2px;
    }
    .msigsdk-tooltip-chip {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
      margin: 1px 3px 1px 0;
      border: 1px solid #cbd8d1;
      border-radius: 999px;
      background: #f4f8f6;
      padding: 1px 7px;
      color: #17201d;
      font-weight: 700;
      white-space: nowrap;
      text-decoration: none;
    }
    .msigsdk-output-table th .msigsdk-tooltip-term {
      color: #17201d;
      font-weight: 800;
    }
    .msigsdk-tooltip-popover {
      position: fixed;
      z-index: 2147483647;
      box-sizing: border-box;
      max-width: min(380px, calc(100vw - 20px));
      border: 1px solid rgba(232, 241, 237, 0.16);
      border-radius: 8px;
      background: #17201d;
      box-shadow: 0 16px 42px rgba(16, 22, 20, 0.24);
      color: #f8faf7;
      opacity: 0;
      pointer-events: none;
      padding: 10px 12px;
      transform: translateY(2px);
      transition: opacity 80ms ease, transform 80ms ease;
      font: 12px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .msigsdk-tooltip-popover[data-visible="true"] {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  document.head.append(style);
}

function ensureTooltipBehavior() {
  if (!canUseDom()) return;
  ensurePresentationStyles();
  if (document.documentElement.dataset.msigsdkTooltipBehavior === "ready") return;
  document.documentElement.dataset.msigsdkTooltipBehavior = "ready";

  function getPopover() {
    let popover = document.getElementById(PRESENTATION_TOOLTIP_ID);
    if (!popover) {
      popover = document.createElement("div");
      popover.id = PRESENTATION_TOOLTIP_ID;
      popover.className = "msigsdk-tooltip-popover";
      popover.setAttribute("role", "tooltip");
      document.body.append(popover);
    }
    return popover;
  }

  function positionPopover(popover, target) {
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = popover.getBoundingClientRect();
    const margin = 10;
    const offset = 8;
    let left = targetRect.right + offset;
    if (left + tooltipRect.width > window.innerWidth - margin) {
      left = targetRect.left - tooltipRect.width - offset;
    }
    left = Math.min(
      Math.max(left, margin),
      Math.max(margin, window.innerWidth - tooltipRect.width - margin)
    );

    let top = targetRect.top;
    if (top + tooltipRect.height > window.innerHeight - margin) {
      top = targetRect.top - tooltipRect.height - 8;
    }
    if (top < margin) top = margin;
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  function showTooltip(target) {
    const text = target?.dataset?.msigsdkTooltip;
    if (!text) return;
    const popover = getPopover();
    popover.textContent = text;
    popover.dataset.visible = "false";
    popover.style.left = "0px";
    popover.style.top = "0px";
    positionPopover(popover, target);
    popover.dataset.visible = "true";
  }

  function hideTooltip() {
    const popover = document.getElementById(PRESENTATION_TOOLTIP_ID);
    if (popover) popover.dataset.visible = "false";
  }

  document.addEventListener("mouseover", (event) => {
    const target = event.target?.closest?.("[data-msigsdk-tooltip]");
    if (target) showTooltip(target);
  });
  document.addEventListener("focusin", (event) => {
    const target = event.target?.closest?.("[data-msigsdk-tooltip]");
    if (target) showTooltip(target);
  });
  document.addEventListener("mouseout", (event) => {
    const target = event.target?.closest?.("[data-msigsdk-tooltip]");
    if (target && !target.contains(event.relatedTarget)) hideTooltip();
  });
  document.addEventListener("focusout", (event) => {
    if (event.target?.closest?.("[data-msigsdk-tooltip]")) hideTooltip();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideTooltip();
  });
}

function labeledTooltipTerms(labels, definitions) {
  return Object.fromEntries(
    Object.entries(labels).map(([code, label]) => [
      label,
      `SDK code: ${code}. ${definitions[code] || "Review the associated SDK result for the rule details."}`,
    ])
  );
}

function displayTerm(value, labels) {
  return labels[value] || value;
}

function displayTerms(values, labels) {
  return (Array.isArray(values) ? values : [values])
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => displayTerm(value, labels));
}

const REPORTING_MODE_LABELS = Object.freeze({
  standard_qc_passed: "no active configured QC cue",
  report_with_caveats: "report with caveats",
  restricted_interpretation: "restricted interpretation",
  not_assessable: "not assessable",
});

const REPORTING_MODE_DEFINITIONS = Object.freeze({
  standard_qc_passed:
    "No configured fit-quality rule raised a review cue. This does not prove correctness; exposures still depend on the supplied catalog, assay context, and thresholds.",
  report_with_caveats:
    "One or more review cues were triggered. Interpret the fit with the listed uncertainty, threshold, identifiability, or catalog caveats.",
  restricted_interpretation:
    "Configured rules indicate that fine-grained exposure interpretation should be limited. Prefer high-level patterns unless burden, residual, uncertainty, and identifiability evidence warrant more detail.",
  not_assessable:
    "The selected settings did not provide enough review evidence for fine-grained exposure interpretation.",
});

const REPORTING_MODE_TOOLTIPS = Object.freeze({
  ...REPORTING_MODE_DEFINITIONS,
  ...labeledTooltipTerms(REPORTING_MODE_LABELS, REPORTING_MODE_DEFINITIONS),
});

const REVIEW_FLAG_LABELS = Object.freeze({
  CATALOG_INCOMPLETE_SUSPECTED: "catalog review cue",
  FIT_UNSTABLE: "fit stability review cue",
  FLAT_SIGNATURE_RISK: "flat-profile review cue",
  HIGH_RESIDUAL_STRUCTURE: "structured-residual review cue",
  INCOMPLETE_CONTEXTS: "context-basis review cue",
  INSUFFICIENT_SIGNAL: "low-signal review cue",
  LOW_BURDEN: "low-burden review cue",
  PANEL_SIGNATURE_NOT_ASSESSABLE: "restricted-assay review cue",
  SIGNATURE_AMBIGUITY: "identifiability review cue",
  THRESHOLD_DEPENDENT: "threshold-sensitivity review cue",
});

const REVIEW_FLAG_DEFINITIONS = Object.freeze({
  CATALOG_INCOMPLETE_SUSPECTED:
    "Triggered when residual and reconstruction criteria indicate the supplied catalog may not explain all observed structure. This is a cue to inspect residuals or compare a broader/more appropriate catalog, not proof that a missing signature exists.",
  FIT_UNSTABLE:
    "Triggered by bootstrap or sensitivity criteria indicating that fitted exposures should not be interpreted without uncertainty context.",
  FLAT_SIGNATURE_RISK:
    "Triggered when a fitted reference signature meets the broad/flat catalog criterion. Such profiles can be exchangeable with related signatures, especially in low-burden samples.",
  HIGH_RESIDUAL_STRUCTURE:
    "Triggered when the residual screen finds structured residual patterning under the configured rule. Inspect the residual plot before drawing interpretation.",
  INCOMPLETE_CONTEXTS:
    "Triggered because the matrix is missing one or more contexts expected for the selected context space.",
  INSUFFICIENT_SIGNAL:
    "Triggered because the mutation count is below the configured minimum for fine-grained exposure review.",
  LOW_BURDEN:
    "Triggered because the sample mutation count is below the configured low-burden threshold, so sampling noise can have a larger effect.",
  PANEL_SIGNATURE_NOT_ASSESSABLE:
    "Triggered because the restricted assay or callable context space does not provide enough review evidence for this signature/sample setting.",
  SIGNATURE_AMBIGUITY:
    "Triggered by continuous, catalog-relative signature-identifiability evidence for at least one active fitted signature. The cue reflects neighbor similarity, catalog crowding, broad/flat profile shape, or low specificity; it is not based on the sample reconstruction cosine and is not an etiology claim.",
  THRESHOLD_DEPENDENT:
    "Triggered when a fitted signature crosses the present/nonzero review threshold differently across the tested exposure cutoffs.",
});

const REVIEW_FLAG_TOOLTIPS = Object.freeze({
  ...REVIEW_FLAG_DEFINITIONS,
  ...labeledTooltipTerms(REVIEW_FLAG_LABELS, REVIEW_FLAG_DEFINITIONS),
});

const BURDEN_CLASS_TOOLTIPS = Object.freeze({
  insufficient:
    "The mutation count is below the configured minimum for fine-grained exposure review.",
  low:
    "Mutation burden is below the configured low-burden threshold; fitted exposures may be more sensitive to sampling noise.",
  moderate:
    "Mutation burden is within the configured moderate range; review threshold sensitivity and residual evidence before detailed interpretation.",
  high:
    "Mutation burden is above the configured high-information threshold, but interpretation still depends on catalog, residual, uncertainty, and identifiability evidence.",
});

const IDENTIFIABILITY_EVIDENCE_LABELS = Object.freeze({
  catalog_neighbor_confusable: "near-neighbor similarity cue",
  neighbor_crowded_catalog_region: "crowded-catalog-region cue",
  broad_or_flat_signature: "broad/flat-profile cue",
  low_specificity_profile: "low-specificity-profile cue",
  near_review_boundary: "near-review-boundary cue",
  none: "no identifiability cue",
});

const IDENTIFIABILITY_EVIDENCE_DEFINITIONS = Object.freeze({
  catalog_neighbor_confusable:
    "Assigned because this reference signature is unusually similar to its nearest catalog neighbor under the configured catalog-relative rule. Treat fitted exposure as potentially exchangeable with nearby signatures.",
  neighbor_crowded_catalog_region:
    "Assigned because several nearby reference signatures have similar profiles under the configured catalog-relative rule. This is a cue for review, not a distinct biological conclusion.",
  broad_or_flat_signature:
    "Assigned because this reference signature meets the broad/flat profile criterion relative to the selected catalog. Such profiles may absorb related signal and should be interpreted cautiously.",
  low_specificity_profile:
    "Assigned because this reference signature meets the low-specificity criterion under the configured summary statistic; no single context strongly dominates the profile.",
  near_review_boundary:
    "Assigned because the continuous confusability percentile is close to the configured review boundary. Do not treat the boundary as a scientific discontinuity.",
  none:
    "No configured catalog-relative identifiability cue was active for this table entry.",
});

const IDENTIFIABILITY_EVIDENCE_TOOLTIPS = Object.freeze({
  ...IDENTIFIABILITY_EVIDENCE_DEFINITIONS,
  ...labeledTooltipTerms(IDENTIFIABILITY_EVIDENCE_LABELS, IDENTIFIABILITY_EVIDENCE_DEFINITIONS),
});

const CATALOG_STATUS_LABELS = Object.freeze({
  catalog_sufficient_for_fit: "no catalog cue",
  possible_out_of_reference: "possible catalog review cue",
  suspected_out_of_reference: "catalog review cue",
  not_checked: "not checked",
});

const CATALOG_STATUS_DEFINITIONS = Object.freeze({
  catalog_sufficient_for_fit:
    "No configured residual/reconstruction rule raised a catalog review cue. This does not prove that the catalog is complete.",
  possible_out_of_reference:
    "A weak residual or reconstruction criterion was met. Inspect residuals before considering a broader catalog; this is not proof of out-of-reference signal.",
  suspected_out_of_reference:
    "A catalog-review residual or reconstruction criterion was met. This is a review cue that the selected catalog may not explain all observed structure, not proof of a missing process.",
  not_checked:
    "Catalog sufficiency was not checked or no catalog status was available for this sample.",
});

const CATALOG_STATUS_TOOLTIPS = Object.freeze({
  ...CATALOG_STATUS_DEFINITIONS,
  ...labeledTooltipTerms(CATALOG_STATUS_LABELS, CATALOG_STATUS_DEFINITIONS),
});

const PANEL_TIER_LABELS = Object.freeze({
  higher_review_support: "higher review tier",
  limited_review_support: "limited review tier",
  not_detected_within_review_settings: "below review threshold",
  not_assessable: "not assessable",
});

const PANEL_TIER_DEFINITIONS = Object.freeze({
  higher_review_support:
    "The fitted exposure met the configured higher-support review threshold and upstream fit evidence was not restricted. This is review support, not definitive detection.",
  limited_review_support:
    "The fitted exposure met the lower review threshold but did not meet all higher-support criteria.",
  not_detected_within_review_settings:
    "The fitted exposure was below the configured review threshold. This is not proof of biological absence.",
  not_assessable:
    "The assay/sample setting does not provide enough review evidence for a detection or non-detection statement for this signature.",
});

const PANEL_TIER_TOOLTIPS = Object.freeze({
  ...PANEL_TIER_DEFINITIONS,
  ...labeledTooltipTerms(PANEL_TIER_LABELS, PANEL_TIER_DEFINITIONS),
});

const ASSESSABILITY_TOOLTIPS = Object.freeze({
  assessable:
    "Callable territory, burden, and upstream fit evidence meet the configured requirements for a review-tier statement.",
  limited:
    "The review statement is limited by burden, callable territory, or upstream fit evidence.",
  not_assessable:
    "The assay/sample setting does not provide enough review evidence for a detection or non-detection statement.",
});

const DEFAULT_TOOLTIP_TERMS = Object.freeze({
  ...REPORTING_MODE_TOOLTIPS,
  ...REVIEW_FLAG_TOOLTIPS,
  ...IDENTIFIABILITY_EVIDENCE_TOOLTIPS,
  ...CATALOG_STATUS_TOOLTIPS,
  ...PANEL_TIER_TOOLTIPS,
});

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

function tooltipText(definition) {
  if (!definition) return "";
  if (typeof definition === "string") return definition;
  if (typeof definition === "object") {
    return [
      definition.definition,
      definition.rule,
      definition.interpretation,
      definition.boundary,
      definition.action,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return String(definition);
}

function createTooltipElement(label, tooltip, className = "") {
  ensureTooltipBehavior();
  const button = document.createElement("button");
  button.type = "button";
  button.className = `msigsdk-tooltip-term ${className}`.trim();
  button.textContent = label;
  button.dataset.msigsdkTooltip = tooltip;
  button.setAttribute("aria-label", `${label}: ${tooltip}`);
  return button;
}

function normalizeTooltipTerms(terms = {}) {
  return Object.fromEntries(
    Object.entries(terms || {}).map(([key, value]) => [key, tooltipText(value)])
  );
}

function resolveCellTooltip(token, column, tooltipTerms, row) {
  const value = String(token || "").trim();
  if (!value) return "";
  if (typeof column?.tooltipFor === "function") {
    const dynamicTooltip = tooltipText(column.tooltipFor(value, row));
    if (dynamicTooltip) return dynamicTooltip;
  }
  const columnTerms = normalizeTooltipTerms(column?.tooltipTerms || {});
  return columnTerms[value] || tooltipTerms[value] || "";
}

function appendTooltipCellContent(td, value, row, column, tooltipTerms, formatter) {
  const formatted = formatter ? formatter(value, row) : value;
  const rawTokens = Array.isArray(formatted)
    ? formatted
    : typeof formatted === "string" && /[,;]/.test(formatted)
      ? formatted.split(/\s*[,;]\s*/)
      : null;

  if (rawTokens) {
    const tokens = rawTokens.map((token) => String(token || "").trim()).filter(Boolean);
    if (!tokens.length) {
      td.textContent = "none";
      return;
    }
    tokens.forEach((token, index) => {
      if (index) td.append(document.createTextNode(", "));
      const tooltip = resolveCellTooltip(token, column, tooltipTerms, row);
      td.append(
        tooltip
          ? createTooltipElement(token, tooltip, column?.chip === false ? "" : "msigsdk-tooltip-chip")
          : document.createTextNode(token)
      );
    });
    return;
  }

  const text = formatCell(formatted);
  const tooltip = resolveCellTooltip(text, column, tooltipTerms, row);
  if (tooltip) {
    td.append(createTooltipElement(text, tooltip, column?.chip ? "msigsdk-tooltip-chip" : ""));
  } else {
    td.textContent = text;
  }
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
	      title: "Signature recipe estimates",
	      caption:
	        "Shows the fitted signature recipe by sample and signature. These are model estimates, so read them with the review evidence and warnings.",
	    };
	  }

  if (has("sample", "mutations") || has("sample", "totalMutations")) {
    return {
      title: "Mutation-count summary",
      caption:
        "Shows mutation counts and low-count review cues for each sample. Low-count samples can still be analyzed, but their fitted contributions are less stable.",
    };
  }

	  if (has("sample", "cosineSimilarity", "rmse")) {
	    return {
	      title: "Reconstruction quality values",
	      caption:
	        "Shows whether the guessed signature recipe can recreate each observed sample pattern. Higher cosine and lower RMSE are reassuring, but neither is a stand-alone proof of correctness.",
	    };
	  }

	  if (has("sample", "reportingMode") || has("sample", "reviewFlagCodes")) {
	    return {
	      title: "Review evidence",
	      caption:
	        "Shows the reporting mode and review cues for each sample. Use this table to decide what caveats should accompany the fitted signature recipe.",
	    };
	  }

  if (hasAny("cue", "SDK code", "recommended action", "reviewFlagCodes") || has("code", "message")) {
    return {
      title: "Review cues and suggested checks",
      caption:
        "Shows why the workflow raised cautionary review cues. These are prompts for inspection, not conclusions by themselves.",
    };
  }

  if (has("number", "action") || has("action")) {
    return {
      title: "Suggested review steps",
      caption:
        "Shows follow-up checks generated from the review evidence. Use these as a practical checklist before reporting results.",
    };
  }

  if (hasAny("threshold", "cutoff", "thresholdLabel")) {
    return {
      title: "Cutoff sensitivity values",
      caption:
        "Shows how results change as the minimum signature contribution cutoff changes. Stable results should change gradually rather than abruptly.",
    };
  }

  if (has("signature") && hasAny("lower", "upper", "selectedFrequency", "selectionFrequency")) {
    return {
      title: "Uncertainty interval values",
      caption:
	        "Shows resampling-based uncertainty for fitted signature recipe estimates. Wide intervals or inconsistent selection suggest extra caution.",
    };
  }

  if (hasAny("similarity cues", "nearest-neighbor similarity", "similarity risk score")) {
    return {
      title: "Reference-signature similarity evidence",
      caption:
        "Shows catalog-level similarity cues for reference signatures. These cues describe possible exchangeability among signatures, not sample reconstruction quality.",
    };
  }

  if (hasAny("tool", "tool or package", "files", "supporting details")) {
    return {
      title: "Tool export summary",
      caption:
        "Shows which external-tool file formats or package outputs are prepared for comparison, rerun, or export.",
    };
  }

  if (has("file") || has("filename")) {
    return {
      title: "Files produced by this step",
      caption:
        "Shows the files available from this workflow step and why each one is useful for rerun, review, or sharing.",
    };
  }

  if (has("section") && hasAny("contents", "summary")) {
    return {
      title: "Report sections",
      caption:
        "Shows the major report fields preserved in the structured workflow output.",
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
        "Defines the fields shown in this step so the table can be interpreted without a separate glossary.",
    };
  }

  return {
    title: "Result table",
    caption: `Shows ${pluralizeRows(rowCount)} of structured output from this notebook step.`,
  };
}

function table(rows, columns = null, options = {}) {
  requireDom("table");
  const maxRows = Number.isFinite(options.maxRows) ? options.maxRows : 12;
  const tooltipTerms = options.tooltipTerms
    ? normalizeTooltipTerms({ ...DEFAULT_TOOLTIP_TERMS, ...options.tooltipTerms })
    : null;
  const data = Array.isArray(rows) ? rows : [];
  const wrapper = document.createElement("div");
  wrapper.className = "msigsdk-output-table-wrap";
  const inferredDescription = inferTableDescription(data, columns);
  const tableTitle = options.title === false ? "" : options.title || inferredDescription.title;
  const tableCaption = options.caption === false ? "" : options.caption || inferredDescription.caption;

  if (tableTitle) {
    const title = document.createElement("h4");
    title.className = "msigsdk-output-table-title";
    title.textContent = tableTitle;
    wrapper.append(title);
  }

  if (!data.length) {
    if (tableCaption) {
      const caption = document.createElement("p");
      caption.className = "msigsdk-output-caption";
      caption.textContent = tableCaption;
      wrapper.append(caption);
    }
    wrapper.append(note("No rows to display."));
    return wrapper;
  }

  const defaultColumnLabel = (key) =>
    ({
      lowBurden: "Low-burden review cue",
      reviewFlagCodes: "Review cue codes",
      reviewFlagCount: "Review cue count",
    }[key] || key);
  const normalizedColumns =
    columns ||
    Object.keys(data[0]).map((key) => ({
      key,
      label: defaultColumnLabel(key),
    }));
  const tableElement = document.createElement("table");
  tableElement.className = "msigsdk-output-table";
  if (tableCaption) {
    const caption = tableElement.createCaption();
    caption.textContent = tableCaption;
  }
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  normalizedColumns.forEach((column) => {
    const th = document.createElement("th");
    if (typeof column === "object" && column.tooltip) {
      th.append(createTooltipElement(column.label || column.key, tooltipText(column.tooltip)));
    } else {
      th.textContent = typeof column === "string" ? column : column.label || column.key;
    }
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
      if (tooltipTerms) {
        appendTooltipCellContent(td, value, row, typeof column === "object" ? column : {}, tooltipTerms, formatter);
      } else {
        td.textContent = formatter ? formatter(value, row) : formatCell(value);
      }
      tr.append(td);
    });
    tbody.append(tr);
  });
  tableElement.append(tbody);
  wrapper.append(tableElement);

  if (data.length > maxRows) {
    const rowCountCaption = document.createElement("p");
    rowCountCaption.className = "msigsdk-output-caption";
    rowCountCaption.textContent = `Showing ${maxRows} of ${data.length} rows.`;
    wrapper.append(rowCountCaption);
  }

  return wrapper;
}

function tooltipTable(rows, columns = null, options = {}) {
  return table(rows, columns, {
    ...options,
    tooltipTerms: {
      ...DEFAULT_TOOLTIP_TERMS,
      ...(options.tooltipTerms || {}),
    },
  });
}

function fitQualityEvidenceRows(fitQualityEvidence) {
  return (fitQualityEvidence?.samples || []).map((sample) => {
    const ambiguity = sample.componentEvidence?.ambiguity || {};
    const reconstruction = sample.componentEvidence?.reconstruction || {};
    const burden = sample.componentEvidence?.burden || {};
    return {
      sample: sample.sample,
      reportingMode: displayTerm(
        sample.reportingMode || sample.recommendedReportingMode,
        REPORTING_MODE_LABELS
      ),
      reviewFlagCodes: displayTerms(sample.reviewFlagCodes || [], REVIEW_FLAG_LABELS),
      reviewFlagCount: sample.reviewFlagCount ?? (sample.reviewFlagCodes || []).length,
      totalMutations: sample.metrics?.totalMutations ?? burden.totalMutations,
      burdenClass: sample.metrics?.burdenClass ?? burden.burdenClass,
      reconstructionCosine:
        sample.metrics?.cosineSimilarity ?? reconstruction.cosineSimilarity,
      activeSignatures:
        ambiguity.activeSignatures || sample.metrics?.activeSignatures || [],
      activeIdentifiabilityEvidence:
        displayTerms(
          ambiguity.activeAmbiguityEvidenceTags?.length
            ? ambiguity.activeAmbiguityEvidenceTags
            : ["none"],
          IDENTIFIABILITY_EVIDENCE_LABELS
        ),
      maxConfusabilityScore:
        ambiguity.maxActiveConfusabilityScore ??
        sample.metrics?.maxActiveConfusabilityScore ??
        null,
      reviewRecommendedSignatures:
        ambiguity.activeReviewRecommendedSignatures ||
        sample.metrics?.activeReviewRecommendedSignatures ||
        [],
      catalogStatus: displayTerm(
        sample.catalogStatus || sample.componentEvidence?.catalog?.status,
        CATALOG_STATUS_LABELS
      ),
    };
  });
}

function fitQualityEvidenceTable(fitQualityEvidence, options = {}) {
  const rows = options.rows || fitQualityEvidenceRows(fitQualityEvidence);
  const columns = (
    options.columns ||
    [
      { key: "sample", label: "Sample" },
      {
	        key: "reportingMode",
	        label: "Reporting mode",
	        tooltip:
	          "Plain-language reporting recommendation for the sample. Hover each value for the SDK code, triggering rule, and interpretation boundary.",
        tooltipTerms: REPORTING_MODE_TOOLTIPS,
      },
      {
	        key: "reviewFlagCodes",
	        label: "Review cues",
	        tooltip:
	          "Rule-based reasons to inspect the fitted recipe more carefully. Hover each cue for the SDK code and why it was triggered.",
        tooltipTerms: REVIEW_FLAG_TOOLTIPS,
      },
      {
        key: "totalMutations",
        label: "Mutations",
        tooltip:
          "Total mutation burden used by low-burden and assessability criteria.",
      },
      {
        key: "burdenClass",
        label: "Burden class",
        tooltip:
          "Mutation-burden class under the configured low and moderate burden thresholds.",
        tooltipTerms: BURDEN_CLASS_TOOLTIPS,
      },
      {
	        key: "reconstructionCosine",
	        label: "Reconstruction cosine",
	        tooltip:
	          "Shape-match score between the observed sample pattern and the pattern rebuilt from the fitted signature recipe. Closer to 1 is better. This is not the rule that emits SIGNATURE_AMBIGUITY.",
      },
      {
	        key: "activeIdentifiabilityEvidence",
	        label: "Identifiability cues",
	        tooltip:
	          "Catalog-relative review cues for active fitted signatures. They mean some reference ingredients are similar or hard to separate; they do not come from a single hard sample-cosine cutoff.",
        tooltipTerms: IDENTIFIABILITY_EVIDENCE_TOOLTIPS,
      },
      {
	        key: "maxConfusabilityScore",
	        label: "Max confusability",
	        tooltip:
	          "Maximum continuous catalog-relative similarity score among active fitted signatures. Higher values mean more reason to review whether similar signatures could be exchanged; they are not cause-of-mutation claims.",
      },
      {
	        key: "catalogStatus",
	        label: "Catalog status",
	        tooltip:
	          "Catalog review status from leftover-pattern and reconstruction checks. A cue indicates a reason to inspect residuals or catalog choice, not proof of a missing process.",
        tooltipTerms: CATALOG_STATUS_TOOLTIPS,
      },
    ]
  ).map((column) => (typeof column === "string" ? column : { ...column }));

  if (options.includeActiveSignatures) {
    const insertAt = columns.findIndex((column) => column.key === "activeIdentifiabilityEvidence");
    columns.splice(Math.max(insertAt, 0), 0, {
	      key: "activeSignatures",
	      label: "Active signatures",
	      tooltip:
	        "Reference signatures with non-zero fitted contribution in the sample. Identifiability review cues refer to these active fitted signatures.",
    });
  }

  return tooltipTable(rows, columns, {
    maxRows: Number.isFinite(options.maxRows) ? options.maxRows : 12,
    tooltipTerms: options.tooltipTerms,
	    title: options.title || "Review evidence",
	    caption:
	      options.caption ||
	      "Shows the reporting mode and review cues that qualify each sample's fitted signature recipe.",
	  });
	}

function panelEvidenceRows(panelWorkflowResultOrCalls) {
  const evidenceCalls =
    panelWorkflowResultOrCalls?.panel?.evidenceCalls || panelWorkflowResultOrCalls || {};
  return Object.entries(evidenceCalls).flatMap(([sample, calls]) =>
    (Array.isArray(calls) ? calls : []).map((call) => ({
      sample,
      signature: call.signatureName || call.signature,
      exposure: call.exposure,
      tier: displayTerm(call.tier, PANEL_TIER_LABELS),
      assessability: call.assessabilityClass || call.assessability,
      totalMutations: call.totalMutations,
      reasons: (call.assessabilityReasons || [])
        .map((reason) => reason.detail || reason.code || String(reason))
        .join("; "),
    }))
  );
}

function panelEvidenceTable(panelWorkflowResultOrCalls, options = {}) {
  const rows = options.rows || panelEvidenceRows(panelWorkflowResultOrCalls);
  return tooltipTable(
    rows,
    options.columns || [
      { key: "sample", label: "Sample" },
      { key: "signature", label: "Signature" },
      { key: "exposure", label: "Exposure" },
      {
        key: "tier",
        label: "Evidence tier",
        tooltip:
          "Panel/WES evidence tier under the configured burden, exposure, callable-territory, and fit-quality rules.",
        tooltipTerms: PANEL_TIER_TOOLTIPS,
      },
      {
        key: "assessability",
        label: "Assessability",
        tooltip:
          "Whether the assay and sample support an interpretable tier statement.",
        tooltipTerms: ASSESSABILITY_TOOLTIPS,
      },
      { key: "totalMutations", label: "Mutations" },
      { key: "reasons", label: "Reasons" },
    ],
    {
      maxRows: Number.isFinite(options.maxRows) ? options.maxRows : 12,
      tooltipTerms: options.tooltipTerms,
      title: options.title || "Panel/WES evidence review",
      caption:
        options.caption ||
        "Shows which panel/WES evidence tier was assigned for each sample and signature, along with assessability reasons.",
    }
  );
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
  DEFAULT_TOOLTIP_TERMS,
  details,
  exposureRows,
  fitQualityEvidenceRows,
  fitQualityEvidenceTable,
  formatCell,
  formatNumber,
  metrics,
  nmfMatchRows,
  note,
  panelEvidenceRows,
  panelEvidenceTable,
  reconstructionRows,
  reportFieldRows,
  table,
  thresholdRows,
  tooltipTable,
};
