import embed from "vega-embed";
import catalog from "./generated/catalog.json";
import "./styles.css";

const state = {
  query: "",
  selectedTags: [],
  tagFiltersExpanded: false,
  specListExpanded: false,
  gridColumns: 3,
  slug: null,
  quickPreviewSlug: null,
  quickPreviewInspectorTab: null,
  inspectorTab: null,
};

const viewState = {
  selectedSlug: null,
  quickPreviewSlug: null,
};

let resizeFrame = null;
const repo = {
  name: "nhs-vega-library",
  fullName: "paddy-devan/nhs-vega-library",
  url: "https://github.com/paddy-devan/nhs-vega-library",
  stars: null,
};

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function isIsoDateTimeString(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(value)
  );
}

function parseSampleDataDates(sampleData) {
  return sampleData.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        if (!isIsoDateTimeString(value)) {
          return [key, value];
        }

        const parsedDate = new Date(value);
        return Number.isNaN(parsedDate.valueOf()) ? [key, value] : [key, parsedDate];
      }),
    ),
  );
}

function withVegaDataset(spec, sampleData) {
  const nextSpec = cloneJson(spec);
  const dataset = nextSpec.data.find((entry) => entry && entry.name === "dataset");
  dataset.values = parseSampleDataDates(sampleData);
  return nextSpec;
}

function withVegaLiteDataset(spec, sampleData) {
  const nextSpec = cloneJson(spec);
  nextSpec.data = {
    ...nextSpec.data,
    values: parseSampleDataDates(sampleData),
  };
  return nextSpec;
}

function withDataset(spec, sampleData, language) {
  return language === "vega-lite"
    ? withVegaLiteDataset(spec, sampleData)
    : withVegaDataset(spec, sampleData);
}

function withPreviewDimensions(spec, previewNode, options = {}) {
  const nextSpec = cloneJson(spec);
  const styles = window.getComputedStyle(previewNode);
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  const innerWidth =
    previewNode.clientWidth - paddingLeft - paddingRight ||
    previewNode.parentElement?.clientWidth ||
    0;
  const innerHeight = previewNode.clientHeight || 0;

  nextSpec.width = Math.max(options.minWidth ?? 320, innerWidth - (options.widthOffset ?? 64));
  nextSpec.height =
    options.height ??
    Math.max(options.minHeight ?? 320, innerHeight - (options.heightOffset ?? 48));

  if (options.fit) {
    nextSpec.autosize = {
      type: "fit",
      contains: "padding",
      resize: true,
    };
  }

  return nextSpec;
}

