const DATA_DIR = "assets/grid_search_20260601_001500";
const DATA_VERSION = "final-20260618-fsi-detail-modal-1";
const dataFile = (file) => `${DATA_DIR}/${file}?v=${DATA_VERSION}`;
const FILES = {
  ranked: dataFile("grid_validation_ranked_report.csv"),
  all: dataFile("grid_validation_results_all.csv"),
  benchmark: dataFile("validation_results_by_benchmark.csv"),
  manifest: dataFile("generated_fsi_versions_manifest.csv"),
  plotCommon: dataFile("plot_series/common.json"),
};
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const RANKING_MODES = {
  validation_rules: {
    label: "Validation rules rank",
    rankColumn: "rules_rank",
    scoreColumn: "rules_total_score",
  },
  msr_granger: {
    label: "MSR+Granger rank",
    rankColumn: "msr_granger_rank",
    scoreColumn: "msr_granger_score",
  },
  correlation: {
    label: "Correlation rank",
    rankColumn: "rank",
    scoreColumn: "rank_score",
  },
};

const state = {
  ranked: [],
  benchmark: [],
  manifest: [],
  view: "ranked",
  rankingMode: "validation_rules",
  compare: {
    rankedRow: null,
    benchmarkRowsByIndex: new Map(),
  },
  plotCommon: null,
  plotShards: new Map(),
  modalFsiId: null,
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
  rankingModeSelect: document.querySelector("#rankingModeSelect"),
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
  modal: document.querySelector("#fsiModal"),
  modalTitle: document.querySelector("#modalTitle"),
  modalSubtitle: document.querySelector("#modalSubtitle"),
  modalBody: document.querySelector("#modalBody"),
  modalClose: document.querySelector("#modalClose"),
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
  "epu_msr_score",
  "cfsi_msr_score",
  "vixc_msr_score",
  "epu_granger_sig_lags",
  "cfsi_granger_sig_lags",
  "vixc_granger_sig_lags",
  "epu_granger_score",
  "cfsi_granger_score",
  "vixc_granger_score",
  "msr_component_score",
  "granger_component_score",
  "msr_granger_score",
  "msr_granger_rank",
  "rules_rank",
  "rules_accepted_rank",
  "rules_total_score",
  "rules_minimum_pass_count",
  "rules_supporting_pass_count",
  "rules_stationarity_score",
  "rules_correlation_score",
  "rules_lead_lag_score",
  "rules_granger_score",
  "rules_msr_score",
  "rules_robustness_score",
  "rules_simplicity_quality",
  "rule_S_FSI_EPU",
  "rule_S_EPU_FSI",
  "rule_S_FSI_CFSI",
  "rule_S_CFSI_FSI",
  "rule_S_FSI_VIXC",
  "rule_S_VIXC_FSI",
]);

["fsi_epu", "epu_fsi", "fsi_cfsi", "cfsi_fsi"].forEach((prefix) => {
  for (let lag = 1; lag <= 12; lag += 1) {
    numberColumns.add(`gc_${prefix}_lag${lag}`);
    numberColumns.add(`gc_${prefix}_lag${lag}_f_p`);
  }
});

for (let lag = 1; lag <= 30; lag += 1) {
  numberColumns.add(`gc_fsi_vixc_lag${lag}`);
  numberColumns.add(`gc_fsi_vixc_lag${lag}_f_p`);
  numberColumns.add(`gc_vixc_fsi_lag${lag}`);
  numberColumns.add(`gc_vixc_fsi_lag${lag}_f_p`);
}

["epu", "cfsi"].forEach((prefix) => {
  [1, 2, 3].forEach((lag) => {
    ["r", "p", "n"].forEach((suffix) => numberColumns.add(`${prefix}_lead_lag${lag}_${suffix}`));
  });
});

[1, 5, 10].forEach((lag) => {
  ["r", "p", "n"].forEach((suffix) => numberColumns.add(`vixc_lead_lag${lag}_${suffix}`));
});

