import embed from "vega-embed";
import catalog from "./generated/catalog.json";
import "./styles.css";

const state = {
  category: "All",
  query: "",
  slug: null,
};

let resizeFrame = null;

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

  return `
    <section class="detail-panel">
      <div class="detail-panel__header">
        <div>
          <div class="eyebrow">${spec.category}</div>
          <h2>${spec.title}</h2>
          <p>${spec.description}</p>
        </div>
        <div class="detail-stats">
          <div>
            <span>Slug</span>
            <strong>${spec.slug}</strong>
          </div>
          <div>
            <span>Rows</span>
            <strong>${spec.sampleSize}</strong>
          </div>
        </div>
      </div>
      <div id="vega-preview" class="preview-shell">
        <div id="vega-preview-frame" class="preview-frame"></div>
      </div>
      <div class="inspect-sections">
        <details class="inspect-section">
          <summary>Show metadata</summary>
          <pre>${escapeHtml(JSON.stringify({
            title: spec.title,
            slug: spec.slug,
            category: spec.category,
            description: spec.description,
            tags: spec.tags,
          }, null, 2))}</pre>
        </details>
        <details class="inspect-section">
          <summary>Show sample data</summary>
          <pre>${escapeHtml(sampleData)}</pre>
        </details>
        <details class="inspect-section">
          <summary>Show spec JSON</summary>
          <pre>${escapeHtml(vegaSpec)}</pre>
        </details>
      </div>
    </section>
  `;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function attachEvents(root) {
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
        <div class="site-header__stats" aria-label="Library stats">
          <span>${catalog.specs.length} visuals</span>
          <span>${catalog.categories.length} categories</span>
          <span>Built ${new Date(catalog.generatedAt).toLocaleDateString()}</span>
        </div>
      </header>
      ${renderFilters()}
      <main class="content-grid">
        ${renderSpecList(specs, selectedSpec)}
        ${renderDetail(selectedSpec)}
      </main>
    </div>
  `;

  attachEvents(root);
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
