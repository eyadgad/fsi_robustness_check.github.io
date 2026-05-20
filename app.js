const DATA_DIR = "assets/grid_validation_20260520_114434";
const FILES = {
  ranked: `${DATA_DIR}/grid_validation_ranked_report.csv`,
  all: `${DATA_DIR}/grid_validation_results_all.csv`,
  benchmark: `${DATA_DIR}/validation_results_by_benchmark.csv`,
  manifest: `${DATA_DIR}/generated_fsi_versions_manifest.csv`,
};

const state = {
  ranked: [],
  benchmark: [],
  manifest: [],
  view: "ranked",
  filters: {
    search: "",
    fromYears: [],
    toYears: [],
    windowSizes: [],
    sentimentModels: [],
    methods: [],
    mValues: [],
  },
};

const elements = {
  loadStatus: document.querySelector("#loadStatus"),
  summaryFsi: document.querySelector("#summaryFsi"),
  summaryBenchmarks: document.querySelector("#summaryBenchmarks"),
  summaryScore: document.querySelector("#summaryScore"),
  summaryBestId: document.querySelector("#summaryBestId"),
  rankedTable: document.querySelector("#rankedTable"),
  benchmarkTable: document.querySelector("#benchmarkTable"),
  rankedCount: document.querySelector("#rankedCount"),
  benchmarkCount: document.querySelector("#benchmarkCount"),
  reportGrid: document.querySelector("#reportGrid"),
  searchInput: document.querySelector("#searchInput"),
  fromYearFilter: document.querySelector("#fromYearFilter"),
  toYearFilter: document.querySelector("#toYearFilter"),
  windowFilter: document.querySelector("#windowFilter"),
  sentimentFilter: document.querySelector("#sentimentFilter"),
  methodFilter: document.querySelector("#methodFilter"),
  mFilter: document.querySelector("#mFilter"),
  resetFilters: document.querySelector("#resetFilters"),
  downloadRanked: document.querySelector("#downloadRanked"),
  downloadBenchmarks: document.querySelector("#downloadBenchmarks"),
};

const numberColumns = new Set([
  "rank",
  "rank_score",
  "mean_abs_r",
  "mean_signed_r",
  "mean_dir_acc",
  "window_size",
  "daily_window",
  "ewm_halflife",
  "min_matches",
  "n_tweets_loaded",
  "n_tweets_variant",
  "n_daily_fsi",
  "n_monthly_fsi",
  "n_monthly",
  "n_daily",
  "pearson_r",
  "spearman_rho",
  "rmse",
  "mae",
  "dir_acc",
  "epu_pearson_r",
  "cfsi_pearson_r",
  "vixc_pearson_r",
  "optimal_lag",
  "optimal_lag_r",
]);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const headers = rows.shift() || [];
  return rows.map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      const raw = values[index] ?? "";
      if (raw === "" || raw === "NaN") {
        record[header] = "";
      } else if (numberColumns.has(header)) {
        const parsed = Number(raw);
        record[header] = Number.isFinite(parsed) ? parsed : raw;
      } else {
        record[header] = raw;
      }
    });
    return record;
  });
}