["epu", "cfsi", "vixc"].forEach((prefix) => {
  [
    "low_regime_idx",
    "fsi_beta_low",
    "fsi_beta_high",
    "fsi_beta_low_se",
    "fsi_beta_high_se",
    "fsi_beta_low_p",
    "fsi_beta_high_p",
    "low_variance",
    "high_variance",
    "p_low_low",
    "p_low_high",
    "p_high_low",
    "p_high_high",
  ].forEach((suffix) => numberColumns.add(`${prefix}_${suffix}`));
});

[
  "low_regime_idx",
  "fsi_beta_low",
  "fsi_beta_high",
  "fsi_beta_low_se",
  "fsi_beta_high_se",
  "fsi_beta_low_p",
  "fsi_beta_high_p",
  "low_variance",
  "high_variance",
  "p_low_low",
  "p_low_high",
  "p_high_low",
  "p_high_high",
].forEach((column) => numberColumns.add(column));

const RULE_GROUPS = [
  {
    title: "Minimum Acceptance Rules",
    rules: [
      ["rule_A1_monthly_fsi_stationary", "A1. Monthly FSI stationarity", "ADF p < 0.10"],
      ["rule_A2_daily_fsi_stationary", "A2. Daily FSI stationarity", "ADF p < 0.05"],
      ["rule_A3_benchmark_stationary", "A3. Benchmark stationarity", "EPU, CFSI, and VIXC ADF p < 0.10"],
      ["rule_B1_epu_corr_positive_significant", "B1. Positive significant EPU correlation", "Pearson r > 0 and p < 0.05"],
      ["rule_B2_cfsi_corr_positive_significant", "B2. Positive significant CFSI correlation", "Pearson r > 0 and p < 0.05"],
      ["rule_C1_fsi_leads_epu", "C1. FSI positively leads EPU", "Lags 1-3 positive, at least two p < 0.05"],
      ["rule_C2_fsi_leads_cfsi", "C2. FSI positively leads CFSI", "Lags 1-3 positive, at least one p < 0.05"],
      ["rule_D1_fsi_granger_causes_epu", "D1. FSI Granger-causes EPU", "At least two significant lags"],
      ["rule_D2_no_stronger_epu_reverse_granger", "D2. EPU reverse causality control", "FSI->EPU significant lags > EPU->FSI"],
      ["rule_E1_msr_epu_high_positive_significant", "E1. EPU MSR high-stress coefficient", "High beta > 0 and p < 0.05"],
      ["rule_E2_msr_cfsi_high_positive_significant", "E2. CFSI MSR high-stress coefficient", "High beta > 0 and p < 0.05"],
      ["rule_E3_msr_vixc_high_positive_significant", "E3. VIXC MSR high-stress coefficient", "High beta > 0 and p < 0.05"],
      ["rule_E5_msr_beta_high_greater_than_low", "E5. MSR regime separation", "High beta > low beta for all benchmarks"],
      ["rule_E6_msr_high_variance_greater_than_low", "E6. MSR variance separation", "High variance > low variance for all benchmarks"],
      ["rule_E7_msr_low_persistence", "E7. Low-stress persistence", "P(low->low) > 0.90 for all benchmarks"],
      ["rule_E8_msr_high_persistence", "E8. High-stress persistence", "P(high->high) > 0.85 for all benchmarks"],
    ],
  },
  {
    title: "Supporting Rules",
    rules: [
      ["rule_B3_vixc_daily_corr_positive_weak_significant", "B3. Positive daily VIXC correlation", "Pearson r > 0 and p < 0.10"],
      ["rule_B4_spearman_no_contradiction", "B4. Spearman consistency", "Spearman does not strongly contradict Pearson"],
      ["rule_C3_fsi_leads_vixc", "C3. FSI positively leads VIXC", "Daily lags 1, 5, and 10 positive"],
      ["rule_D3_no_stronger_cfsi_reverse_granger", "D3. CFSI reverse causality control", "CFSI->FSI not stronger than FSI->CFSI"],
      ["rule_D4_no_stronger_vixc_reverse_granger", "D4. VIXC reverse causality control", "VIXC->FSI not stronger than FSI->VIXC"],
      ["rule_E4_low_stress_no_strong_contradiction", "E4. Low-stress MSR does not contradict", "Low beta does not strongly oppose high beta"],
    ],
  },
  {
    title: "Diagnostic Rules",
    rules: [
      ["rule_C3_strong_fsi_leads_vixc", "Strong C3. VIXC lead significance", "At least two VIXC lead-lag p-values < 0.10"],
      ["rule_D2_strong_no_epu_reverse_granger", "Strong D2. No EPU reverse lags", "No significant EPU->FSI Granger lags"],
    ],
  },
];

