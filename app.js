const els = {
  inputTokens: document.getElementById("inputTokens"),
  outputTokens: document.getElementById("outputTokens"),
  totalTokens: document.getElementById("totalTokens"),
  outputShare: document.getElementById("outputShare"),
  shareValue: document.getElementById("shareValue"),
  splitSummary: document.getElementById("splitSummary"),
  detailedFields: document.getElementById("detailedFields"),
  totalFields: document.getElementById("totalFields"),
  usageModeButtons: [...document.querySelectorAll("[data-usage-mode]")],
  ratioPresetButtons: [...document.querySelectorAll("[data-output-share]")],
  volumeButtons: [...document.querySelectorAll("[data-token-total]")],
  pricingModeButtons: [...document.querySelectorAll("[data-pricing-mode]")],
  summaryFootnoteText: document.getElementById("summaryFootnoteText"),
  modelUsed: document.getElementById("modelUsed"),
  modelSearch: document.getElementById("modelSearch"),
  providerFilter: document.getElementById("providerFilter"),
  currency: document.getElementById("currency"),
  rate: document.getElementById("rate"),
  rateWrap: document.getElementById("rateWrap"),
  rateStatus: document.getElementById("rateStatus"),
  refreshRate: document.getElementById("refreshRate"),
  presetBtn: document.getElementById("presetBtn"),
  results: document.getElementById("results"),
  resultCount: document.getElementById("resultCount"),
  noResults: document.getElementById("noResults"),
  usedSummary: document.getElementById("usedSummary"),
  emptyState: document.getElementById("emptyState"),
  pricingDate: document.getElementById("pricingDate"),
  pricingDateTop: document.getElementById("pricingDateTop"),
  themeToggle: document.getElementById("themeToggle"),
  themeColor: document.getElementById("themeColor"),
};

const {
  calcCost,
  effectiveRates,
  formatMoney,
  formatNumber,
  hasBatchDiscount,
  isValidExchangeRate,
  MAX_TOKENS_PER_SCENARIO,
  parseTokenValue,
  splitTokenTotal,
} = CalculatorCore;

const STORAGE_KEY = "calc-tokens-prefs";
const THEME_KEY = "tokens-custo-theme";
const RATE_CACHE_KEY = "calc-tokens-usd-brl";
const RATE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const EXCHANGE_RATE_URL = "https://api.frankfurter.dev/v2/rate/USD/BRL";

let usageMode = "detailed";
let pricingMode = "standard";

const PROVIDER_LOGOS = {
  OpenAI: "assets/logos/openai.svg",
  Anthropic: "assets/logos/anthropic.svg",
  Google: "assets/logos/google.svg",
  DeepSeek: "assets/logos/deepseek.svg",
  xAI: "assets/logos/xai.svg",
  Mistral: "assets/logos/mistral.svg",
  "Moonshot AI": "assets/logos/moonshotai.svg",
  "Z.ai": "assets/logos/zdotai.svg",
  Qwen: "assets/logos/qwen.svg",
};

function applyTheme(theme, { persist = true } = {}) {
  const nextTheme = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  els.themeColor.setAttribute("content", nextTheme === "light" ? "#f5f7fc" : "#07111f");
  els.themeToggle.setAttribute("aria-label", nextTheme === "dark" ? "Ativar modo claro" : "Ativar modo escuro");
  els.themeToggle.setAttribute("aria-pressed", String(nextTheme === "light"));
  if (persist) {
    try {
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch {
      // A preferência visual continua aplicada durante a sessão.
    }
  }
}

function initializeTheme() {
  applyTheme(document.documentElement.dataset.theme || "dark", { persist: false });
}

function populateModelSelect() {
  const groups = {};
  for (const model of PRICING) {
    (groups[model.provider] ||= []).push(model);
  }

  els.modelUsed.innerHTML = "";
  for (const [provider, models] of Object.entries(groups)) {
    const group = document.createElement("optgroup");
    group.label = provider;
    for (const model of models) {
      const option = document.createElement("option");
      option.value = model.id;
      option.textContent = `${model.name} · US$ ${model.input}/${model.output} por 1M`;
      group.appendChild(option);
    }
    els.modelUsed.appendChild(group);
  }
}

function populateProviderFilter() {
  const providers = [...new Set(PRICING.map((model) => model.provider))];
  for (const provider of providers) {
    const option = document.createElement("option");
    option.value = provider;
    option.textContent = provider;
    els.providerFilter.appendChild(option);
  }
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const prefs = JSON.parse(raw);
    if (prefs.currency) els.currency.value = prefs.currency;
    if (prefs.rate) els.rate.value = prefs.rate;
    if (prefs.modelUsed) els.modelUsed.value = prefs.modelUsed;
    if (prefs.inputTokens) els.inputTokens.value = prefs.inputTokens;
    if (prefs.outputTokens) els.outputTokens.value = prefs.outputTokens;
    if (prefs.outputShare) els.outputShare.value = prefs.outputShare;
    if (prefs.usageMode === "total" || prefs.usageMode === "detailed") usageMode = prefs.usageMode;
    if (prefs.pricingMode === "batch" || prefs.pricingMode === "standard") pricingMode = prefs.pricingMode;
  } catch {
    // Preferências corrompidas não impedem o uso da calculadora.
  }
}

