const DATA_DIR = "assets/grid_search_20260522_125148";
const DATA_VERSION = "final-20260522";
const dataFile = (file) => `${DATA_DIR}/${file}?v=${DATA_VERSION}`;
const FILES = {
  ranked: dataFile("grid_validation_ranked_report.csv"),
  all: dataFile("grid_validation_results_all.csv"),
  benchmark: dataFile("validation_results_by_benchmark.csv"),
  manifest: dataFile("generated_fsi_versions_manifest.csv"),
};
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const state = {
  ranked: [],
  benchmark: [],
  manifest: [],
  view: "ranked",
  compare: {
    rankedRow: null,
    benchmarkRowsByIndex: new Map(),
  },
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
  msrTable: document.querySelector("#msrTable"),
  rankedCount: document.querySelector("#rankedCount"),
  benchmarkCount: document.querySelector("#benchmarkCount"),
  msrCount: document.querySelector("#msrCount"),
  reportGrid: document.querySelector("#reportGrid"),
  compareInput: document.querySelector("#compareInput"),
  compareButton: document.querySelector("#compareButton"),
  clearCompare: document.querySelector("#clearCompare"),
  compareStatus: document.querySelector("#compareStatus"),
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
  downloadMsr: document.querySelector("#downloadMsr"),
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
  "markov_llf",
  "markov_aic",
  "markov_bic",
  "high_regime_idx",
  "high_regime_frac",
  "epu_markov_llf",
  "epu_markov_aic",
  "epu_markov_bic",
  "epu_high_regime_frac",
  "cfsi_markov_llf",
  "cfsi_markov_aic",
  "cfsi_markov_bic",
  "cfsi_high_regime_frac",
  "vixc_markov_llf",
  "vixc_markov_aic",
  "vixc_markov_bic",
  "vixc_high_regime_frac",
  "epu_cfsi_regime_concordance",
  "epu_vixc_regime_concordance",
  "cfsi_vixc_regime_concordance",
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
  const parts = String(row.until_date || "").slice(0, 10).split("-");
  if (parts.length < 2) return "";
  const month = Number(parts[1]);
  const label = MONTH_LABELS[month - 1] || parts[1];
  return `${label} ${parts[0]}`;
}

function uniqueYears(rows, key) {
  const values = rows.map((row) => yearFromDate(row[key])).filter(Boolean);
  return [...new Set(values)].sort((a, b) => Number(a) - Number(b));
}

function uniqueEndPeriods(rows) {
  const byDate = new Map();
  rows.forEach((row) => {
    const raw = String(row.until_date || "").slice(0, 10);
    const label = toYear(row);
    if (raw && label) byDate.set(raw, label);
  });
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, label]) => label);
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

function formatPercent(value, digits = 1) {
  if (value === "" || value == null || Number.isNaN(Number(value))) return "-";
  return `${(Number(value) * 100).toFixed(digits)}%`;
}

