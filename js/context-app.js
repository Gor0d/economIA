(function initContextTool() {
  const { CONTEXT_MODELS, CONTEXT_PRICING_META } = ContextCatalog;
  const {
    buildRecommendations,
    costFromActualUsage,
    effectiveRates,
    estimateOutputScenarios,
    estimateSections,
    normalizeActualUsage,
    projectConversation,
  } = ContextCalculator;
  const { formatMoney, formatNumber, isValidExchangeRate } = CalculatorCore;

  const els = {
    tabs: [...document.querySelectorAll("[data-product-tab]")],
    comparisonPanel: document.getElementById("comparisonPanel"),
    contextPanel: document.getElementById("contextPanel"),
    model: document.getElementById("contextModel"),
    outputMin: document.getElementById("contextOutputMin"),
    outputLikely: document.getElementById("contextOutputLikely"),
    outputMax: document.getElementById("contextOutputMax"),
    outputNotice: document.getElementById("contextOutputNotice"),
    cachePercent: document.getElementById("contextCachePercent"),
    cacheValue: document.getElementById("contextCacheValue"),
    futureTurns: document.getElementById("contextFutureTurns"),
    currency: document.getElementById("contextCurrency"),
    rate: document.getElementById("contextRate"),
    rateField: document.getElementById("contextRateField"),
    selectedModel: document.getElementById("contextSelectedModel"),
    totalTokens: document.getElementById("contextTotalTokens"),
    windowPercent: document.getElementById("contextWindowPercent"),
    windowLabel: document.getElementById("contextWindowLabel"),
    meter: document.querySelector(".context-meter"),
    meterBar: document.getElementById("contextMeterBar"),
    sectionBreakdown: document.getElementById("contextSectionBreakdown"),
    nextCost: document.getElementById("contextNextCost"),
    noCacheCost: document.getElementById("contextNoCacheCost"),
    withCacheCost: document.getElementById("contextWithCacheCost"),
    minOutputCost: document.getElementById("contextMinOutputCost"),
    likelyOutputCost: document.getElementById("contextLikelyOutputCost"),
    maxOutputCost: document.getElementById("contextMaxOutputCost"),
    tierNotice: document.getElementById("contextTierNotice"),
    projectionCards: document.getElementById("projectionCards"),
    customProjection: document.getElementById("customProjection"),
    comparisonRows: document.getElementById("contextComparisonRows"),
    conversationCostHeading: document.getElementById("conversationCostHeading"),
    recommendations: document.getElementById("contextRecommendations"),
    pricingDate: document.getElementById("contextPricingDate"),
    actualUsageInput: document.getElementById("contextActualUsage"),
    actualUsageError: document.getElementById("contextActualError"),
    actualUsageComparison: document.getElementById("contextActualComparison"),
  };

  const sectionConfig = [
    ["system", "contextSystem", "contextSystemTokens", "System / developer"],
    ["history", "contextHistory", "contextHistoryTokens", "Histórico"],
    ["documents", "contextDocuments", "contextDocumentsTokens", "Documentos / RAG"],
    ["tools", "contextTools", "contextToolsTokens", "Ferramentas / schemas"],
    ["current", "contextCurrent", "contextCurrentTokens", "Prompt atual"],
  ].map(([key, inputId, countId, label]) => ({
    key,
    input: document.getElementById(inputId),
    count: document.getElementById(countId),
    label,
  }));

  const providerLogos = {
    OpenAI: "assets/logos/openai.svg",
    Anthropic: "assets/logos/anthropic.svg",
    Google: "assets/logos/google.svg",
  };

  function formatDate(isoDate) {
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
  }

  function parseNonNegative(element, fallback = 0) {
    const value = Number(element.value);
    const valid = Number.isFinite(value) && value >= 0;
    element.setAttribute("aria-invalid", String(!valid));
    return valid ? value : fallback;
  }

  function readSections() {
    return Object.fromEntries(sectionConfig.map(({ key, input }) => [key, input.value]));
  }

  function selectedModel() {
    return CONTEXT_MODELS.find((model) => model.id === els.model.value) || CONTEXT_MODELS[0];
  }

  function displayMoney(usd) {
    const currency = els.currency.value;
    const rate = Number(els.rate.value);
    if (currency === "BRL" && !isValidExchangeRate(rate)) return "Indisponível";
    const converted = currency === "BRL" ? usd * rate : usd;
    return formatMoney(converted, currency === "BRL" ? "BRL" : "USD");
  }

  function formatUnitPrice(value) {
    if (value === null || value === undefined) return "Indisponível";
    const digits = value < 0.1 ? 3 : value < 1 ? 2 : 2;
    return `US$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: digits })}`;
  }

  function populateModels() {
    const providers = [...new Set(CONTEXT_MODELS.map((model) => model.provider))];
    els.model.innerHTML = providers
      .map((provider) => {
        const options = CONTEXT_MODELS.filter((model) => model.provider === provider)
          .map((model) => `<option value="${model.id}">${model.name}</option>`)
          .join("");
        return `<optgroup label="${provider}">${options}</optgroup>`;
      })
      .join("");
    els.model.value = "gpt-5.6-terra";
  }

  function activateTab(name, { focus = false } = {}) {
    const contextActive = name === "context";
    els.comparisonPanel.hidden = contextActive;
    els.contextPanel.hidden = !contextActive;
    els.tabs.forEach((button) => {
      const active = button.dataset.productTab === name;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.setAttribute("tabindex", active ? "0" : "-1");
      if (focus && active) button.focus();
    });
    if (contextActive) {
      history.replaceState(null, "", "#contexto");
      render();
    } else if (location.hash === "#contexto") {
      history.replaceState(null, "", `${location.pathname}${location.search}`);
    }
  }

  function renderSectionBreakdown(sectionTokens, total) {
    const maxTokens = Math.max(1, ...Object.values(sectionTokens));
    els.sectionBreakdown.innerHTML = sectionConfig
      .map(({ key, label }) => {
        const tokens = sectionTokens[key] || 0;
        const share = total > 0 ? (tokens / total) * 100 : 0;
        const barWidth = tokens > 0 ? Math.max(4, (tokens / maxTokens) * 100) : 0;
        return `<div class="section-breakdown-row">
          <div><span>${label}</span><strong>${formatNumber(tokens)} · ${share.toFixed(0)}%</strong></div>
          <span class="section-mini-bar"><i style="--section-width:${barWidth.toFixed(1)}%"></i></span>
        </div>`;
      })
      .join("");
  }

  function renderProjections({ model, inputTokens, outputLikely, currentPromptTokens, cachePercent, customTurns }) {
    const milestones = [1, 10, 50, 100];
    const projections = milestones.map((turns) =>
      projectConversation({
        model,
        baseInputTokens: inputTokens,
        probableOutputTokens: outputLikely,
        nextPromptTokens: currentPromptTokens,
        cachePercent,
        turns,
      })
    );
    els.projectionCards.innerHTML = projections
      .map(
        (projection) => `<article class="projection-card${projection.crossedContextAt ? " has-warning" : ""}">
          <span>${projection.turns} ${projection.turns === 1 ? "turno" : "turnos"}</span>
          <strong>${displayMoney(projection.totalCost)}</strong>
          <small>${formatNumber(projection.lastInputTokens)} tokens no último input</small>
          ${projection.crossedContextAt ? `<em>Limite excedido no turno ${projection.crossedContextAt}</em>` : ""}
        </article>`
      )
      .join("");

    const custom = projectConversation({
      model,
      baseInputTokens: inputTokens,
      probableOutputTokens: outputLikely,
      nextPromptTokens: currentPromptTokens,
      cachePercent,
      turns: customTurns,
    });
    els.customProjection.textContent = `${custom.turns} ${custom.turns === 1 ? "turno" : "turnos"} · ${displayMoney(custom.totalCost)}`;
    els.conversationCostHeading.textContent = `${custom.turns} ${custom.turns === 1 ? "turno" : "turnos"}`;
    return custom;
  }

  function renderComparison({ sections, outputLikely, cachePercent, customTurns }) {
    els.comparisonRows.innerHTML = CONTEXT_MODELS.map((model) => {
      const tokenEstimate = estimateSections(sections, model.provider);
      const call = estimateOutputScenarios({
        model,
        inputTokens: tokenEstimate.total,
        cachePercent,
        minimum: outputLikely,
        probable: outputLikely,
        maximum: outputLikely,
      }).probable;
      const projection = projectConversation({
        model,
        baseInputTokens: tokenEstimate.total,
        probableOutputTokens: outputLikely,
        nextPromptTokens: tokenEstimate.sections.current,
        cachePercent,
        turns: customTurns,
      });
      const rates = effectiveRates(model, tokenEstimate.total);
      const selected = model.id === els.model.value;
      return `<tr${selected ? ' class="is-context-selected"' : ""}>
        <td><div class="model-cell"><img class="provider-logo" src="${providerLogos[model.provider]}" alt="" /><div><strong>${model.name}</strong><small>${model.provider}${rates.longContext ? " · faixa longa" : ""}</small></div></div></td>
        <td>${formatNumber(model.contextWindow)}</td>
        <td>${formatUnitPrice(rates.input)}</td>
        <td>${formatUnitPrice(rates.cachedInput)}</td>
        <td>${formatUnitPrice(rates.cacheWrite)}</td>
        <td>${formatUnitPrice(rates.output)}</td>
        <td><strong>${displayMoney(call.totalWithCache)}</strong></td>
        <td><strong>${displayMoney(projection.totalCost)}</strong></td>
      </tr>`;
    }).join("");
  }

  function formatDelta(percent) {
    if (!Number.isFinite(percent)) return "";
    const sign = percent > 0 ? "+" : "";
    return `${sign}${percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  }

  function renderActualUsage({ model, estimatedInputTokens, estimatedOutputTokens, estimatedCostUsd }) {
    const raw = els.actualUsageInput.value.trim();
    els.actualUsageError.hidden = true;
    els.actualUsageComparison.hidden = true;
    if (!raw) return;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      els.actualUsageError.hidden = false;
      els.actualUsageError.textContent = 'JSON inválido — cole o objeto "usage" exatamente como veio na resposta da API.';
      return;
    }

    const usage = normalizeActualUsage(parsed, model.provider);
    if (usage.input_tokens <= 0 && usage.output_tokens <= 0) {
      els.actualUsageError.hidden = false;
      els.actualUsageError.textContent =
        'Não encontrei tokens de entrada/saída nesse objeto. Confira se colou o campo "usage" (ou "usageMetadata", no caso do Google).';
      return;
    }

    const result = costFromActualUsage({ model, usage });
    const inputDelta =
      estimatedInputTokens > 0 ? ((usage.input_tokens - estimatedInputTokens) / estimatedInputTokens) * 100 : null;
    const outputDelta =
      estimatedOutputTokens > 0 ? ((usage.output_tokens - estimatedOutputTokens) / estimatedOutputTokens) * 100 : null;
    const costDelta = estimatedCostUsd > 0 ? ((result.totalCost - estimatedCostUsd) / estimatedCostUsd) * 100 : null;
    const costClass = costDelta === null ? "" : costDelta > 0 ? "is-over" : costDelta < 0 ? "is-under" : "";

    els.actualUsageComparison.hidden = false;
    els.actualUsageComparison.innerHTML = `
      <div class="actual-usage-row"><span>Tokens de entrada</span><strong>${formatNumber(usage.input_tokens)} real · estimado ${formatNumber(estimatedInputTokens)}${inputDelta === null ? "" : ` (${formatDelta(inputDelta)})`}</strong></div>
      <div class="actual-usage-row"><span>Tokens de saída</span><strong>${formatNumber(usage.output_tokens)} real · estimado ${formatNumber(estimatedOutputTokens)}${outputDelta === null ? "" : ` (${formatDelta(outputDelta)})`}</strong></div>
      <div class="actual-usage-row"><span>Custo desta chamada</span><strong class="${costClass}">${displayMoney(result.totalCost)} real · estimado ${displayMoney(estimatedCostUsd)}${costDelta === null ? "" : ` (${formatDelta(costDelta)})`}</strong></div>
    `;
  }

  function renderRecommendations(recommendations) {
    els.recommendations.innerHTML = recommendations
      .map(
        ({ level, title, text }) => `<article class="recommendation-card is-${level}">
          <span class="recommendation-icon" aria-hidden="true">${level === "success" ? "✓" : level === "danger" ? "!" : level === "warning" ? "↗" : "i"}</span>
          <div><h3>${title}</h3><p>${text}</p></div>
        </article>`
      )
      .join("");
  }

  function render() {
    const model = selectedModel();
    const sections = readSections();
    const tokenEstimate = estimateSections(sections, model.provider);
    const outputMin = parseNonNegative(els.outputMin, 0);
    const outputLikely = parseNonNegative(els.outputLikely, outputMin);
    const outputMax = parseNonNegative(els.outputMax, outputLikely);
    const cachePercent = Number(els.cachePercent.value);
    const customTurns = Math.min(100, Math.max(1, Math.round(parseNonNegative(els.futureTurns, 1))));
    const rateValid = els.currency.value !== "BRL" || isValidExchangeRate(Number(els.rate.value));
    els.rate.setAttribute("aria-invalid", String(!rateValid));
    [els.outputMin, els.outputLikely, els.outputMax].forEach((element) => element.setAttribute("max", String(model.maxOutput)));
    const outputOrderValid = outputMin <= outputLikely && outputLikely <= outputMax;
    const outputWithinLimit = outputMax <= model.maxOutput;
    const rawOutputs = [els.outputMin, els.outputLikely, els.outputMax].map((element) => Number(element.value));
    els.outputMin.setAttribute("aria-invalid", String(!Number.isFinite(rawOutputs[0]) || rawOutputs[0] < 0 || !outputOrderValid));
    els.outputLikely.setAttribute("aria-invalid", String(!Number.isFinite(rawOutputs[1]) || rawOutputs[1] < 0 || !outputOrderValid));
    els.outputMax.setAttribute("aria-invalid", String(!Number.isFinite(rawOutputs[2]) || rawOutputs[2] < 0 || !outputOrderValid || !outputWithinLimit));
    els.outputNotice.hidden = outputOrderValid && outputWithinLimit;
    els.outputNotice.textContent = !outputOrderValid
      ? "Use mínima ≤ provável ≤ máxima."
      : `A saída máxima publicada para ${model.name} é ${formatNumber(model.maxOutput)} tokens.`;
    els.rateField.hidden = els.currency.value !== "BRL";
    els.cacheValue.textContent = `${cachePercent}%`;

    sectionConfig.forEach(({ key, count }) => {
      count.textContent = formatNumber(tokenEstimate.sections[key]);
    });

    const scenarios = estimateOutputScenarios({
      model,
      inputTokens: tokenEstimate.total,
      cachePercent,
      minimum: outputMin,
      probable: outputLikely,
      maximum: outputMax,
    });
    const probable = scenarios.probable;

    els.selectedModel.textContent = `${model.name} · ${model.provider}`;
    els.totalTokens.textContent = formatNumber(tokenEstimate.total);
    els.windowPercent.textContent = `${probable.contextPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    els.windowLabel.textContent = `${formatNumber(tokenEstimate.total)} de ${formatNumber(model.contextWindow)} tokens`;
    const meterValue = Math.min(100, Math.max(0, probable.contextPercent));
    els.meter.setAttribute("aria-valuenow", meterValue.toFixed(1));
    els.meter.dataset.level = probable.contextPercent >= 100 ? "danger" : probable.contextPercent >= 80 ? "warning" : "safe";
    els.meterBar.style.setProperty("--meter-width", `${meterValue}%`);
    renderSectionBreakdown(tokenEstimate.sections, tokenEstimate.total);

    els.nextCost.textContent = rateValid ? displayMoney(probable.totalWithCache) : "Revise a cotação";
    els.noCacheCost.textContent = rateValid ? displayMoney(probable.costWithoutCache) : "Indisponível";
    els.withCacheCost.textContent = rateValid ? displayMoney(probable.costWithCache) : "Indisponível";
    els.minOutputCost.textContent = rateValid ? displayMoney(scenarios.minimum.outputCost) : "Indisponível";
    els.likelyOutputCost.textContent = rateValid ? displayMoney(probable.outputCost) : "Indisponível";
    els.maxOutputCost.textContent = rateValid ? displayMoney(scenarios.maximum.outputCost) : "Indisponível";

    els.tierNotice.hidden = !probable.rates.longContext;
    els.tierNotice.textContent = probable.rates.longContext
      ? `Faixa de contexto longo ativa: acima de ${formatNumber(model.longContext.threshold)} tokens, input/cache usam ${model.longContext.inputMultiplier}× e output ${model.longContext.outputMultiplier}×.`
      : "";

    renderActualUsage({
      model,
      estimatedInputTokens: tokenEstimate.total,
      estimatedOutputTokens: outputLikely,
      estimatedCostUsd: probable.totalWithCache,
    });

    const customProjection = renderProjections({
      model,
      inputTokens: tokenEstimate.total,
      outputLikely,
      currentPromptTokens: tokenEstimate.sections.current,
      cachePercent,
      customTurns,
    });
    renderComparison({ sections, outputLikely, cachePercent, customTurns });
    renderRecommendations(
      buildRecommendations({
        sectionTokens: tokenEstimate.sections,
        model,
        inputTokens: tokenEstimate.total,
        cachePercent,
        futureProjection: customProjection,
      })
    );
  }

  populateModels();
  els.pricingDate.textContent = `Preços: ${formatDate(CONTEXT_PRICING_META.updatedAt)}`;

  els.tabs.forEach((button, index) => {
    button.addEventListener("click", () => activateTab(button.dataset.productTab));
    button.addEventListener("keydown", (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (index + direction + els.tabs.length) % els.tabs.length;
      activateTab(els.tabs[nextIndex].dataset.productTab, { focus: true });
    });
  });

  sectionConfig.forEach(({ input }) => input.addEventListener("input", render));
  [
    els.model,
    els.outputMin,
    els.outputLikely,
    els.outputMax,
    els.cachePercent,
    els.futureTurns,
    els.currency,
    els.rate,
    els.actualUsageInput,
  ].forEach((element) => element.addEventListener("input", render));

  activateTab(location.hash === "#contexto" ? "context" : "comparison");
  render();
})();