const SCORE_FIELDS = [
  ["rules_stationarity_score", "Stationarity"],
  ["rules_correlation_score", "Correlation"],
  ["rules_lead_lag_score", "Lead-lag"],
  ["rules_granger_score", "Granger"],
  ["rules_msr_score", "MSR"],
  ["rules_robustness_score", "Robustness"],
];

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

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load ${url}`);
  }
  return response.json();
}

function plotShardUrl(fsiId) {
  const shard = String(fsiId || "").slice(4, 6).toLowerCase();
  return dataFile(`plot_series/shard_${shard}.json`);
}

async function loadPlotSeries(fsiId) {
  if (!state.plotCommon) {
    state.plotCommon = await loadJson(FILES.plotCommon);
  }
  const shard = String(fsiId || "").slice(4, 6).toLowerCase();
  if (!state.plotShards.has(shard)) {
    state.plotShards.set(shard, await loadJson(plotShardUrl(fsiId)));
  }
  const shardData = state.plotShards.get(shard);
  const series = shardData?.series?.[fsiId];
  if (!series) {
    throw new Error(`Plot data not found for ${fsiId}`);
  }
  const common = state.plotCommon.ranges?.[series.range];
  if (!common) {
    throw new Error(`Common plot range not found for ${fsiId}`);
  }
  return { common, series };
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
  const preferred = ["lm", "finbert20", "finbert19", "finvader"];
  const found = new Set(rows.flatMap(sentimentParts));
  return preferred.filter((value) => found.has(value));
}

function sameSentimentSet(rowModels, selectedModels) {
  if (rowModels.length !== selectedModels.length) return false;
  return selectedModels.every((model) => rowModels.includes(model));
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
  return `${label}${parts[0]}`;
}

function uniqueYears(rows, key) {
  const values = rows.map((row) => yearFromDate(row[key])).filter(Boolean);
  return [...new Set(values)].sort((a, b) => Number(a) - Number(b));
}

function groupedEndPeriods(rows) {
  const byDate = new Map();
  rows.forEach((row) => {
    const raw = String(row.until_date || "").slice(0, 10);
    const label = toYear(row);
    if (!raw || !label) return;
    const [year, month] = raw.split("-");
    const monthIndex = Number(month);
    byDate.set(raw, {
      year,
      monthIndex,
      monthLabel: MONTH_LABELS[monthIndex - 1] || month,
      label,
    });
  });

  const byYear = new Map();
  [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([, period]) => {
      if (!byYear.has(period.year)) byYear.set(period.year, []);
      byYear.get(period.year).push(period);
    });

  return [...byYear.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, periods]) => ({ year, periods }));
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

function renderEndPeriodGroup(container, groups) {
  if (!container) return;
  container.innerHTML = "";
  groups.forEach((group) => {
    const groupEl = document.createElement("div");
    groupEl.className = "end-year-group";
    const yearId = `to-year-${group.year}`;
    const monthsHtml = group.periods
      .map((period) => {
        const monthId = `to-period-${period.label.replace(/[^a-z0-9]+/gi, "-")}`;
        return `
          <label class="checkbox-option end-month-option" for="${escapeHtml(monthId)}">
            <input
              id="${escapeHtml(monthId)}"
              type="checkbox"
              name="to-period"
              value="${escapeHtml(period.label)}"
              data-role="end-month"
              data-year="${escapeHtml(group.year)}"
            >
            <span>${escapeHtml(period.monthLabel)}</span>
          </label>
        `;
      })
      .join("");

    groupEl.innerHTML = `
      <label class="checkbox-option end-year-option" for="${escapeHtml(yearId)}">
        <input
          id="${escapeHtml(yearId)}"
          type="checkbox"
          name="to-year"
          value="${escapeHtml(group.year)}"
          data-role="end-year"
          data-year="${escapeHtml(group.year)}"
        >
        <span>${escapeHtml(group.year)}</span>
      </label>
      <div class="end-month-list">${monthsHtml}</div>
    `;
    container.appendChild(groupEl);
  });
}

function selectedCheckboxValues(container) {
  if (!container) return [];
  return [...container.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
}

function selectedEndPeriodValues(container) {
  if (!container) return [];
  return [...container.querySelectorAll('input[data-role="end-month"]:checked')].map((input) => input.value);
}

function syncEndYearCheckboxes() {
  if (!elements.toYearFilter) return;
  elements.toYearFilter.querySelectorAll('input[data-role="end-year"]').forEach((yearInput) => {
    const months = [
      ...elements.toYearFilter.querySelectorAll('input[data-role="end-month"]'),
    ].filter((input) => input.dataset.year === yearInput.dataset.year);
    const checkedCount = months.filter((input) => input.checked).length;
    yearInput.checked = months.length > 0 && checkedCount === months.length;
    yearInput.indeterminate = checkedCount > 0 && checkedCount < months.length;
  });
}

function handleEndPeriodChange(target) {
  if (!target.matches('input[data-role="end-year"], input[data-role="end-month"]')) return;

  if (target.dataset.role === "end-year") {
    const months = [...elements.toYearFilter.querySelectorAll('input[data-role="end-month"]')]
      .filter((input) => input.dataset.year === target.dataset.year);
    months.forEach((monthInput) => {
      monthInput.checked = target.checked;
    });
  }
  syncEndYearCheckboxes();
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

function boolValue(value) {
  if (value === "" || value == null) return null;
  if (value === true || value === false) return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function formatBool(value) {
  const parsed = boolValue(value);
  if (parsed == null) return "-";
  return `<span class="bool-pill ${parsed ? "bool-yes" : "bool-no"}">${parsed ? "Yes" : "No"}</span>`;
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

function fsiButton(fsiId) {
  return `
    <button class="fsi-detail-button mono" type="button" data-fsi-id="${escapeHtml(fsiId)}">
      ${escapeHtml(fsiId)}
    </button>
  `;
}

function ruleStatus(value) {
  const parsed = boolValue(value);
  if (parsed == null) return `<span class="bool-pill">-</span>`;
  return `<span class="bool-pill ${parsed ? "bool-yes" : "bool-no"}">${parsed ? "Pass" : "No"}</span>`;
}

function renderScoreCards(row) {
  return SCORE_FIELDS
    .map(([field, label]) => `
      <div class="score-card">
        <span>${escapeHtml(label)}</span>
        <strong>${formatNumber(row[field], 2)}</strong>
      </div>
    `)
    .join("");
}

function renderRuleGroups(row) {
  return RULE_GROUPS
    .map((group) => `
      <section class="rule-group">
        <h3>${escapeHtml(group.title)}</h3>
        <div class="rule-list">
          ${group.rules.map(([field, label, note]) => `
            <div class="rule-row">
              <div>
                <strong>${escapeHtml(label)}</strong>
                <small>${escapeHtml(note)}</small>
              </div>
              ${ruleStatus(row[field])}
            </div>
          `).join("")}
        </div>
      </section>
    `)
    .join("");
}

function seriesPairs(commonBench, fsiValues) {
  const dates = commonBench?.dates || [];
  const benchmark = commonBench?.benchmark || [];
  return dates
    .map((date, index) => ({
      date,
      fsi: numericValue(fsiValues?.[index]),
      benchmark: numericValue(benchmark[index]),
    }))
    .filter((point) => point.fsi != null || point.benchmark != null);
}

function chartPath(points, key, xScale, yScale) {
  const commands = [];
  points.forEach((point, index) => {
    const value = point[key];
    if (value == null) return;
    const command = `${commands.length ? "L" : "M"} ${xScale(index).toFixed(1)} ${yScale(value).toFixed(1)}`;
    commands.push(command);
  });
  return commands.join(" ");
}

function renderLineChart(title, points, meta = {}) {
  if (!points.length) {
    return `<div class="plot-error">No aligned plot data available.</div>`;
  }

  const width = 720;
  const height = 280;
  const margin = { top: 22, right: 18, bottom: 34, left: 42 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const values = points.flatMap((point) => [point.fsi, point.benchmark]).filter((value) => value != null);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const pad = Math.max((max - min) * 0.08, 0.2);
  min -= pad;
  max += pad;
  const xScale = (index) => margin.left + (points.length === 1 ? 0 : (index / (points.length - 1)) * innerWidth);
  const yScale = (value) => margin.top + ((max - value) / (max - min)) * innerHeight;
  const firstDate = points[0]?.date || "";
  const lastDate = points[points.length - 1]?.date || "";
  const zeroY = min <= 0 && max >= 0 ? yScale(0) : null;
  const fsiPath = chartPath(points, "fsi", xScale, yScale);
  const benchmarkPath = chartPath(points, "benchmark", xScale, yScale);

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(title)}">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#fff"></rect>
      <text x="${margin.left}" y="15" fill="#172033" font-size="15" font-weight="800">${escapeHtml(title)}</text>
      <line x1="${margin.left}" y1="${margin.top + innerHeight}" x2="${margin.left + innerWidth}" y2="${margin.top + innerHeight}" stroke="#c4cfdd"></line>
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + innerHeight}" stroke="#c4cfdd"></line>
      ${zeroY == null ? "" : `<line x1="${margin.left}" y1="${zeroY.toFixed(1)}" x2="${margin.left + innerWidth}" y2="${zeroY.toFixed(1)}" stroke="#d9e0ea" stroke-dasharray="4 4"></line>`}
      <text x="${margin.left}" y="${height - 9}" fill="#667085" font-size="11">${escapeHtml(firstDate)}</text>
      <text x="${margin.left + innerWidth}" y="${height - 9}" fill="#667085" font-size="11" text-anchor="end">${escapeHtml(lastDate)}</text>
      <text x="${margin.left - 7}" y="${yScale(max).toFixed(1)}" fill="#667085" font-size="10" text-anchor="end">${max.toFixed(1)}</text>
      <text x="${margin.left - 7}" y="${yScale(min).toFixed(1)}" fill="#667085" font-size="10" text-anchor="end">${min.toFixed(1)}</text>
      <path d="${benchmarkPath}" fill="none" stroke="#7c3aed" stroke-width="2.1"></path>
      <path d="${fsiPath}" fill="none" stroke="#0f766e" stroke-width="2.3"></path>
      <g transform="translate(${margin.left}, ${height - 28})">
        <rect x="0" y="-8" width="10" height="3" fill="#0f766e"></rect>
        <text x="16" y="-3" fill="#344054" font-size="11">FSI</text>
        <rect x="58" y="-8" width="10" height="3" fill="#7c3aed"></rect>
        <text x="74" y="-3" fill="#344054" font-size="11">${escapeHtml(meta.benchmarkLabel || "Benchmark")}</text>
        ${meta.sampleText ? `<text x="180" y="-3" fill="#667085" font-size="11">${escapeHtml(meta.sampleText)}</text>` : ""}
      </g>
    </svg>
  `;
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
    if (!sameSentimentSet(rowModels, state.filters.sentimentModels)) return false;
  }

  return true;
}