function formatRegimeMeans(value) {
  const parts = String(value || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return "-";
  return parts.map((part) => formatNumber(part, 3)).join(" / ");
}

function numericValue(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function diffClass(diff) {
  if (diff > 0) return "diff-positive";
  if (diff < 0) return "diff-negative";
  return "diff-neutral";
}

function formatSignedDiff(diff, digits = 4, suffix = "") {
  const sign = diff > 0 ? "+" : "";
  return `<span class="${diffClass(diff)}">${sign}${diff.toFixed(digits)}${suffix}</span>`;
}

function compareValue(value, baseValue, digits = 4) {
  if (!state.compare.rankedRow) return formatNumber(value, digits);
  const current = numericValue(value);
  const base = numericValue(baseValue);
  if (current == null || base == null) return "-";
  return formatSignedDiff(current - base, digits);
}

function comparePercent(value, baseValue, digits = 1) {
  if (!state.compare.rankedRow) return formatPercent(value, digits);
  const current = numericValue(value);
  const base = numericValue(baseValue);
  if (current == null || base == null) return "-";
  return formatSignedDiff((current - base) * 100, digits, "%");
}

function formatRegimeMeansDiff(value, baseValue) {
  if (!state.compare.rankedRow) return escapeHtml(formatRegimeMeans(value));
  const current = String(value || "").split(";").map(numericValue).filter((part) => part != null);
  const base = String(baseValue || "").split(";").map(numericValue).filter((part) => part != null);
  if (!current.length || current.length !== base.length) return "-";
  const parts = current.map((part, index) => formatSignedDiff(part - base[index], 3));
  return `<span class="diff-parts">${parts.join("<span>/</span>")}</span>`;
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

function filteredBenchmarkGroups() {
  const groupedBenchmarkRows = benchmarkRowsByFsi();
  return filteredRankedRows()
    .map((rankedRow) => ({
      rankedRow,
      benchmarkRows: groupedBenchmarkRows.get(rankedRow.fsi_id) || [],
    }))
    .filter((group) => group.benchmarkRows.length);
}

function findCompareRow(value) {
  const term = String(value || "").trim();
  if (!term) return null;
  const lowerTerm = term.toLowerCase();

  const byId = state.ranked.find((row) => String(row.fsi_id || "").toLowerCase() === lowerTerm);
  if (byId) return byId;

  if (/^\d+$/.test(term)) {
    return state.ranked.find((row) => String(row.rank) === String(Number(term))) || null;
  }

  return null;
}

function setCompareRow(row) {
  const benchmarkRows = benchmarkRowsByFsi().get(row.fsi_id) || [];
  state.compare.rankedRow = row;
  state.compare.benchmarkRowsByIndex = new Map(
    benchmarkRows.map((benchmarkRow) => [benchmarkRow.benchmark_index, benchmarkRow]),
  );
  elements.compareStatus.textContent = `Comparing to rank ${row.rank}: ${row.fsi_id}`;
  elements.compareStatus.classList.remove("error");
}

function clearCompareState() {
  state.compare.rankedRow = null;
  state.compare.benchmarkRowsByIndex = new Map();
  elements.compareStatus.textContent = "No comparison selected";
  elements.compareStatus.classList.remove("error");
}

function compareBenchmarkRow(row) {
  if (!state.compare.rankedRow) return null;
  return state.compare.benchmarkRowsByIndex.get(row.benchmark_index) || null;
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
        <td>${compareValue(row.rank_score, state.compare.rankedRow?.rank_score)}</td>
        <td>${escapeHtml(row.sentiment_set)}</td>
        <td><span class="pill">${escapeHtml(methodValue(row))}</span></td>
        <td>${escapeHtml(mValue(row))}</td>
        <td>${escapeHtml(fromYear(row))}</td>
        <td>${escapeHtml(toYear(row))}</td>
        <td>${escapeHtml(row.window_size)}</td>
        <td>${compareValue(row.epu_pearson_r, state.compare.rankedRow?.epu_pearson_r)}</td>
        <td>${compareValue(row.cfsi_pearson_r, state.compare.rankedRow?.cfsi_pearson_r)}</td>
        <td>${compareValue(row.vixc_pearson_r, state.compare.rankedRow?.vixc_pearson_r)}</td>
      </tr>
    `)
    .join("");
}

function renderBenchmarkTable() {
  const groups = filteredBenchmarkGroups();
  const benchmarkRowCount = groups.reduce((total, group) => total + group.benchmarkRows.length, 0);
  elements.benchmarkCount.textContent =
    `${groups.length.toLocaleString()} matching FSI versions, ${benchmarkRowCount.toLocaleString()} benchmark rows`;
  const visible = groups.slice(0, 120);

  if (!visible.length) {
    elements.benchmarkTable.innerHTML = `<tr><td class="empty" colspan="13">No benchmark validation rows match the current filters.</td></tr>`;
    return;
  }

  elements.benchmarkTable.innerHTML = visible
    .map((group) => {
      const rowspan = group.benchmarkRows.length;
      return group.benchmarkRows
        .map((row, index) => {
          const baseBenchmarkRow = compareBenchmarkRow(row);
          return `
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
            <td>${compareValue(row.pearson_r, baseBenchmarkRow?.pearson_r)}</td>
            <td>${compareValue(row.spearman_rho, baseBenchmarkRow?.spearman_rho)}</td>
            <td>${compareValue(row.rmse, baseBenchmarkRow?.rmse)}</td>
            <td>${escapeHtml(row.optimal_lag_dir || "-")} ${row.optimal_lag !== "" ? `(${row.optimal_lag})` : ""}</td>
          </tr>
        `;
        })
        .join("");
    })
    .join("");
}

function renderMsrTable() {
  const groups = filteredBenchmarkGroups();
  const msrRowCount = groups.reduce((total, group) => total + group.benchmarkRows.length, 0);
  elements.msrCount.textContent =
    `${groups.length.toLocaleString()} matching FSI versions, ${msrRowCount.toLocaleString()} MSR rows`;
  const visible = groups.slice(0, 120);

  if (!visible.length) {
    elements.msrTable.innerHTML = `<tr><td class="empty" colspan="17">No MSR rows match the current filters.</td></tr>`;
    return;
  }

  elements.msrTable.innerHTML = visible
    .map((group) => {
      const rowspan = group.benchmarkRows.length;
      return group.benchmarkRows
        .map((row, index) => {
          const baseBenchmarkRow = compareBenchmarkRow(row);
          return `
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
              <td rowspan="${rowspan}" class="rowspan-cell">${comparePercent(group.rankedRow.epu_cfsi_regime_concordance, state.compare.rankedRow?.epu_cfsi_regime_concordance)}</td>
              <td rowspan="${rowspan}" class="rowspan-cell">${comparePercent(group.rankedRow.epu_vixc_regime_concordance, state.compare.rankedRow?.epu_vixc_regime_concordance)}</td>
              <td rowspan="${rowspan}" class="rowspan-cell">${comparePercent(group.rankedRow.cfsi_vixc_regime_concordance, state.compare.rankedRow?.cfsi_vixc_regime_concordance)}</td>
            ` : ""}
            <td class="benchmark-name">${escapeHtml(row.benchmark_index)}</td>
            <td>${compareValue(row.markov_llf, baseBenchmarkRow?.markov_llf, 2)}</td>
            <td>${compareValue(row.markov_aic, baseBenchmarkRow?.markov_aic, 2)}</td>
            <td>${compareValue(row.markov_bic, baseBenchmarkRow?.markov_bic, 2)}</td>
            <td>${comparePercent(row.high_regime_frac, baseBenchmarkRow?.high_regime_frac)}</td>
            <td>${formatRegimeMeansDiff(row.regime_means, baseBenchmarkRow?.regime_means)}</td>
          </tr>
        `;
        })
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
      description: "Generated FSI IDs and parameter values.",
    },
  ];

  elements.reportGrid.innerHTML = reports
    .map((report) => `
      <article class="report-card">
        <h3>${escapeHtml(report.title)}</h3>
        <p>${escapeHtml(report.description)}</p>
        ${report.rows === "" ? "" : `<p><strong>${formatInteger(report.rows)}</strong> rows</p>`}
        <a href="${dataFile(report.file)}" download>Download ${escapeHtml(report.file)}</a>
      </article>
    `)
    .join("");
}