function savePrefs() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currency: els.currency.value,
        rate: els.rate.value,
        modelUsed: els.modelUsed.value,
        inputTokens: els.inputTokens.value,
        outputTokens: els.outputTokens.value,
        outputShare: els.outputShare.value,
        usageMode,
        pricingMode,
      })
    );
  } catch {
    // O site funciona normalmente quando o navegador bloqueia armazenamento local.
  }
}

function setEmptyState(message) {
  els.results.innerHTML = "";
  els.resultCount.textContent = "0 modelos";
  els.noResults.hidden = true;
  els.usedSummary.hidden = true;
  els.emptyState.textContent = message;
  els.emptyState.hidden = false;
}

function formatRateDate(date) {
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat("pt-BR").format(parsed);
}

function applyAutomaticRate(rate, date) {
  els.rate.value = Number(rate).toFixed(4);
  els.rateStatus.textContent = `Automático · ${formatRateDate(date)}`;
  els.rateStatus.classList.remove("rate-warning");
}

function readCachedRate() {
  try {
    const cached = JSON.parse(localStorage.getItem(RATE_CACHE_KEY));
    if (!cached || !isValidExchangeRate(Number(cached.rate))) return null;
    return cached;
  } catch {
    return null;
  }
}

async function refreshExchangeRate({ force = false } = {}) {
  const cached = readCachedRate();
  const cacheIsFresh = cached && Date.now() - Number(cached.fetchedAt) < RATE_CACHE_TTL_MS;

  if (cacheIsFresh && !force) {
    applyAutomaticRate(cached.rate, cached.date);
    render();
    return;
  }

  els.refreshRate.disabled = true;
  els.rateStatus.textContent = "Atualizando cotação…";
  els.rateStatus.classList.remove("rate-warning");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(EXCHANGE_RATE_URL, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const rate = Number(data.rate);
    if (!isValidExchangeRate(rate) || !data.date) throw new Error("Cotação inválida");

    const rateData = { rate, date: data.date, fetchedAt: Date.now() };
    try {
      localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(rateData));
    } catch {
      // Cache é opcional.
    }
    applyAutomaticRate(rateData.rate, rateData.date);
    render();
  } catch {
    if (cached) {
      applyAutomaticRate(cached.rate, cached.date);
      els.rateStatus.textContent += " · último valor salvo";
    } else {
      els.rateStatus.textContent = "Automático indisponível · usando valor padrão";
      els.rateStatus.classList.add("rate-warning");
    }
  } finally {
    clearTimeout(timeout);
    els.refreshRate.disabled = false;
  }
}

function updateSplitLabels() {
  const outputShare = Number(els.outputShare.value);
  els.shareValue.textContent = `${outputShare}%`;
  els.splitSummary.textContent = `${100 - outputShare}% entrada · ${outputShare}% saída`;
}

function syncTotalFromDetailed() {
  const inputTokens = parseTokenValue(els.inputTokens.value);
  const outputTokens = parseTokenValue(els.outputTokens.value);
  if (Number.isNaN(inputTokens) || Number.isNaN(outputTokens)) return;

  const total = inputTokens + outputTokens;
  els.totalTokens.value = String(total);
  if (total > 0) {
    const outputShare = Math.min(60, Math.max(5, Math.round((outputTokens / total) * 20) * 5));
    els.outputShare.value = String(outputShare);
  }
  updateSplitLabels();
}