function filteredRankedRows() {
  return sortedRankedRows().filter((row) => matchesFilters(row));
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
    return state.ranked.find((row) => String(activeRank(row)) === String(Number(term))) || null;
  }

  return null;
}

function setCompareRow(row) {
  const benchmarkRows = benchmarkRowsByFsi().get(row.fsi_id) || [];
  state.compare.rankedRow = row;
  state.compare.benchmarkRowsByIndex = new Map(
    benchmarkRows.map((benchmarkRow) => [benchmarkRow.benchmark_index, benchmarkRow]),
  );
  elements.compareStatus.textContent = `Comparing to ${activeRankingMode().label} ${activeRank(row)}: ${row.fsi_id}`;
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

function rankedRowById(fsiId) {
  return state.ranked.find((row) => row.fsi_id === fsiId) || null;
}

function modalBenchmarkRows(fsiId) {
  return state.benchmark
    .filter((row) => row.fsi_id === fsiId)
    .sort((a, b) => benchmarkSortValue(a) - benchmarkSortValue(b));
}

function renderDetailCards(row) {
  const cards = [
    ["Rank", formatInteger(activeRank(row))],
    ["Score", formatNumber(activeScore(row), 2)],
    ["Accepted", formatBool(row.rules_accepted)],
    ["Minimum rules", `${formatInteger(row.rules_minimum_pass_count)} / 16`],
    ["Supporting rules", `${formatInteger(row.rules_supporting_pass_count)} / 6`],
    ["Correlation rank", formatInteger(row.rank)],
    ["MSR+Granger rank", formatInteger(row.msr_granger_rank)],
    ["Sentiment", row.sentiment_set],
    ["Method", methodValue(row)],
    ["m", mValue(row)],
    ["From", fromYear(row)],
    ["End range", toYear(row)],
  ];
  return cards
    .map(([label, value]) => `
      <div class="detail-card">
        <span>${escapeHtml(label)}</span>
        <strong>${String(value || "-").startsWith("<") ? value : escapeHtml(value || "-")}</strong>
      </div>
    `)
    .join("");
}

function renderModalBody(row) {
  const benchmarkRows = modalBenchmarkRows(row.fsi_id);
  const benchmarkSummary = benchmarkRows
    .map((bench) => `${bench.benchmark_index}: r ${formatNumber(bench.pearson_r, 3)}, beta high ${formatNumber(bench.fsi_beta_high, 3)}`)
    .join(" | ");
  return `
    <div class="detail-grid">${renderDetailCards(row)}</div>
    <div class="score-grid">${renderScoreCards(row)}</div>
    <h3 class="modal-section-title">Validation Rules</h3>
    <div class="rules-layout">${renderRuleGroups(row)}</div>
    <h3 class="modal-section-title">Validation Plots</h3>
    <div id="modalPlots" class="plot-grid">
      <div class="plot-loading">Loading plot data...</div>
    </div>
    <h3 class="modal-section-title">Benchmark Snapshot</h3>
    <div class="plot-loading">${escapeHtml(benchmarkSummary || "No benchmark rows found.")}</div>
  `;
}

async function renderModalPlots(row) {
  const plotContainer = document.querySelector("#modalPlots");
  if (!plotContainer) return;
  try {
    const { common, series } = await loadPlotSeries(row.fsi_id);
    if (state.modalFsiId !== row.fsi_id) return;
    const epuPoints = seriesPairs(common.epu, series.epu);
    const cfsiPoints = seriesPairs(common.cfsi, series.cfsi);
    const vixcPoints = seriesPairs(common.vixc, series.vixc);
    plotContainer.innerHTML = [
      {
        title: "Monthly FSI vs EPU",
        points: epuPoints,
        benchmarkLabel: "EPU",
      },
      {
        title: "Monthly FSI vs CFSI",
        points: cfsiPoints,
        benchmarkLabel: "CFSI",
      },
      {
        title: "Daily FSI vs VIXC",
        points: vixcPoints,
        benchmarkLabel: "VIXC",
        sampleText: `${formatInteger(common.vixc.sampleN)} of ${formatInteger(common.vixc.sourceN)} daily points`,
      },
    ].map((plot) => `
      <article class="plot-card">
        <h3>${escapeHtml(plot.title)}</h3>
        ${renderLineChart(plot.title, plot.points, plot)}
      </article>
    `).join("");
  } catch (error) {
    plotContainer.innerHTML = `<div class="plot-error">${escapeHtml(error.message)}</div>`;
  }
}

function openFsiModal(fsiId) {
  const row = rankedRowById(fsiId);
  if (!row) return;
  state.modalFsiId = fsiId;
  elements.modalTitle.textContent = fsiId;
  elements.modalSubtitle.textContent = `${activeRankingMode().label} ${formatInteger(activeRank(row))} | ${row.sentiment_set} | ${methodValue(row)} m=${mValue(row)} | ${fromYear(row)} to ${toYear(row)}`;
  elements.modalBody.innerHTML = renderModalBody(row);
  elements.modal.hidden = false;
  document.body.style.overflow = "hidden";
  renderModalPlots(row);
}

function closeFsiModal() {
  state.modalFsiId = null;
  elements.modal.hidden = true;
  document.body.style.overflow = "";
}

function activeRankingMode() {
  return RANKING_MODES[state.rankingMode] || RANKING_MODES.validation_rules;
}

function activeRank(row) {
  const value = row?.[activeRankingMode().rankColumn];
  return value === "" || value == null ? row?.rank : value;
}

function activeScore(row) {
  const value = row?.[activeRankingMode().scoreColumn];
  return value === "" || value == null ? row?.rank_score : value;
}

function sortedRankedRows() {
  const rankColumn = activeRankingMode().rankColumn;
  return [...state.ranked].sort((a, b) => {
    const aRank = numericValue(a[rankColumn]);
    const bRank = numericValue(b[rankColumn]);
    if (aRank == null && bRank == null) return 0;
    if (aRank == null) return 1;
    if (bRank == null) return -1;
    return aRank - bRank;
  });
}

function renderSummary() {
  const best = sortedRankedRows()[0] || {};
  elements.summaryFsi.textContent = formatInteger(state.manifest.length || state.ranked.length);
  elements.summaryBenchmarks.textContent = formatInteger(state.benchmark.length);
  elements.summaryScore.textContent = formatNumber(activeScore(best));
  elements.summaryBestId.textContent = best.fsi_id || "-";
}

function renderRankedTable() {
  const rows = filteredRankedRows();
  elements.rankedCount.textContent =
    `${rows.length.toLocaleString()} matching FSI versions, ranked by ${activeRankingMode().label}`;
  const visible = rows.slice(0, 250);

  if (!visible.length) {
    elements.rankedTable.innerHTML = `<tr><td class="empty" colspan="12">No ranked FSI versions match the current filters.</td></tr>`;
    return;
  }

  elements.rankedTable.innerHTML = visible
    .map((row) => `
      <tr>
        <td>${formatInteger(activeRank(row))}</td>
        <td>${fsiButton(row.fsi_id)}</td>
        <td>${compareValue(activeScore(row), activeScore(state.compare.rankedRow))}</td>
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
              <td rowspan="${rowspan}" class="rowspan-cell">${formatInteger(activeRank(group.rankedRow))}</td>
              <td rowspan="${rowspan}" class="rowspan-cell">${fsiButton(group.rankedRow.fsi_id)}</td>
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
    elements.msrTable.innerHTML = `<tr><td class="empty" colspan="25">No MSR rows match the current filters.</td></tr>`;
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
              <td rowspan="${rowspan}" class="rowspan-cell">${formatInteger(activeRank(group.rankedRow))}</td>
              <td rowspan="${rowspan}" class="rowspan-cell">${fsiButton(group.rankedRow.fsi_id)}</td>
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
            <td>${formatBool(row.markov_converged)}</td>
            <td>${formatBool(row.markov_finite_bse)}</td>
            <td>${compareValue(row.fsi_beta_low, baseBenchmarkRow?.fsi_beta_low, 4)}</td>
            <td>${compareValue(row.fsi_beta_high, baseBenchmarkRow?.fsi_beta_high, 4)}</td>
            <td>${formatNumber(row.fsi_beta_high_p, 4)}</td>
            <td>${formatBool(row.fsi_beta_high_positive)}</td>
            <td>${formatBool(row.fsi_beta_amplification)}</td>
            <td>${formatBool(row.fsi_msr_conditions_pass)}</td>
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
      title: "Expanded Granger P-values",
      file: "expanded_granger_added.csv",
      rows: state.ranked.length,
      description: "FSI-to-benchmark Granger p-values using 12 monthly lags and 30 daily VIXC lags.",
    },
    {
      title: "Validation Rules Summary",
      file: "validation_rules_summary.csv",
      rows: 1,
      description: "Acceptance count, score range, and top configuration under the validation-rules scoring system.",
    },
    {
      title: "Validation Rule Pass Counts",
      file: "validation_rules_pass_counts.csv",
      rows: 24,
      description: "Pass counts for each boolean minimum, supporting, and diagnostic validation rule.",
    },
    {
      title: "Validation Rule Inputs",
      file: "validation_rules_inputs_added.csv",
      rows: state.ranked.length,
      description: "Computed fixed lead-lag, Granger F-test, and MSR variance/persistence inputs for rule scoring.",
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
  renderEndPeriodGroup(elements.toYearFilter, groupedEndPeriods(combined));
  renderCheckboxGroup(elements.windowFilter, uniqueSorted(combined, "window_size", true), "window-size");
  renderCheckboxGroup(elements.sentimentFilter, uniqueSentimentModels(combined), "sentiment-model");
  renderCheckboxGroup(elements.methodFilter, uniqueMethods(combined), "method");
  renderCheckboxGroup(elements.mFilter, uniqueMValues(combined), "m-value");
}

function syncFiltersFromInputs() {
  state.filters.search = elements.searchInput.value.trim();
  state.filters.fromYears = selectedCheckboxValues(elements.fromYearFilter);
  state.filters.toYears = selectedEndPeriodValues(elements.toYearFilter);
  state.filters.windowSizes = selectedCheckboxValues(elements.windowFilter);
  state.filters.sentimentModels = selectedCheckboxValues(elements.sentimentFilter);
  state.filters.methods = selectedCheckboxValues(elements.methodFilter);
  state.filters.mValues = selectedCheckboxValues(elements.mFilter);
}

function resetFilters() {
  elements.searchInput.value = "";
  document.querySelectorAll('.filter-panel input[type="checkbox"]').forEach((checkbox) => {
    checkbox.checked = false;
    checkbox.indeterminate = false;
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

function handleFsiDetailClick(event) {
  const button = event.target.closest(".fsi-detail-button");
  if (!button) return;
  openFsiModal(button.dataset.fsiId);
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
      handleEndPeriodChange(event.target);
      syncFiltersFromInputs();
      renderCurrentView();
    }
  });

  elements.rankingModeSelect.addEventListener("change", () => {
    state.rankingMode = elements.rankingModeSelect.value;
    clearCompareState();
    renderSummary();
    renderCurrentView();
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
  [elements.rankedTable, elements.benchmarkTable, elements.msrTable].forEach((tableBody) => {
    tableBody.addEventListener("click", handleFsiDetailClick);
  });
  elements.modalClose.addEventListener("click", closeFsiModal);
  elements.modal.addEventListener("click", (event) => {
    if (event.target === elements.modal) closeFsiModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.modal.hidden) {
      closeFsiModal();
    }
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