function getSpecs() {
  const query = state.query.trim().toLowerCase();

  return catalog.specs.filter((item) => {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const tagMatches =
      state.selectedTags.length === 0 || state.selectedTags.some((tag) => tags.includes(tag));
    const text = `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase();
    const queryMatches = query.length === 0 || text.includes(query);
    return tagMatches && queryMatches;
  });
}

function getMaxGridColumnsForViewport() {
  if (window.innerWidth <= 720) {
    return 1;
  }

  if (window.innerWidth <= 960) {
    return 2;
  }

  return 3;
}

function getEffectiveGridColumns() {
  return Math.min(state.gridColumns, getMaxGridColumnsForViewport());
}

function findSelectedSpec(specs) {
  if (state.slug) {
    return specs.find((item) => item.slug === state.slug) ?? null;
  }

  return specs[0] ?? null;
}

function getSelectedSpec(specs) {
  return findSelectedSpec(specs) ?? findSelectedSpec(catalog.specs);
}

function readHashSlug() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const slug = catalog.specs.some((item) => item.slug === hash) ? hash : null;
  state.slug = slug;
  state.quickPreviewSlug = slug;
}

function updateHash(slug) {
  const nextUrl = slug
    ? `${window.location.pathname}${window.location.search}#${slug}`
    : `${window.location.pathname}${window.location.search}`;

  if (`${window.location.pathname}${window.location.search}${window.location.hash}` === nextUrl) {
    return;
  }

  if (!slug) {
    history.pushState(null, "", nextUrl);
    return;
  }

  history.pushState(null, "", nextUrl);
}

function renderFilters() {
  return `
    <section class="filters-panel">
      <div class="search-row">
        <label class="search-field">
          <input
            id="search-input"
            type="search"
            placeholder="Search visuals"
            value="${escapeHtml(state.query)}"
          />
        </label>
        <button
          class="filter-toggle${state.tagFiltersExpanded ? " is-expanded" : ""}"
          type="button"
          data-toggle-tags="true"
          aria-controls="tag-filter-row"
          aria-expanded="${state.tagFiltersExpanded}"
          aria-label="${state.tagFiltersExpanded ? "Hide tag filters" : "Show tag filters"}"
          title="${state.tagFiltersExpanded ? "Hide tag filters" : "Show tag filters"}"
        >
          <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
            <path
              fill="currentColor"
              d="M4.22 5.97a.75.75 0 0 1 1.06 0L8 8.69l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.03a.75.75 0 0 1 0-1.06Z"
            ></path>
          </svg>
        </button>
        <div class="column-toggle" role="group" aria-label="Choose gallery columns">
          ${[1, 2, 3]
            .map(
              (columns) => `
                <button
                  class="column-toggle__button${state.gridColumns === columns ? " is-active" : ""}"
                  type="button"
                  data-grid-columns="${columns}"
                  aria-label="Up to ${columns} ${columns === 1 ? "column" : "columns"}"
                  aria-pressed="${state.gridColumns === columns}"
                  title="Up to ${columns} ${columns === 1 ? "column" : "columns"}"
                >
                  <span
                    class="column-toggle__icon column-toggle__icon--${columns}"
                    aria-hidden="true"
                  >
                    ${Array.from({ length: columns }, () => '<span></span>').join("")}
                  </span>
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
      <div
        id="tag-filter-row"
        class="filter-row${state.tagFiltersExpanded ? "" : " is-collapsed"}"
        aria-label="Filter by tags"
      >
        ${renderTagFilterRow()}
      </div>
    </section>
  `;
}

function renderTagFilterRow() {
  const selectedTags = state.selectedTags.filter((tag) => getDistinctTags().includes(tag));
  const inactiveTags = getDistinctTags().filter((tag) => !selectedTags.includes(tag));
  const selectedOptions = selectedTags
    .map(
      (tag) => `
        <button
          class="filter-chip is-active"
          style="${getPastelTagStyle(tag)}"
          data-tag="${escapeHtml(tag)}"
          type="button"
        >
          ${escapeHtml(tag)}
        </button>
      `,
    )
    .join("");
  const inactiveOptions = inactiveTags.map((tag) => renderInactiveTagFilter(tag)).join("");

  return `
    ${selectedOptions}
    ${selectedOptions && inactiveOptions ? '<span class="filter-divider" aria-hidden="true"></span>' : ""}
    ${inactiveOptions}
  `;
}

function getDistinctTags() {
  return [
    ...new Set(
      catalog.specs.flatMap((item) => (Array.isArray(item.tags) ? item.tags : [])).filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
}

function renderInactiveTagFilter(tag) {
  return `
    <button
      class="filter-chip"
      data-tag="${escapeHtml(tag)}"
      type="button"
    >
      ${escapeHtml(tag)}
    </button>
  `;
}

function renderSpecList(specs) {
  if (specs.length === 0) {
    return `
      <section id="spec-list" class="spec-grid spec-grid--empty">
        <div class="empty-state">
          <h2>No visuals match the current filters.</h2>
          <p>Try a different search term or tag.</p>
        </div>
      </section>
    `;
  }

  const cards = specs
    .map(
      (item) => `
        <button
          class="spec-card"
          type="button"
          data-slug="${item.slug}"
        >
          <div class="spec-card__preview" data-card-preview="${item.slug}">
            <div class="spec-card__preview-frame"></div>
          </div>
          <div class="spec-card__header">
            <h2>${item.title}</h2>
            <span class="spec-card__category">${escapeHtml(item.category)}</span>
          </div>
          <p>${item.description}</p>
          <div class="meta-pill-row spec-card__meta" aria-label="Visual metadata">
            ${renderMetaPills(item)}
          </div>
        </button>
      `,
    )
    .join("");

  return `
    <section id="spec-list" class="spec-grid" aria-label="Visual gallery">
      ${cards}
    </section>
  `;
}

function renderSampleDataTable(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return `
      <div class="sample-table-empty">
        <p>No sample data available.</p>
      </div>
    `;
  }

  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];

  return `
    <div class="sample-table-wrap">
      <table class="sample-table">
        <thead>
          <tr>
            ${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  ${columns
                    .map((column) => {
                      const value = row[column];
                      const displayValue =
                        value === null || value === undefined ? "" : String(value);
                      return `<td>${escapeHtml(displayValue)}</td>`;
                    })
                    .join("")}
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderInputsTable(inputs) {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return `
      <div class="sample-table-empty">
        <p>No input fields documented.</p>
      </div>
    `;
  }

  return `
    <div class="sample-table-wrap">
      <table class="sample-table input-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${inputs
            .map(
              (input) => `
                <tr>
                  <td><code>${escapeHtml(String(input.name ?? ""))}</code></td>
                  <td><code>${escapeHtml(String(input.type ?? ""))}</code></td>
                  <td>${escapeHtml(String(input.description ?? ""))}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function getPastelTagStyle(label) {
  const hash = Array.from(label).reduce(
    (value, character) => value + character.charCodeAt(0),
    0,
  );
  const hue = hash % 360;
  return `--tag-bg: hsl(${hue} 78% 92%); --tag-text: hsl(${hue} 45% 28%); --tag-border: hsl(${hue} 62% 82%);`;
}

function renderMetaPills(spec) {
  const pills = [spec.language, ...(Array.isArray(spec.tags) ? spec.tags : [])];

  return pills
    .filter(Boolean)
    .map(
      (tag) => `
        <span class="meta-pill" style="${getPastelTagStyle(String(tag))}">
          ${escapeHtml(String(tag))}
        </span>
      `,
    )
    .join("");
}

function renderDetail(spec) {
  if (!spec) {
    return `
      <section class="detail-panel">
        <div class="empty-state">
          <h2>No visual selected.</h2>
        </div>
      </section>
    `;
  }

  return `
    <section class="detail-panel">
      <div class="detail-panel__header">
        <div class="detail-panel__intro">
          <div class="detail-panel__title-row">
            <h2>${spec.title}</h2>
            <div class="meta-pill-row" aria-label="Visual metadata">
              ${renderMetaPills(spec)}
            </div>
          </div>
          <p>${spec.description}</p>
        </div>
      </div>
      <div id="vega-preview" class="preview-shell">
        <div id="vega-preview-frame" class="preview-frame"></div>
      </div>
      <section id="inspector-panel" class="inspector-panel">
        ${renderInspector(spec, state.inspectorTab, "detail")}
      </section>
    </section>
  `;
}

function renderQuickPreviewOverlay(spec) {
  if (!spec) {
    return "";
  }

  return `
    <div
      class="quick-preview-backdrop"
      data-quick-preview-backdrop="true"
      role="presentation"
    >
      <section
        class="quick-preview-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-preview-title"
      >
        <div class="quick-preview-panel__header">
          <div class="quick-preview-panel__intro">
            <div class="quick-preview-panel__title-row">
              <h2 id="quick-preview-title">${spec.title}</h2>
              <div class="meta-pill-row" aria-label="Visual metadata">
                ${renderMetaPills(spec)}
              </div>
            </div>
            <p>${spec.description}</p>
          </div>
          <button
            class="quick-preview-panel__close"
            type="button"
            data-close-quick-preview="true"
            aria-label="Close quick preview"
            title="Close quick preview"
          >
            <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
              <path
                fill="currentColor"
                d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"
              ></path>
            </svg>
          </button>
        </div>
        <div id="quick-preview-vega" class="preview-shell quick-preview-panel__preview">
          <div id="quick-preview-vega-frame" class="preview-frame"></div>
        </div>
        <section id="quick-preview-inspector-panel" class="inspector-panel">
          ${renderInspector(spec, state.quickPreviewInspectorTab, "quick-preview")}
        </section>
      </section>
    </div>
  `;
}

function renderInspector(spec, selectedInspectorTab, scope) {
  const tabs = [
    { id: "spec", label: "Spec JSON" },
    { id: "inputs", label: "Inputs" },
    { id: "sample", label: "Sample Data" },
  ];
  const selectedTab = tabs.find((tab) => tab.id === selectedInspectorTab) ?? null;
  const tabContent = {
    spec: JSON.stringify(spec.spec, null, 2),
    sample: renderSampleDataTable(spec.sampleData),
    inputs: renderInputsTable(spec.inputs),
  };

  return `
    <div class="inspector-tabs" role="tablist" aria-label="Specification details">
      ${tabs
        .map(
          (tab) => `
            <button
              class="inspector-tab${selectedTab?.id === tab.id ? " is-active" : ""}"
              type="button"
              role="tab"
              aria-selected="${selectedTab?.id === tab.id}"
              data-inspector-tab="${tab.id}"
              data-inspector-scope="${scope}"
            >
              ${tab.label}
            </button>
          `,
        )
        .join("")}
    </div>
    ${
      selectedTab
        ? `
          <div class="inspector-content">
            ${
              selectedTab.id === "spec"
                ? `
                  <button
                    class="copy-button copy-button--overlay"
                    type="button"
                    data-copy-spec="true"
                    data-copy-scope="${scope}"
                    aria-label="Copy spec JSON to clipboard"
                    title="Copy spec JSON"
                  >
                    <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M3 2.75A1.75 1.75 0 0 1 4.75 1h5.5A1.75 1.75 0 0 1 12 2.75V4h.25A1.75 1.75 0 0 1 14 5.75v7.5A1.75 1.75 0 0 1 12.25 15h-5.5A1.75 1.75 0 0 1 5 13.25V12H4.75A1.75 1.75 0 0 1 3 10.25Zm2 8.5v-5.5A1.75 1.75 0 0 1 6.75 4H10.5V2.75a.25.25 0 0 0-.25-.25h-5.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25Zm1.5-5.5v7.5c0 .138.112.25.25.25h5.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25h-5.5a.25.25 0 0 0-.25.25Z"
                      ></path>
                    </svg>
                  </button>
                `
                : ""
            }
            ${
              selectedTab.id === "sample"
                ? tabContent.sample
                : selectedTab.id === "inputs"
                  ? tabContent.inputs
                : `<pre>${escapeHtml(tabContent[selectedTab.id])}</pre>`
            }
          </div>
        `
        : ""
    }
  `;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getShell() {
  return {
    filters: document.querySelector("#filters-slot"),
    list: document.querySelector("#spec-list-slot"),
    detail: document.querySelector("#detail-slot"),
    quickPreview: document.querySelector("#quick-preview-slot"),
  };
}

function updateGridColumnsStyle() {
  const specListSlot = document.querySelector("#spec-list-slot");
  if (!specListSlot) {
    return;
  }

  specListSlot.style.setProperty("--grid-columns", getEffectiveGridColumns());
}

function getSelectedSpecFromView() {
  const specs = getSpecs();
  return getSelectedSpec(specs);
}

function getQuickPreviewSpec() {
  if (!state.quickPreviewSlug) {
    return null;
  }

  return catalog.specs.find((item) => item.slug === state.quickPreviewSlug) ?? null;
}

function renderInspectorPanel(selectedSpec) {
  const inspectorPanel = document.querySelector("#inspector-panel");
  if (!inspectorPanel || !selectedSpec) {
    return;
  }

  inspectorPanel.innerHTML = renderInspector(selectedSpec, state.inspectorTab, "detail");
}

function renderQuickPreviewInspectorPanel(selectedSpec) {
  const inspectorPanel = document.querySelector("#quick-preview-inspector-panel");
  if (!inspectorPanel || !selectedSpec) {
    return;
  }

  inspectorPanel.innerHTML = renderInspector(
    selectedSpec,
    state.quickPreviewInspectorTab,
    "quick-preview",
  );
}

async function renderPreviewInto(selectedSpec, previewShell, previewFrame, options = {}) {
  if (!previewShell || !previewFrame || !selectedSpec) {
    return;
  }

  const previewSpec = withDataset(
    withPreviewDimensions(selectedSpec.spec, previewShell, options),
    selectedSpec.sampleData,
    selectedSpec.language,
  );

  await embed(previewFrame, previewSpec, {
    actions: false,
    mode: selectedSpec.language === "vega-lite" ? "vega-lite" : "vega",
    renderer: options.renderer ?? "svg",
  });
}

async function renderPreview(selectedSpec, previewSelector = "#vega-preview", frameSelector = "#vega-preview-frame", options = {}) {
  await renderPreviewInto(
    selectedSpec,
    document.querySelector(previewSelector),
    document.querySelector(frameSelector),
    options,
  );
}

async function renderCardPreviews({ force = false } = {}) {
  const previewNodes = [...document.querySelectorAll("[data-card-preview]")];

  await Promise.all(
    previewNodes.map(async (previewNode) => {
      if (!force && previewNode.dataset.previewRendered === "true") {
        return;
      }

      const selectedSpec = catalog.specs.find((item) => item.slug === previewNode.dataset.cardPreview);
      const previewFrame = previewNode.querySelector(".spec-card__preview-frame");

      previewNode.dataset.previewRendered = "true";
      await renderPreviewInto(selectedSpec, previewNode, previewFrame, {
        fit: true,
        minHeight: 140,
        minWidth: 180,
        widthOffset: 12,
        heightOffset: 16,
      });
    }),
  );
}

async function renderQuickPreview() {
  const quickPreviewSlot = document.querySelector("#quick-preview-slot");
  const selectedSpec = getQuickPreviewSpec();

  if (!quickPreviewSlot) {
    return;
  }

  const hasQuickPreview = Boolean(selectedSpec);
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  document.body.classList.toggle("has-quick-preview", hasQuickPreview);
  document.body.style.setProperty(
    "--scrollbar-compensation",
    hasQuickPreview ? `${Math.max(0, scrollbarWidth)}px` : "0px",
  );

  if (!selectedSpec) {
    quickPreviewSlot.innerHTML = "";
    viewState.quickPreviewSlug = null;
    return;
  }

  const selectedChanged = viewState.quickPreviewSlug !== selectedSpec.slug;

  if (selectedChanged || !quickPreviewSlot.innerHTML.trim()) {
    quickPreviewSlot.innerHTML = renderQuickPreviewOverlay(selectedSpec);
    viewState.quickPreviewSlug = selectedSpec.slug;
    await renderPreview(selectedSpec, "#quick-preview-vega", "#quick-preview-vega-frame");
  }
}

function renderStarDigits(value) {
  return String(value ?? 0)
    .split("")
    .map((digit) => `<span class="repo-widget__stars-digit">${escapeHtml(digit)}</span>`)
    .join("");
}

function renderRepoWidget() {
  return `
    <a
      class="repo-widget"
      href="${repo.url}"
      target="_blank"
      rel="noreferrer"
      aria-label="Open ${repo.fullName} on GitHub"
    >
      <span class="repo-widget__icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" focusable="false">
          <path
            fill="currentColor"
            d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38
            0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
            -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
            .07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
            -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.63 7.63 0 0 1 4 0c1.53-1.04
            2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07
            -1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15
            .46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
          ></path>
        </svg>
      </span>
      <span class="repo-widget__body">
        <strong>${repo.name}</strong>
      </span>
      <span class="repo-widget__stars" aria-label="GitHub stars for ${repo.fullName}">
        <svg viewBox="0 0 16 16" focusable="false" aria-hidden="true">
          <path
            fill="currentColor"
            d="M8 .75 10.22 5.25l4.96.72-3.59 3.5.85 4.94L8 12.08l-4.44 2.33.85-4.94-3.59-3.5 4.96-.72L8 .75Z"
          ></path>
        </svg>
        <span class="repo-widget__stars-count" aria-hidden="true">${renderStarDigits(repo.stars)}</span>
      </span>
    </a>
  `;
}

function updateRepoStars(stars) {
  repo.stars = stars;
  const counter = document.querySelector(".repo-widget__stars-count");
  if (counter) {
    counter.innerHTML = renderStarDigits(repo.stars);
  }
}

async function loadRepoStars() {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo.fullName}`, {
      headers: { Accept: "application/vnd.github+json" },
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    if (Number.isFinite(data.stargazers_count)) {
      updateRepoStars(data.stargazers_count);
    }
  } catch {
    // Keep the fallback counter if GitHub cannot be reached.
  }
}

function mountApp() {
  const root = document.querySelector("#app");
  root.innerHTML = `
    <div class="page-shell">
      <header class="site-header">
        <div class="site-header__copy">
          <h1>NHS Vega Library</h1>
          <p>Shared Vega visuals for BI teams across trusts.</p>
        </div>
        <div class="site-header__aside">
          ${renderRepoWidget()}
        </div>
      </header>
      <div id="filters-slot">${renderFilters()}</div>
      <main class="content-grid">
        <div id="spec-list-slot"></div>
      </main>
      <div id="quick-preview-slot"></div>
    </div>
  `;

  attachEvents(root);
}

function updateFiltersUI() {
  const searchInput = document.querySelector("#search-input");
  if (searchInput && searchInput.value !== state.query) {
    searchInput.value = state.query;
  }

  const filterRow = document.querySelector(".filter-row");
  if (filterRow) {
    filterRow.innerHTML = renderTagFilterRow();
    filterRow.classList.toggle("is-collapsed", !state.tagFiltersExpanded);
  }

  const filterToggle = document.querySelector("[data-toggle-tags]");
  if (filterToggle) {
    filterToggle.classList.toggle("is-expanded", state.tagFiltersExpanded);
    filterToggle.setAttribute("aria-expanded", String(state.tagFiltersExpanded));
    filterToggle.setAttribute(
      "aria-label",
      state.tagFiltersExpanded ? "Hide tag filters" : "Show tag filters",
    );
    filterToggle.setAttribute(
      "title",
      state.tagFiltersExpanded ? "Hide tag filters" : "Show tag filters",
    );
  }

  const columnButtons = document.querySelectorAll("[data-grid-columns]");
  columnButtons.forEach((button) => {
    const isActive = Number(button.dataset.gridColumns) === state.gridColumns;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function attachEvents(root) {
  root.addEventListener("input", (event) => {
    if (event.target.id !== "search-input") {
      return;
    }

    state.query = event.target.value;
    updateView();
  });

  root.addEventListener("click", async (event) => {
    const closeQuickPreviewButton = event.target.closest("[data-close-quick-preview]");
    if (closeQuickPreviewButton) {
      state.slug = null;
      state.quickPreviewSlug = null;
      state.quickPreviewInspectorTab = null;
      updateHash(null);
      await renderQuickPreview();
      return;
    }

    const quickPreviewBackdrop = event.target.closest("[data-quick-preview-backdrop]");
    if (quickPreviewBackdrop && event.target === quickPreviewBackdrop) {
      state.slug = null;
      state.quickPreviewSlug = null;
      state.quickPreviewInspectorTab = null;
      updateHash(null);
      await renderQuickPreview();
      return;
    }

    const tagToggle = event.target.closest("[data-toggle-tags]");
    if (tagToggle) {
      state.tagFiltersExpanded = !state.tagFiltersExpanded;
      updateView();
      return;
    }

    const specListToggle = event.target.closest("[data-toggle-spec-list]");
    if (specListToggle) {
      state.specListExpanded = !state.specListExpanded;
      updateView();
      return;
    }

    const tagButton = event.target.closest("[data-tag]");
    if (tagButton) {
      const tag = tagButton.dataset.tag;
      state.selectedTags = state.selectedTags.includes(tag)
        ? state.selectedTags.filter((selectedTag) => selectedTag !== tag)
        : [...state.selectedTags, tag];
      updateView();
      return;
    }

    const specButton = event.target.closest("[data-slug]");
    if (specButton) {
      state.slug = specButton.dataset.slug;
      state.quickPreviewSlug = specButton.dataset.slug;
      state.quickPreviewInspectorTab = null;
      updateHash(state.quickPreviewSlug);
      await renderQuickPreview();
      return;
    }

    const gridColumnsButton = event.target.closest("[data-grid-columns]");
    if (gridColumnsButton) {
      state.gridColumns = Number(gridColumnsButton.dataset.gridColumns);
      updateView();
      return;
    }

    const inspectorButton = event.target.closest("[data-inspector-tab]");
    if (inspectorButton) {
      const tab = inspectorButton.dataset.inspectorTab;
      const scope = inspectorButton.dataset.inspectorScope;

      if (scope === "quick-preview") {
        state.quickPreviewInspectorTab = state.quickPreviewInspectorTab === tab ? null : tab;
        renderQuickPreviewInspectorPanel(getQuickPreviewSpec());
        return;
      }

      state.inspectorTab = state.inspectorTab === tab ? null : tab;
      renderInspectorPanel(getSelectedSpecFromView());
      return;
    }

    const copyButton = event.target.closest("[data-copy-spec='true']");
    if (copyButton) {
      const selectedSpec =
        copyButton.dataset.copyScope === "quick-preview"
          ? getQuickPreviewSpec()
          : getSelectedSpecFromView();
      if (selectedSpec) {
        await navigator.clipboard.writeText(JSON.stringify(selectedSpec.spec, null, 2));
      }
    }
  });
}

async function updateView() {
  const shell = getShell();
  const specs = getSpecs();

  if (shell.filters) {
    updateFiltersUI();
  }

  if (shell.list) {
    shell.list.innerHTML = renderSpecList(specs);
    updateGridColumnsStyle();
    await renderCardPreviews();
  }

  await renderQuickPreview();
}

async function rerenderPreview() {
  updateGridColumnsStyle();
  await renderCardPreviews({ force: true });
  if (getQuickPreviewSpec()) {
    await renderPreview(getQuickPreviewSpec(), "#quick-preview-vega", "#quick-preview-vega-frame");
  }
}

window.addEventListener("popstate", async () => {
  readHashSlug();
  state.quickPreviewInspectorTab = null;
  await renderQuickPreview();
});

window.addEventListener("keydown", async (event) => {
  if (event.key !== "Escape" || !state.quickPreviewSlug) {
    return;
  }

  state.slug = null;
  state.quickPreviewSlug = null;
  state.quickPreviewInspectorTab = null;
  updateHash(null);
  await renderQuickPreview();
});

window.addEventListener("resize", () => {
  if (resizeFrame) {
    window.cancelAnimationFrame(resizeFrame);
  }

  resizeFrame = window.requestAnimationFrame(async () => {
    resizeFrame = null;
    await rerenderPreview();
  });
});

readHashSlug();
mountApp();
loadRepoStars();
updateView();
