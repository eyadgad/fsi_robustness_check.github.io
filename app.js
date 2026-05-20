const DATA_DIR = "assets/grid_search_20260520_104155";
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
    dateRange: "",
    windowSize: "",
    sentimentSet: "",
    method: "",
    variant: "",
    mValue: "",
    dailyWindow: "",
    ewmHalflife: "",
    benchmark: "",
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
  dateRangeFilter: document.querySelector("#dateRangeFilter"),
  windowFilter: document.querySelector("#windowFilter"),
  sentimentFilter: document.querySelector("#sentimentFilter"),
  methodFilter: document.querySelector("#methodFilter"),
  variantFilter: document.querySelector("#variantFilter"),
  mFilter: document.querySelector("#mFilter"),
  dailyWindowFilter: document.querySelector("#dailyWindowFilter"),
  ewmFilter: document.querySelector("#ewmFilter"),
  benchmarkFilter: document.querySelector("#benchmarkFilter"),
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

function dateRange(row) {
  return `${row.since_date} to ${row.until_date}`;
}

function addOptions(select, values, label = "All") {
  select.innerHTML = "";
  const all = document.createElement("option");
  all.value = "";
  all.textContent = label;
  select.appendChild(all);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
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

function matchesFilters(row, includeBenchmark = false) {
  const search = state.filters.search.toLowerCase();
  if (search) {
    const haystack = [
      row.fsi_id,
      row.sentiment_set,
      row.variant,
      row.short,
      row.filtering_type,
      row.benchmark_index,
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  if (state.filters.dateRange && dateRange(row) !== state.filters.dateRange) return false;
  if (state.filters.windowSize && String(row.window_size) !== state.filters.windowSize) return false;
  if (state.filters.sentimentSet && row.sentiment_set !== state.filters.sentimentSet) return false;
  if (state.filters.method && row.filtering_type !== state.filters.method) return false;
  if (state.filters.variant && row.variant !== state.filters.variant) return false;
  if (state.filters.mValue && String(row.min_matches) !== state.filters.mValue) return false;
  if (state.filters.dailyWindow && String(row.daily_window) !== state.filters.dailyWindow) return false;
  if (state.filters.ewmHalflife && String(row.ewm_halflife) !== state.filters.ewmHalflife) return false;
  if (includeBenchmark && state.filters.benchmark && row.benchmark_index !== state.filters.benchmark) return false;

  return true;
}

function filteredRankedRows() {
  return state.ranked.filter((row) => matchesFilters(row, false));
}

function filteredBenchmarkRows() {
  return state.benchmark.filter((row) => matchesFilters(row, true));
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
    elements.rankedTable.innerHTML = `<tr><td class="empty" colspan="11">No ranked FSI versions match the current filters.</td></tr>`;
    return;
  }

  elements.rankedTable.innerHTML = visible
    .map((row) => `
      <tr>
        <td>${formatInteger(row.rank)}</td>
        <td><span class="mono">${escapeHtml(row.fsi_id)}</span></td>
        <td>${formatNumber(row.rank_score)}</td>
        <td>${escapeHtml(row.sentiment_set)}</td>
        <td><span class="pill">${escapeHtml(row.filtering_type)}</span></td>
        <td>${escapeHtml(row.min_matches)}</td>
        <td>${escapeHtml(dateRange(row))}</td>
        <td>${escapeHtml(row.window_size)}</td>
        <td>${formatNumber(row.epu_pearson_r)}</td>
        <td>${formatNumber(row.cfsi_pearson_r)}</td>
        <td>${formatNumber(row.vixc_pearson_r)}</td>
      </tr>
    `)
    .join("");
}

function renderBenchmarkTable() {
  const rows = filteredBenchmarkRows();
  elements.benchmarkCount.textContent = `${rows.length.toLocaleString()} matching benchmark rows`;
  const visible = rows.slice(0, 350);

  if (!visible.length) {
    elements.benchmarkTable.innerHTML = `<tr><td class="empty" colspan="13">No benchmark validation rows match the current filters.</td></tr>`;
    return;
  }

  elements.benchmarkTable.innerHTML = visible
    .map((row) => `
      <tr>
        <td><span class="mono">${escapeHtml(row.fsi_id)}</span></td>
        <td>${escapeHtml(row.benchmark_index)}</td>
        <td>${escapeHtml(row.benchmark_frequency)}</td>
        <td>${escapeHtml(row.sentiment_set)}</td>
        <td><span class="pill">${escapeHtml(row.filtering_type)}</span></td>
        <td>${escapeHtml(row.min_matches)}</td>
        <td>${escapeHtml(dateRange(row))}</td>
        <td>${escapeHtml(row.window_size)}</td>
        <td>${formatNumber(row.pearson_r)}</td>
        <td>${formatNumber(row.spearman_rho)}</td>
        <td>${formatNumber(row.rmse)}</td>
        <td>${escapeHtml(row.optimal_lag_dir || "-")} ${row.optimal_lag !== "" ? `(${row.optimal_lag})` : ""}</td>
        <td class="note-cell">${escapeHtml(row.notes || row.alignment_notes || "")}</td>
      </tr>
    `)
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
  ];

  elements.reportGrid.innerHTML = reports
    .map((report) => `
      <article class="report-card">
        <h3>${escapeHtml(report.title)}</h3>
        <p>${escapeHtml(report.description)}</p>
        <p><strong>${formatInteger(report.rows)}</strong> rows</p>
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
  const ranges = [...new Set(combined.map(dateRange))].sort();
  addOptions(elements.dateRangeFilter, ranges, "All ranges");
  addOptions(elements.windowFilter, uniqueSorted(combined, "window_size", true), "All windows");
  addOptions(elements.sentimentFilter, uniqueSorted(combined, "sentiment_set"), "All sentiment sets");
  addOptions(elements.methodFilter, uniqueSorted(combined, "filtering_type"), "All methods");
  addOptions(elements.variantFilter, uniqueSorted(combined, "variant"), "All variants");
  addOptions(elements.mFilter, uniqueSorted(combined, "min_matches", true), "All m values");
  addOptions(elements.dailyWindowFilter, uniqueSorted(combined, "daily_window", true), "All daily windows");
  addOptions(elements.ewmFilter, uniqueSorted(combined, "ewm_halflife", true), "All halflives");
  addOptions(elements.benchmarkFilter, uniqueSorted(state.benchmark, "benchmark_index"), "All benchmarks");
}

function syncFiltersFromInputs() {
  state.filters.search = elements.searchInput.value.trim();
  state.filters.dateRange = elements.dateRangeFilter.value;
  state.filters.windowSize = elements.windowFilter.value;
  state.filters.sentimentSet = elements.sentimentFilter.value;
  state.filters.method = elements.methodFilter.value;
  state.filters.variant = elements.variantFilter.value;
  state.filters.mValue = elements.mFilter.value;
  state.filters.dailyWindow = elements.dailyWindowFilter.value;
  state.filters.ewmHalflife = elements.ewmFilter.value;
  state.filters.benchmark = elements.benchmarkFilter.value;
}

function resetFilters() {
  elements.searchInput.value = "";
  [
    elements.dateRangeFilter,
    elements.windowFilter,
    elements.sentimentFilter,
    elements.methodFilter,
    elements.variantFilter,
    elements.mFilter,
    elements.dailyWindowFilter,
    elements.ewmFilter,
    elements.benchmarkFilter,
  ].forEach((select) => {
    select.value = "";
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
    elements.dateRangeFilter,
    elements.windowFilter,
    elements.sentimentFilter,
    elements.methodFilter,
    elements.variantFilter,
    elements.mFilter,
    elements.dailyWindowFilter,
    elements.ewmFilter,
    elements.benchmarkFilter,
  ].forEach((control) => {
    control.addEventListener("input", () => {
      syncFiltersFromInputs();
      renderCurrentView();
    });
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