function syncDetailedFromTotal() {
  const total = parseTokenValue(els.totalTokens.value);
  const { inputTokens, outputTokens } = splitTokenTotal(total, Number(els.outputShare.value));
  if (Number.isNaN(inputTokens) || Number.isNaN(outputTokens)) return;

  els.inputTokens.value = String(inputTokens);
  els.outputTokens.value = String(outputTokens);
  updateSplitLabels();
}

function setUsageMode(mode, { synchronize = true, renderNow = true } = {}) {
  usageMode = mode === "total" ? "total" : "detailed";

  if (synchronize) {
    if (usageMode === "total") syncTotalFromDetailed();
    else syncDetailedFromTotal();
  }

  els.detailedFields.hidden = usageMode !== "detailed";
  els.totalFields.hidden = usageMode !== "total";
  for (const button of els.usageModeButtons) {
    const active = button.dataset.usageMode === usageMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  if (renderNow) render();
}

function setPricingMode(mode, { renderNow = true } = {}) {
  pricingMode = mode === "batch" ? "batch" : "standard";
  for (const button of els.pricingModeButtons) {
    const active = button.dataset.pricingMode === pricingMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  if (renderNow) render();
}

function applyQuickVolume(total) {
  if (usageMode === "detailed") syncTotalFromDetailed();
  els.totalTokens.value = String(total);
  syncDetailedFromTotal();
  render();
}

function normalizeSearch(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function providerClass(provider) {
  return `provider-${provider.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;
}

function providerLogo(provider) {
  const logo = PROVIDER_LOGOS[provider];
  return logo ? `<img src="${logo}" alt="" loading="lazy" />` : provider.slice(0, 2);
}

function formatUnitPrice(value) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(value);
}

function renderSummary({ usedModel, usedCost, rows, inputTokens, outputTokens, currency, toDisplay }) {
  const cheapestAlternative = rows.find(({ model }) => model.id !== usedModel.id);
  const savings = cheapestAlternative ? usedCost - cheapestAlternative.cost : 0;
  const savingsPct = usedCost > 0 && savings > 0 ? (savings / usedCost) * 100 : 0;
  const totalTokens = inputTokens + outputTokens;
  const displayCost = formatMoney(toDisplay(usedCost), currency);
  const costLength = displayCost.replace(/\s/g, "").length;
  const costSizeClass = costLength >= 15 ? "is-extra-long" : costLength >= 11 ? "is-long" : "";

  let bestOption;
  if (cheapestAlternative && savings > 0) {
    bestOption = `
      <div class="best-option">
        <div class="best-option-label"><span>Maior economia possível</span><span>−${savingsPct.toFixed(0)}%</span></div>
        <strong>${cheapestAlternative.model.name}</strong>
        <p>Economia estimada de ${formatMoney(toDisplay(savings), currency)}</p>
      </div>`;
  } else {
    bestOption = `
      <div class="best-option">
        <div class="best-option-label"><span>Melhor custo da tabela</span><span>Top 1</span></div>
        <strong>${usedModel.name}</strong>
        <p>Você já está usando o modelo mais econômico desta comparação.</p>
      </div>`;
  }

  els.usedSummary.hidden = false;
  els.usedSummary.innerHTML = `
    <div class="summary-primary">
      <div class="used-label">Seu custo estimado</div>
      <div class="used-model">${usedModel.name}</div>
      <div class="used-value ${costSizeClass}">${displayCost}</div>
      <div class="used-meta">${formatNumber(inputTokens)} entrada + ${formatNumber(outputTokens)} saída</div>
    </div>
    <div class="summary-insights">
      <div class="summary-divider"></div>
      ${bestOption}
      <div class="summary-stats">
        <div class="summary-stat"><span>Volume total</span><strong>${formatNumber(totalTokens)}</strong></div>
        <div class="summary-stat"><span>Modelos comparados</span><strong>${rows.length}</strong></div>
      </div>
    </div>`;
}

function renderRows(rows, { usedModel, usedCost, currency, toDisplay, batch }) {
  const query = normalizeSearch(els.modelSearch.value);
  const provider = els.providerFilter.value;
  const filteredRows = rows.filter(({ model }) => {
    const searchable = normalizeSearch(`${model.name} ${model.provider}`);
    return (!query || searchable.includes(query)) && (!provider || model.provider === provider);
  });

  els.resultCount.textContent = `${filteredRows.length} ${filteredRows.length === 1 ? "modelo" : "modelos"}`;
  els.noResults.hidden = filteredRows.length !== 0;

  els.results.innerHTML = filteredRows
    .map(({ model, cost, diff, diffPct, rank }) => {
      const isUsed = model.id === usedModel.id;
      const isBest = rank === 1;
      let diffLabel = "Mesmo custo";
      let diffClass = "same-cost";

      if (!isUsed && diff < 0) {
        diffClass = "diff-good";
        diffLabel = `↓ Economiza ${formatMoney(toDisplay(-diff), currency)} · ${Math.abs(diffPct).toFixed(0)}%`;
      } else if (!isUsed && diff > 0) {
        diffClass = "diff-bad";
        diffLabel = `↑ Custa ${formatMoney(toDisplay(diff), currency)} a mais · ${diffPct.toFixed(0)}%`;
      }

      const rates = effectiveRates(model, { batch });
      const batchNote = batch
        ? hasBatchDiscount(model)
          ? " · Batch aplicado"
          : " · Sem Batch API (preço padrão)"
        : "";

      return `
        <tr class="${isUsed ? "row-used" : ""}" style="--row-delay: ${Math.min(rank, 12) * 24}ms">
          <td class="rank-cell"><span class="rank-number ${isBest ? "best" : ""}">${rank}</span></td>
          <td class="model-cell">
            <div class="model-line">
              <span class="provider-mark ${providerClass(model.provider)}">${providerLogo(model.provider)}</span>
              <div>
                <div class="model-name">${model.name}${isUsed ? ' <span class="badge">Seu modelo</span>' : ""}${isBest ? ' <span class="best-badge">Menor custo</span>' : ""}</div>
                <div class="model-provider">${model.provider}${model.note ? ` · ${model.note}` : ""}${batchNote}</div>
              </div>
            </div>
          </td>
          <td class="rate-cell">
            <strong>US$ ${formatUnitPrice(rates.input)} / ${formatUnitPrice(rates.output)}</strong>
            <div class="price-detail">entrada / saída</div>
          </td>
          <td class="cost-cell">${formatMoney(toDisplay(cost), currency)}</td>
          <td class="diff-cell ${diffClass}">${diffLabel}</td>
        </tr>`;
    })
    .join("");
}

function render() {
  const inputTokens = parseTokenValue(els.inputTokens.value);
  const outputTokens = parseTokenValue(els.outputTokens.value);
  const usedModel = PRICING.find((model) => model.id === els.modelUsed.value);
  const currency = els.currency.value;
  const rate = Number(els.rate.value);
  const toDisplay = (usd) => (currency === "BRL" ? usd * rate : usd);

  els.rateWrap.hidden = currency !== "BRL";
  els.inputTokens.setAttribute("aria-invalid", "false");
  els.outputTokens.setAttribute("aria-invalid", "false");
  els.totalTokens.setAttribute("aria-invalid", "false");

  if (!usedModel || Number.isNaN(inputTokens) || Number.isNaN(outputTokens) || inputTokens < 0 || outputTokens < 0) {
    if (usageMode === "total") {
      els.totalTokens.setAttribute("aria-invalid", "true");
    } else {
      els.inputTokens.setAttribute("aria-invalid", String(Number.isNaN(inputTokens) || inputTokens < 0));
      els.outputTokens.setAttribute("aria-invalid", String(Number.isNaN(outputTokens) || outputTokens < 0));
    }
    setEmptyState("Revise os tokens informados. Você pode usar 1.000.000, 267,4M ou 1.2B.");
    return;
  }

  const totalTokens = inputTokens + outputTokens;
  if (totalTokens > MAX_TOKENS_PER_SCENARIO) {
    if (usageMode === "total") {
      els.totalTokens.setAttribute("aria-invalid", "true");
    } else {
      els.inputTokens.setAttribute("aria-invalid", "true");
      els.outputTokens.setAttribute("aria-invalid", "true");
    }
    setEmptyState(
      `O limite por cenário é ${formatNumber(MAX_TOKENS_PER_SCENARIO)} tokens (1 trilhão). Para volumes maiores, divida por período ou projeto.`
    );
    return;
  }

  if (currency === "BRL" && !isValidExchangeRate(rate)) {
    setEmptyState("Informe uma cotação USD→BRL maior que zero.");
    return;
  }

  els.emptyState.hidden = true;
  const batch = pricingMode === "batch";
  const usedCost = calcCost(usedModel, inputTokens, outputTokens, { batch });
  const rows = PRICING.map((model) => {
    const cost = calcCost(model, inputTokens, outputTokens, { batch });
    const diff = cost - usedCost;
    const diffPct = usedCost > 0 ? (diff / usedCost) * 100 : 0;
    return { model, cost, diff, diffPct };
  })
    .sort((a, b) => a.cost - b.cost)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  renderSummary({ usedModel, usedCost, rows, inputTokens, outputTokens, currency, toDisplay });
  renderRows(rows, { usedModel, usedCost, currency, toDisplay, batch });

  if (batch && !hasBatchDiscount(usedModel)) {
    els.summaryFootnoteText.textContent = `${usedModel.name} não publica desconto de Batch API — o custo acima usa o preço padrão. O modo Batch só reduz o preço dos modelos com essa opção documentada.`;
  } else if (batch) {
    els.summaryFootnoteText.textContent = "Estimativa com desconto de Batch API aplicado nos modelos que o publicam; demais seguem o preço padrão. Sem cache ou contexto longo.";
  } else {
    els.summaryFootnoteText.textContent = "Estimativa padrão, sem cache ou contexto longo.";
  }

  savePrefs();
}

function loadPreset() {
  setUsageMode("detailed", { synchronize: false, renderNow: false });
  els.inputTokens.value = "267400000";
  els.outputTokens.value = "114600000";
  els.modelUsed.value = "deepseek-v4-flash";
  syncTotalFromDetailed();
  render();
}

function showManualRateStatus() {
  els.rateStatus.textContent = "Valor informado manualmente";
  els.rateStatus.classList.remove("rate-warning");
}

function showPricingDate() {
  const reviewedDate = formatRateDate(PRICING_META.updatedAt);
  const monitoredAt =
    typeof PRICING_STATUS !== "undefined" && PRICING_STATUS.checkedAt
      ? PRICING_STATUS.checkedAt
      : PRICING_META.updatedAt;
  els.pricingDate.textContent = reviewedDate;
  els.pricingDateTop.textContent = formatRateDate(monitoredAt);
}

populateModelSelect();
populateProviderFilter();
initializeTheme();
loadPrefs();
syncTotalFromDetailed();
setUsageMode(usageMode, { synchronize: false, renderNow: false });
setPricingMode(pricingMode, { renderNow: false });

els.inputTokens.addEventListener("input", () => {
  syncTotalFromDetailed();
  render();
});
els.outputTokens.addEventListener("input", () => {
  syncTotalFromDetailed();
  render();
});
els.totalTokens.addEventListener("input", () => {
  syncDetailedFromTotal();
  render();
});
els.outputShare.addEventListener("input", () => {
  syncDetailedFromTotal();
  render();
});
els.modelUsed.addEventListener("input", render);
els.modelSearch.addEventListener("input", render);
els.providerFilter.addEventListener("input", render);
els.currency.addEventListener("input", render);
els.rate.addEventListener("input", () => {
  showManualRateStatus();
  render();
});
els.refreshRate.addEventListener("click", () => refreshExchangeRate({ force: true }));
els.presetBtn.addEventListener("click", loadPreset);
els.themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
});

for (const button of els.usageModeButtons) {
  button.addEventListener("click", () => setUsageMode(button.dataset.usageMode));
}
for (const button of els.ratioPresetButtons) {
  button.addEventListener("click", () => {
    els.outputShare.value = button.dataset.outputShare;
    syncDetailedFromTotal();
    render();
  });
}
for (const button of els.volumeButtons) {
  button.addEventListener("click", () => applyQuickVolume(Number(button.dataset.tokenTotal)));
}
for (const button of els.pricingModeButtons) {
  button.addEventListener("click", () => setPricingMode(button.dataset.pricingMode));
}

showPricingDate();
updateSplitLabels();
render();
refreshExchangeRate();