function renderCurrentView() {
  renderRankedTable();
  renderBenchmarkTable();
  renderMsrTable();
}

function populateFilters() {
  const combined = [...state.ranked, ...state.benchmark];
  renderCheckboxGroup(elements.fromYearFilter, uniqueYears(combined, "since_date"), "from-year");
  renderCheckboxGroup(elements.toYearFilter, uniqueEndPeriods(combined), "to-period");
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

function applyCompare() {
  const row = findCompareRow(elements.compareInput.value);
  if (!row) {
    clearCompareState();
    elements.compareStatus.textContent = "Rank or FSI ID not found";
    elements.compareStatus.classList.add("error");
    renderCurrentView();
    return;
  }

  setCompareRow(row);
  renderCurrentView();
}

function clearCompare() {
  elements.compareInput.value = "";
  clearCompareState();
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
  elements.compareButton.addEventListener("click", applyCompare);
  elements.clearCompare.addEventListener("click", clearCompare);
  elements.compareInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      applyCompare();
    }
  });
  elements.downloadRanked.addEventListener("click", () => {
    window.location.href = FILES.ranked;
  });
  elements.downloadBenchmarks.addEventListener("click", () => {
    window.location.href = FILES.benchmark;
  });
  elements.downloadMsr.addEventListener("click", () => {
    window.location.href = FILES.all;
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