async function loadCsv(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url}`);
  }
  return parseCsv(await response.text());
}

function uniqueSorted(rows, key, numeric = false) {
  const values = [...new Set(rows.map((row) => row[key]).filter((value) => value !== "" && value != null))];
  return values.sort((a, b) => (numeric ? Number(a) - Number(b) : String(a).localeCompare(String(b))));
}

function sentimentParts(row) {
  return String(row.sentiment_set || "")
    .split("+")
    .map((value) => value.trim())
    .filter(Boolean);
}

function uniqueSentimentModels(rows) {
  const preferred = ["lm", "finbert19", "finbert20", "finvader"];
  const found = new Set(rows.flatMap(sentimentParts));
  return preferred.filter((value) => found.has(value));
}

function variantKey(row) {
  const method = String(row.filtering_type || "").trim();
  const mValue = String(row.min_matches || "").trim();
  if (method && mValue) return `${method}_m${mValue}`;
  return String(row.variant || "").trim();
}

function methodValue(row) {
  const explicit = String(row.filtering_type || "").trim();
  if (explicit) return explicit;
  const match = variantKey(row).match(/^(regex|similarity)_m\d+$/i);
  return match ? match[1].toLowerCase() : "";
}

function mValue(row) {
  const explicit = String(row.min_matches || "").trim();
  if (explicit) return explicit;
  const match = variantKey(row).match(/_m(\d+)$/i);
  return match ? match[1] : "";
}

function uniqueMethods(rows) {
  const preferred = ["regex", "similarity"];
  const found = new Set(rows.map(methodValue).filter(Boolean));
  return preferred.filter((value) => found.has(value));
}

function uniqueMValues(rows) {
  const values = rows.map(mValue).filter(Boolean);
  return [...new Set(values)].sort((a, b) => Number(a) - Number(b));
}

function yearFromDate(value) {
  return String(value || "").slice(0, 4);
}

function fromYear(row) {
  return yearFromDate(row.since_date);
}

function toYear(row) {
  return yearFromDate(row.until_date);
}

function uniqueYears(rows, key) {
  const values = rows.map((row) => yearFromDate(row[key])).filter(Boolean);
  return [...new Set(values)].sort((a, b) => Number(a) - Number(b));
}

function renderCheckboxGroup(container, values, name) {
  if (!container) return;
  container.innerHTML = "";
  values.forEach((value) => {
    const id = `${name}-${String(value).replace(/[^a-z0-9]+/gi, "-")}`;
    const label = document.createElement("label");
    label.className = "checkbox-option";
    label.htmlFor = id;
    label.innerHTML = `
      <input id="${escapeHtml(id)}" type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(value)}">
      <span>${escapeHtml(value)}</span>
    `;
    container.appendChild(label);
  });
}

function selectedCheckboxValues(container) {
  if (!container) return [];
  return [...container.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
}

function formatNumber(value, digits = 4) {
  if (value === "" || value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toFixed(digits);
}

function formatInteger(value) {
  if (value === "" || value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function matchesFilters(row) {
  const search = state.filters.search.toLowerCase();
  if (search) {
    const haystack = [
      row.fsi_id,
      row.sentiment_set,
      variantKey(row),
      row.short,
      methodValue(row),
      mValue(row),
      row.benchmark_index,
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  if (state.filters.fromYears.length && !state.filters.fromYears.includes(fromYear(row))) return false;
  if (state.filters.toYears.length && !state.filters.toYears.includes(toYear(row))) return false;
  if (state.filters.windowSizes.length && !state.filters.windowSizes.includes(String(row.window_size))) return false;
  if (state.filters.methods.length && !state.filters.methods.includes(methodValue(row))) return false;
  if (state.filters.mValues.length && !state.filters.mValues.includes(mValue(row))) return false;

  if (state.filters.sentimentModels.length) {
    const rowModels = sentimentParts(row);
    if (!state.filters.sentimentModels.every((model) => rowModels.includes(model))) return false;
  }

  return true;
}

function filteredRankedRows() {
  return state.ranked.filter((row) => matchesFilters(row));
}

function benchmarkSortValue(row) {
  const order = {
    epu_monthly: 1,
    cfsi_monthly: 2,
    vixc_daily: 3,
  };
  return order[row.benchmark_index] || 99;
}

function benchmarkRowsByFsi() {
  const groups = new Map();
  state.benchmark.forEach((row) => {
    if (!groups.has(row.fsi_id)) groups.set(row.fsi_id, []);
    groups.get(row.fsi_id).push(row);
  });

  groups.forEach((rows) => {
    rows.sort((a, b) => benchmarkSortValue(a) - benchmarkSortValue(b));
  });

  return groups;
}

function renderSummary() {
  const best = state.ranked[0] || {};
  elements.summaryFsi.textContent = formatInteger(state.manifest.length || state.ranked.length);
  elements.summaryBenchmarks.textContent = formatInteger(state.benchmark.length);
  elements.summaryScore.textContent = formatNumber(best.rank_score);
  elements.summaryBestId.textContent = best.fsi_id || "-";
}

function renderRankedTable() {
  const rows = filteredRankedRows();
  elements.rankedCount.textContent = `${rows.length.toLocaleString()} matching FSI versions`;
  const visible = rows.slice(0, 250);

  if (!visible.length) {
    elements.rankedTable.innerHTML = `<tr><td class="empty" colspan="12">No ranked FSI versions match the current filters.</td></tr>`;
    return;
  }

  elements.rankedTable.innerHTML = visible
    .map((row) => `
      <tr>
        <td>${formatInteger(row.rank)}</td>
        <td><span class="mono">${escapeHtml(row.fsi_id)}</span></td>
        <td>${formatNumber(row.rank_score)}</td>
        <td>${escapeHtml(row.sentiment_set)}</td>
        <td><span class="pill">${escapeHtml(methodValue(row))}</span></td>
        <td>${escapeHtml(mValue(row))}</td>
        <td>${escapeHtml(fromYear(row))}</td>
        <td>${escapeHtml(toYear(row))}</td>
        <td>${escapeHtml(row.window_size)}</td>
        <td>${formatNumber(row.epu_pearson_r)}</td>
        <td>${formatNumber(row.cfsi_pearson_r)}</td>
        <td>${formatNumber(row.vixc_pearson_r)}</td>
      </tr>
    `)
    .join("");
}

function renderBenchmarkTable() {
  const rankedRows = filteredRankedRows();
  const groupedBenchmarkRows = benchmarkRowsByFsi();
  const groups = rankedRows
    .map((rankedRow) => ({
      rankedRow,
      benchmarkRows: groupedBenchmarkRows.get(rankedRow.fsi_id) || [],
    }))
    .filter((group) => group.benchmarkRows.length);
  const benchmarkRowCount = groups.reduce((total, group) => total + group.benchmarkRows.length, 0);
  elements.benchmarkCount.textContent =
    `${groups.length.toLocaleString()} matching FSI versions, ${benchmarkRowCount.toLocaleString()} benchmark rows`;
  const visible = groups.slice(0, 120);

  if (!visible.length) {
    elements.benchmarkTable.innerHTML = `<tr><td class="empty" colspan="14">No benchmark validation rows match the current filters.</td></tr>`;
    return;
  }

  elements.benchmarkTable.innerHTML = visible
    .map((group) => {
      const rowspan = group.benchmarkRows.length;
      return group.benchmarkRows
        .map((row, index) => `
          <tr class="${index === 0 ? "benchmark-group-start" : ""}">
            ${index === 0 ? `
              <td rowspan="${rowspan}" class="rowspan-cell">${formatInteger(group.rankedRow.rank)}</td>
              <td rowspan="${rowspan}" class="rowspan-cell"><span class="mono">${escapeHtml(group.rankedRow.fsi_id)}</span></td>
              <td rowspan="${rowspan}" class="rowspan-cell">${escapeHtml(group.rankedRow.sentiment_set)}</td>
              <td rowspan="${rowspan}" class="rowspan-cell"><span class="pill">${escapeHtml(methodValue(group.rankedRow))}</span></td>
              <td rowspan="${rowspan}" class="rowspan-cell">${escapeHtml(mValue(group.rankedRow))}</td>
              <td rowspan="${rowspan}" class="rowspan-cell">${escapeHtml(fromYear(group.rankedRow))}</td>
              <td rowspan="${rowspan}" class="rowspan-cell">${escapeHtml(toYear(group.rankedRow))}</td>
              <td rowspan="${rowspan}" class="rowspan-cell">${escapeHtml(group.rankedRow.window_size)}</td>
            ` : ""}
            <td class="benchmark-name">${escapeHtml(row.benchmark_index)}</td>
            <td>${formatNumber(row.pearson_r)}</td>
            <td>${formatNumber(row.spearman_rho)}</td>
            <td>${formatNumber(row.rmse)}</td>
            <td>${escapeHtml(row.optimal_lag_dir || "-")} ${row.optimal_lag !== "" ? `(${row.optimal_lag})` : ""}</td>
            <td class="note-cell">${escapeHtml(row.notes || row.alignment_notes || "")}</td>
          </tr>
        `)
        .join("");
    })
    .join("");
}

function renderReports() {
  const reports = [
    {
      title: "Ranked Report",
      file: "grid_validation_ranked_report.csv",
      rows: state.ranked.length,
      description: "Compact ranking table with the core metrics and parameter columns.",
    },
    {
      title: "All Validation Results",
      file: "grid_validation_results_all.csv",
      rows: state.ranked.length,
      description: "Wide validation table for every generated FSI version.",
    },
    {
      title: "Benchmark Validation",
      file: "validation_results_by_benchmark.csv",
      rows: state.benchmark.length,
      description: "Long table with one row per FSI version and benchmark index.",
    },
    {
      title: "FSI Manifest",
      file: "generated_fsi_versions_manifest.csv",
      rows: state.manifest.length,
      description: "Generated FSI IDs, parameter values, and preprocessing notes.",
    },
    {
      title: "Reused FSI Pickle Note",
      file: "reused_fsi_pickle.txt",
      rows: "",
      description: "Reference to the FSI pickle that was reused for this validation run.",
    },
  ];

  elements.reportGrid.innerHTML = reports
    .map((report) => `
      <article class="report-card">
        <h3>${escapeHtml(report.title)}</h3>
        <p>${escapeHtml(report.description)}</p>
        ${report.rows === "" ? "" : `<p><strong>${formatInteger(report.rows)}</strong> rows</p>`}
        <a href="${DATA_DIR}/${report.file}" download>Download ${escapeHtml(report.file)}</a>
      </article>
    `)
    .join("");
}

function renderCurrentView() {
  renderRankedTable();
  renderBenchmarkTable();
}

function populateFilters() {
  const combined = [...state.ranked, ...state.benchmark];
  renderCheckboxGroup(elements.fromYearFilter, uniqueYears(combined, "since_date"), "from-year");
  renderCheckboxGroup(elements.toYearFilter, uniqueYears(combined, "until_date"), "to-year");
  renderCheckboxGroup(elements.windowFilter, uniqueSorted(combined, "window_size", true), "window-size");
  renderCheckboxGroup(elements.sentimentFilter, uniqueSentimentModels(combined), "sentiment-model");
  renderCheckboxGroup(elements.methodFilter, uniqueMethods(combined), "method");
  renderCheckboxGroup(elements.mFilter, uniqueMValues(combined), "m-value");
}

function syncFiltersFromInputs() {
  state.filters.search = elements.searchInput.value.trim();
  state.filters.fromYears = selectedCheckboxValues(elements.fromYearFilter);
  state.filters.toYears = selectedCheckboxValues(elements.toYearFilter);
  state.filters.windowSizes = selectedCheckboxValues(elements.windowFilter);
  state.filters.sentimentModels = selectedCheckboxValues(elements.sentimentFilter);
  state.filters.methods = selectedCheckboxValues(elements.methodFilter);
  state.filters.mValues = selectedCheckboxValues(elements.mFilter);
}

function resetFilters() {
  elements.searchInput.value = "";
  document.querySelectorAll('.filter-panel input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = false;
  });
  syncFiltersFromInputs();
  renderCurrentView();
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.remove("active");
  });
  document.querySelector(`#${view}View`).classList.add("active");
}

