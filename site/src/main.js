import embed from "vega-embed";
import catalog from "./generated/catalog.json";
import "./styles.css";

const state = {
  category: "All",
  query: "",
  slug: null,
  inspectorTab: null,
};

let resizeFrame = null;
const repo = {
  name: "vega-library",
  fullName: "paddy-devan/vega-library",
  url: "https://github.com/paddy-devan/vega-library",
  starsBadge:
    "https://img.shields.io/github/stars/paddy-devan/vega-library?style=flat&label=&color=171717",
};

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function withDataset(spec, sampleData) {
  const nextSpec = cloneJson(spec);
  const dataset = nextSpec.data.find((entry) => entry && entry.name === "dataset");
  dataset.values = sampleData;
  return nextSpec;
}

function withPreviewDimensions(spec, previewNode) {
  const nextSpec = cloneJson(spec);
  const styles = window.getComputedStyle(previewNode);
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
  const innerWidth =
    previewNode.clientWidth - paddingLeft - paddingRight ||
    previewNode.parentElement?.clientWidth ||
    0;

  // Keep the preview usable for wider gantt-style charts even on narrow layouts.
  nextSpec.width = Math.max(760, innerWidth);
  nextSpec.height = 560;

  return nextSpec;
}

function getSpecs() {
  const query = state.query.trim().toLowerCase();

  return catalog.specs.filter((item) => {
    const categoryMatches = state.category === "All" || item.category === state.category;
    const text = `${item.title} ${item.description} ${item.tags.join(" ")}`.toLowerCase();
    const queryMatches = query.length === 0 || text.includes(query);
    return categoryMatches && queryMatches;
  });
}

function findSelectedSpec(specs) {
  if (state.slug) {
    return specs.find((item) => item.slug === state.slug) ?? null;
  }

  return specs[0] ?? null;
}

function readHashSlug() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  state.slug = hash || null;
}

function updateHash(slug) {
  if (!slug) {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    return;
  }

  window.location.hash = slug;
}

function renderFilters() {
  const options = ["All", ...catalog.categories]
    .map(
      (category) => `
        <button
          class="filter-chip${category === state.category ? " is-active" : ""}"
          data-category="${category}"
          type="button"
        >
          ${category}
        </button>
      `,
    )
    .join("");

  return `
    <section class="filters-panel">
      <label class="search-field">
        <input
          id="search-input"
          type="search"
          placeholder="Search visuals"
          value="${escapeHtml(state.query)}"
        />
      </label>
      <div class="filter-row">
        ${options}
      </div>
    </section>
  `;
}

function renderSpecList(specs, selectedSpec) {
  if (specs.length === 0) {
    return `
      <section class="spec-list">
        <div class="empty-state">
          <h2>No visuals match the current filters.</h2>
          <p>Try a different search term or category.</p>
        </div>
      </section>
    `;
  }

  const cards = specs
    .map(
      (item) => `
        <button
          class="spec-card${selectedSpec?.slug === item.slug ? " is-selected" : ""}"
          type="button"
          data-slug="${item.slug}"
        >
          <div class="spec-card__header">
            <h2>${item.title}</h2>
            <span class="spec-card__meta">${item.category}</span>
          </div>
          <p>${item.description}</p>
        </button>
      `,
    )
    .join("");

  return `<section class="spec-list">${cards}</section>`;
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

  const sampleData = JSON.stringify(spec.sampleData, null, 2);
  const vegaSpec = JSON.stringify(spec.spec, null, 2);
  const metadata = JSON.stringify({
    title: spec.title,
    slug: spec.slug,
    category: spec.category,
    description: spec.description,
    tags: spec.tags,
  }, null, 2);
  const tabs = [
    { id: "spec", label: "Spec JSON" },
    { id: "sample", label: "Sample Data" },
    { id: "meta", label: "Metadata" },
  ];
  const selectedTab = tabs.find((tab) => tab.id === state.inspectorTab) ?? null;
  const tabContent = {
    spec: vegaSpec,
    sample: renderSampleDataTable(spec.sampleData),
    meta: metadata,
  };

  return `
    <section class="detail-panel">
      <div class="detail-panel__header">
        <div>
          <div class="eyebrow">${spec.category}</div>
          <h2>${spec.title}</h2>
          <p>${spec.description}</p>
        </div>
      </div>
      <div id="vega-preview" class="preview-shell">
        <div id="vega-preview-frame" class="preview-frame"></div>
      </div>
      <section id="inspector-panel" class="inspector-panel">
        ${renderInspector(spec)}
      </section>
    </section>
  `;
}

