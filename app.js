const els = {
  inputTokens: document.getElementById("inputTokens"),
  outputTokens: document.getElementById("outputTokens"),
  modelUsed: document.getElementById("modelUsed"),
  currency: document.getElementById("currency"),
  rate: document.getElementById("rate"),
  rateWrap: document.getElementById("rateWrap"),
  rateStatus: document.getElementById("rateStatus"),
  refreshRate: document.getElementById("refreshRate"),
  presetBtn: document.getElementById("presetBtn"),
  results: document.getElementById("results"),
  usedSummary: document.getElementById("usedSummary"),
  emptyState: document.getElementById("emptyState"),
  pricingDate: document.getElementById("pricingDate"),
};

const { calcCost, formatMoney, formatNumber, isValidExchangeRate, parseTokenValue } = CalculatorCore;
const STORAGE_KEY = "calc-tokens-prefs";
const RATE_CACHE_KEY = "calc-tokens-usd-brl";
const RATE_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const EXCHANGE_RATE_URL = "https://api.frankfurter.dev/v2/rate/USD/BRL";

function populateModelSelect() {
  const groups = {};
  for (const m of PRICING) {
    (groups[m.provider] ||= []).push(m);
  }
  els.modelUsed.innerHTML = "";
  for (const [provider, models] of Object.entries(groups)) {
    const og = document.createElement("optgroup");
    og.label = provider;
    for (const m of models) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.name} ($${m.input}/$${m.output} por 1M)`;
      og.appendChild(opt);
    }
    els.modelUsed.appendChild(og);
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
  } catch {
    // ignora preferências corrompidas
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
      })
    );
  } catch {
    // localStorage indisponível (modo privado, etc.) — segue sem persistir
  }
}

function setEmptyState(message) {
  els.results.innerHTML = "";
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
      // O site continua funcionando quando o navegador bloqueia armazenamento local.
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

function render() {
  const inputTokens = parseTokenValue(els.inputTokens.value);
  const outputTokens = parseTokenValue(els.outputTokens.value);
  const usedModel = PRICING.find((m) => m.id === els.modelUsed.value);
  const currency = els.currency.value;
  const rate = Number(els.rate.value);
  const toDisplay = (usd) => (currency === "BRL" ? usd * rate : usd);

  els.rateWrap.hidden = currency !== "BRL";

  if (!usedModel || Number.isNaN(inputTokens) || Number.isNaN(outputTokens) || inputTokens < 0 || outputTokens < 0) {
    setEmptyState("Use números válidos e positivos para os tokens. Exemplos: 1.000.000, 267,4M ou 1.2B.");
    return;
  }

  if (currency === "BRL" && !isValidExchangeRate(rate)) {
    setEmptyState("Informe uma cotação USD→BRL maior que zero.");
    return;
  }
  els.emptyState.hidden = true;

  const usedCost = calcCost(usedModel, inputTokens, outputTokens);

  els.usedSummary.hidden = false;
  els.usedSummary.innerHTML = `
    <div class="used-label">Custo com ${usedModel.name}</div>
    <div class="used-value">${formatMoney(toDisplay(usedCost), currency)}</div>
    <div class="used-meta">${formatNumber(inputTokens)} tokens de entrada + ${formatNumber(outputTokens)} de saída</div>
  `;

  const rows = PRICING.map((m) => {
    const cost = calcCost(m, inputTokens, outputTokens);
    const diff = cost - usedCost;
    const diffPct = usedCost > 0 ? (diff / usedCost) * 100 : 0;
    return { model: m, cost, diff, diffPct };
  }).sort((a, b) => a.cost - b.cost);

  els.results.innerHTML = rows
    .map(({ model, cost, diff, diffPct }) => {
      const isUsed = model.id === usedModel.id;
      let diffLabel = "—";
      let diffClass = "";
      if (!isUsed) {
        if (diff < 0) {
          diffClass = "diff-good";
          diffLabel = `▼ economiza ${formatMoney(toDisplay(-diff), currency)} (${Math.abs(diffPct).toFixed(0)}%)`;
        } else if (diff > 0) {
          diffClass = "diff-bad";
          diffLabel = `▲ custa mais ${formatMoney(toDisplay(diff), currency)} (${diffPct.toFixed(0)}%)`;
        } else {
          diffLabel = "mesmo custo";
        }
      }
      return `
        <tr class="${isUsed ? "row-used" : ""}">
          <td>
            <div class="model-name">${model.name}${isUsed ? ' <span class="badge">usado</span>' : ""}</div>
            <div class="model-provider">${model.provider}${model.note ? ` · ${model.note}` : ""}</div>
          </td>
          <td class="cost-cell">${formatMoney(toDisplay(cost), currency)}</td>
          <td class="${diffClass}">${diffLabel}</td>
        </tr>
      `;
    })
    .join("");

  savePrefs();
}

function loadPreset() {
  els.inputTokens.value = 267400000;
  els.outputTokens.value = 114600000;
  els.modelUsed.value = "deepseek-v4-flash";
  render();
}

function showManualRateStatus() {
  els.rateStatus.textContent = "Valor informado manualmente";
  els.rateStatus.classList.remove("rate-warning");
}

function showPricingDate() {
  els.pricingDate.textContent = formatRateDate(PRICING_META.updatedAt);
}

populateModelSelect();
loadPrefs();
[els.inputTokens, els.outputTokens, els.modelUsed].forEach((el) =>
  el.addEventListener("input", render)
);
els.currency.addEventListener("input", render);
els.rate.addEventListener("input", () => {
  showManualRateStatus();
  render();
});
els.refreshRate.addEventListener("click", () => refreshExchangeRate({ force: true }));
els.presetBtn.addEventListener("click", loadPreset);
showPricingDate();
render();
refreshExchangeRate();