function wireEvents() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  [
    elements.searchInput,
  ].forEach((control) => {
    control.addEventListener("input", () => {
      syncFiltersFromInputs();
      renderCurrentView();
    });
  });

  document.querySelector(".filter-panel").addEventListener("change", (event) => {
    if (event.target.matches('input[type="checkbox"]')) {
      syncFiltersFromInputs();
      renderCurrentView();
    }
  });

  elements.resetFilters.addEventListener("click", resetFilters);
  elements.downloadRanked.addEventListener("click", () => {
    window.location.href = FILES.ranked;
  });
  elements.downloadBenchmarks.addEventListener("click", () => {
    window.location.href = FILES.benchmark;
  });
}

async function init() {
  wireEvents();
  try {
    const [ranked, benchmark, manifest] = await Promise.all([
      loadCsv(FILES.ranked),
      loadCsv(FILES.benchmark),
      loadCsv(FILES.manifest),
    ]);

    state.ranked = ranked;
    state.benchmark = benchmark;
    state.manifest = manifest;

    populateFilters();
    renderSummary();
    renderReports();
    renderCurrentView();
    elements.loadStatus.textContent = "Data loaded";
  } catch (error) {
    elements.loadStatus.textContent = "Data failed to load";
    document.querySelector("main").insertAdjacentHTML(
      "afterbegin",
      `<div class="filter-panel"><strong>Unable to load CSV data.</strong><br>${escapeHtml(error.message)}</div>`,
    );
  }
}

init();