function renderInspector(spec) {
  const sampleData = JSON.stringify(spec.sampleData, null, 2);
  const vegaSpec = JSON.stringify(spec.spec, null, 2);
  const metadata = JSON.stringify({
    title: spec.title,
    slug: spec.slug,
    category: spec.category,
    description: spec.description,
    tags: spec.tags,
  }, null, 2);
  const tabs = [
    { id: "spec", label: "Spec JSON" },
    { id: "sample", label: "Sample Data" },
    { id: "meta", label: "Metadata" },
  ];
  const selectedTab = tabs.find((tab) => tab.id === state.inspectorTab) ?? null;
  const tabContent = {
    spec: vegaSpec,
    sample: renderSampleDataTable(spec.sampleData),
    meta: metadata,
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
    .replaceAll(">", "&gt;");
}

function attachEvents(root, selectedSpec) {
  root.querySelector("#search-input")?.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  root.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      render();
    });
  });

  root.querySelectorAll("[data-slug]").forEach((button) => {
    button.addEventListener("click", () => {
      state.slug = button.dataset.slug;
      updateHash(state.slug);
      render();
    });
  });

  root.querySelectorAll("[data-inspector-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.inspectorTab =
        state.inspectorTab === button.dataset.inspectorTab ? null : button.dataset.inspectorTab;
      renderInspectorPanel(selectedSpec);
    });
  });

  root.querySelector("[data-copy-spec='true']")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(JSON.stringify(selectedSpec.spec, null, 2));
  });
}

function attachInspectorEvents(root, selectedSpec) {
  root.querySelectorAll("[data-inspector-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.inspectorTab =
        state.inspectorTab === button.dataset.inspectorTab ? null : button.dataset.inspectorTab;
      renderInspectorPanel(selectedSpec);
    });
  });

  root.querySelector("[data-copy-spec='true']")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(JSON.stringify(selectedSpec.spec, null, 2));
  });
}

function renderInspectorPanel(selectedSpec) {
  const inspectorPanel = document.querySelector("#inspector-panel");
  if (!inspectorPanel || !selectedSpec) {
    return;
  }

  inspectorPanel.innerHTML = renderInspector(selectedSpec);
  attachInspectorEvents(inspectorPanel, selectedSpec);
}

async function renderPreview(selectedSpec) {
  const previewShell = document.querySelector("#vega-preview");
  const previewFrame = document.querySelector("#vega-preview-frame");

  if (!previewShell || !previewFrame || !selectedSpec) {
    return;
  }

  const previewSpec = withPreviewDimensions(
    withDataset(selectedSpec.spec, selectedSpec.sampleData),
    previewShell,
  );

  await embed(previewFrame, previewSpec, {
    actions: false,
    renderer: "svg",
  });
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
      <img
        class="repo-widget__stars"
        src="${repo.starsBadge}"
        alt="GitHub stars for ${repo.fullName}"
      />
    </a>
  `;
}

async function render() {
  const root = document.querySelector("#app");
  const specs = getSpecs();
  const selectedSpec = findSelectedSpec(specs) ?? findSelectedSpec(catalog.specs);

  root.innerHTML = `
    <div class="page-shell">
      <header class="site-header">
        <div class="site-header__copy">
          <h1>Vega Library</h1>
          <p>Shared Vega visuals for BI teams across trusts.</p>
        </div>
        <div class="site-header__aside">
          ${renderRepoWidget()}
        </div>
      </header>
      ${renderFilters()}
      <main class="content-grid">
        ${renderSpecList(specs, selectedSpec)}
        ${renderDetail(selectedSpec)}
      </main>
    </div>
  `;

  attachEvents(root, selectedSpec);
  await renderPreview(selectedSpec);
}

window.addEventListener("hashchange", () => {
  readHashSlug();
  render();
});

window.addEventListener("resize", () => {
  if (resizeFrame) {
    window.cancelAnimationFrame(resizeFrame);
  }

  resizeFrame = window.requestAnimationFrame(() => {
    resizeFrame = null;
    render();
  });
});

readHashSlug();
render();
